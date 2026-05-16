import { useState } from 'react';
import { collection, addDoc, updateDoc, getDocs, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../Firebase';

export default function AddMatchPanel({ teams, onSuccess }) {
  const [team1Id, setTeam1Id] = useState('');
  const [team2Id, setTeam2Id] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [matchHour, setMatchHour] = useState('');
  const [matchMin, setMatchMin] = useState('');
  const [matchStatus, setMatchStatus] = useState('completed');
  const [set1, setSet1] = useState({ team1: '', team2: '' });
  const [set2, setSet2] = useState({ team1: '', team2: '' });
  const [set3, setSet3] = useState({ team1: '', team2: '' });
  const [winnerId, setWinnerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const team1 = teams.find(t => t.id === team1Id);
  const team2 = teams.find(t => t.id === team2Id);

  function set1Winner() {
    const a = parseInt(set1.team1), b = parseInt(set1.team2);
    if (isNaN(a) || isNaN(b)) return null;
    if (a > b) return 'team1';
    if (b > a) return 'team2';
    return null;
  }

  function set2Winner() {
    const a = parseInt(set2.team1), b = parseInt(set2.team2);
    if (isNaN(a) || isNaN(b)) return null;
    if (a > b) return 'team1';
    if (b > a) return 'team2';
    return null;
  }

  const isTiebreak = set1Winner() !== null && set2Winner() !== null && set1Winner() !== set2Winner();

  async function recalculateLadder(winnerId, loserId, fromTeamId) {
    const teamsSnapshot = await getDocs(query(collection(db, 'teams'), orderBy('position', 'asc')));
    const allTeams = teamsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const winnerTeam = allTeams.find(t => t.id === winnerId);
    const loserTeam = allTeams.find(t => t.id === loserId);
    if (!winnerTeam || !loserTeam) return;
    const winnerPos = winnerTeam.position;
    const loserPos = loserTeam.position;
    const challengerIsWinner = winnerId === fromTeamId;
    if (challengerIsWinner && winnerPos > loserPos) {
      const updates = [];
      allTeams.forEach(t => {
        if (t.position >= loserPos && t.position < winnerPos && t.id !== winnerId) {
          updates.push(updateDoc(doc(db, 'teams', t.id), { position: t.position + 1 }));
        }
      });
      updates.push(updateDoc(doc(db, 'teams', winnerId), { position: loserPos }));
      await Promise.all(updates);
    }
  }

  async function handleSave() {
    if (!team1Id || !team2Id) { setError('Lütfen iki takım seçin.'); return; }
    if (team1Id === team2Id) { setError('Takımlar farklı olmalı.'); return; }
    if (!matchDate) { setError('Lütfen maç tarihi girin.'); return; }

    if (matchStatus === 'completed') {
      if (!set1.team1 || !set1.team2) { setError('Lütfen 1. set skorunu girin.'); return; }
      if (!set2.team1 || !set2.team2) { setError('Lütfen 2. set skorunu girin.'); return; }
      if (isTiebreak && (!set3.team1 || !set3.team2)) { setError('Lütfen tiebreak skorunu girin.'); return; }
      if (!winnerId) { setError('Lütfen kazananı seçin.'); return; }
    }

    setSaving(true);
    setError('');

    const scheduledAt = matchDate ? new Date(matchDate + 'T' + (matchHour || '12') + ':' + (matchMin || '00')) : null;

    try {
      if (matchStatus === 'cancelled') {
        await addDoc(collection(db, 'matchRequests'), {
          fromTeamId: team1Id,
          fromTeamName: team1.name,
          toTeamId: team2Id,
          toTeamName: team2.name,
          status: 'cancelled',
          scheduledAt,
          requestedAt: serverTimestamp(),
          completedAt: serverTimestamp(),
          createdByAdmin: true,
          woRequested: false,
          expiresAt: null,
        });
        await addDoc(collection(db, 'auditLog'), {
          action: 'admin_match_created', actor: 'admin',
          payload: { team1: team1.name, team2: team2.name, status: 'cancelled' },
          createdAt: serverTimestamp(),
        });
      } else {
        let score = set1.team1 + '-' + set1.team2 + ', ' + set2.team1 + '-' + set2.team2;
        if (isTiebreak) score += ', ' + set3.team1 + '-' + set3.team2 + ' (TB)';
        const loserId = winnerId === team1Id ? team2Id : team1Id;

        const matchRef = await addDoc(collection(db, 'matchRequests'), {
          fromTeamId: team1Id,
          fromTeamName: team1.name,
          toTeamId: team2Id,
          toTeamName: team2.name,
          status: 'completed',
          scheduledAt,
          requestedAt: serverTimestamp(),
          completedAt: serverTimestamp(),
          createdByAdmin: true,
          woRequested: false,
          expiresAt: null,
        });

        await addDoc(collection(db, 'results'), {
          matchId: matchRef.id,
          fromTeamId: team1Id,
          toTeamId: team2Id,
          fromTeamName: team1.name,
          toTeamName: team2.name,
          score, winnerId, loserId,
          enteredAt: serverTimestamp(),
          createdByAdmin: true,
        });

        await addDoc(collection(db, 'matchHistory'), {
          team1Id, team2Id,
          team1Name: team1.name,
          team2Name: team2.name,
          winnerId, loserId, score,
          playedAt: serverTimestamp(),
        });

        await recalculateLadder(winnerId, loserId, team1Id);

        await addDoc(collection(db, 'auditLog'), {
          action: 'admin_match_created', actor: 'admin',
          payload: { team1: team1.name, team2: team2.name, score, winner: winnerId === team1Id ? team1.name : team2.name },
          createdAt: serverTimestamp(),
        });
      }

      setTeam1Id(''); setTeam2Id(''); setMatchDate(''); setMatchHour(''); setMatchMin('');
      setSet1({ team1: '', team2: '' }); setSet2({ team1: '', team2: '' }); setSet3({ team1: '', team2: '' });
      setWinnerId(''); setMatchStatus('completed');
      setSuccess(matchStatus === 'cancelled' ? 'İptal edilmiş maç eklendi!' : 'Maç oluşturuldu ve sıralama güncellendi!');
      setTimeout(() => { setSuccess(''); if (onSuccess) onSuccess(); }, 2000);
    } catch (err) {
      console.error(err);
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    }
    setSaving(false);
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #2e4a2e', background: '#111f11',
    color: '#fff', fontSize: 13, boxSizing: 'border-box',
  };

  const selectStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #2e4a2e', background: '#111f11',
    color: '#fff', fontSize: 13,
  };

  const scoreInput = (disabled) => ({
    width: 64, padding: '9px', borderRadius: 8, textAlign: 'center',
    border: '1px solid', borderColor: disabled ? '#1a2a1a' : '#2e4a2e',
    background: disabled ? '#0f1a0f' : '#111f11',
    color: disabled ? '#2e4a2e' : '#fff',
    fontSize: 15, fontWeight: 700, boxSizing: 'border-box',
  });

  const lbl = (text) => (
    <div style={{ fontSize: 11, color: '#4a7a4a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
      {text}
    </div>
  );

  return (
    <div>
      {success && <div style={{ background: '#0f2a0f', border: '1px solid #4caf5044', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#8bc34a' }}>{success}</div>}
      {error && <div style={{ background: '#2a0f0f', border: '1px solid #cc000044', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ff6b6b' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div>
          {lbl('Maç durumu')}
          <div style={{ display: 'flex', gap: 8 }}>
            <div onClick={() => setMatchStatus('completed')}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: matchStatus === 'completed' ? '#8bc34a' : '#2e4a2e', background: matchStatus === 'completed' ? '#162a16' : '#111f11', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
              ✅ Tamamlandı
            </div>
            <div onClick={() => setMatchStatus('cancelled')}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: matchStatus === 'cancelled' ? '#ff6b6b' : '#2e4a2e', background: matchStatus === 'cancelled' ? '#2a0f0f' : '#111f11', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600, color: matchStatus === 'cancelled' ? '#ff6b6b' : '#fff' }}>
              ❌ İptal
            </div>
          </div>
        </div>

        <div>
          {lbl('Takımlar')}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={team1Id} onChange={e => { setTeam1Id(e.target.value); setWinnerId(''); }} style={{ ...selectStyle, flex: 1 }}>
              <option value="">Takım 1...</option>
              {teams.map(t => (
                <option key={t.id} value={t.id} disabled={t.id === team2Id}>
                  #{t.position} {t.name}{t.status !== 'active' ? ' (pasif)' : ''}
                </option>
              ))}
            </select>
            <div style={{ color: '#4a7a4a', fontWeight: 700, flexShrink: 0 }}>vs</div>
            <select value={team2Id} onChange={e => { setTeam2Id(e.target.value); setWinnerId(''); }} style={{ ...selectStyle, flex: 1 }}>
              <option value="">Takım 2...</option>
              {teams.map(t => (
                <option key={t.id} value={t.id} disabled={t.id === team1Id}>
                  #{t.position} {t.name}{t.status !== 'active' ? ' (pasif)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 130 }}>
            {lbl('Tarih')}
            <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            {lbl('Saat')}
            <select value={matchHour} onChange={e => setMatchHour(e.target.value)} style={selectStyle}>
              <option value="">SS</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            {lbl('Dakika')}
            <select value={matchMin} onChange={e => setMatchMin(e.target.value)} style={selectStyle}>
              <option value="">DD</option>
              {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {matchStatus === 'completed' && (
          <>
            <div>
              {lbl('Skorlar — max 2 set, 1-1 beraberlikte tiebreak')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 70, fontSize: 11, color: '#4a7a4a', fontWeight: 600 }}>SET 1</div>
                  <input type="number" min="0" max="7" value={set1.team1} onChange={e => setSet1({ ...set1, team1: e.target.value })} style={scoreInput(false)} />
                  <div style={{ color: '#2e4a2e', fontWeight: 700 }}>—</div>
                  <input type="number" min="0" max="7" value={set1.team2} onChange={e => setSet1({ ...set1, team2: e.target.value })} style={scoreInput(false)} />
                  {set1Winner() && <div style={{ fontSize: 11, color: '#8bc34a', fontWeight: 600 }}>{set1Winner() === 'team1' ? team1?.name : team2?.name} kazandı</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 70, fontSize: 11, color: set1Winner() ? '#4a7a4a' : '#2e4a2e', fontWeight: 600 }}>SET 2</div>
                  <input type="number" min="0" max="7" value={set2.team1} onChange={e => setSet2({ ...set2, team1: e.target.value })} disabled={!set1Winner()} style={scoreInput(!set1Winner())} />
                  <div style={{ color: '#2e4a2e', fontWeight: 700 }}>—</div>
                  <input type="number" min="0" max="7" value={set2.team2} onChange={e => setSet2({ ...set2, team2: e.target.value })} disabled={!set1Winner()} style={scoreInput(!set1Winner())} />
                  {set2Winner() && <div style={{ fontSize: 11, color: '#8bc34a', fontWeight: 600 }}>{set2Winner() === 'team1' ? team1?.name : team2?.name} kazandı</div>}
                </div>
                {isTiebreak && (
                  <div>
                    <div style={{ padding: '6px 10px', background: '#1a2a0f', borderRadius: 6, border: '1px solid #4a5a2a', marginBottom: 8, fontSize: 11, color: '#c8e64a' }}>
                      ⚡ 1-1 beraberlik — tiebreak (ilk 10 puana)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 70, fontSize: 11, color: '#c8e64a', fontWeight: 600 }}>TB</div>
                      <input type="number" min="0" max="10" value={set3.team1} onChange={e => setSet3({ ...set3, team1: e.target.value })} style={{ ...scoreInput(false), borderColor: '#4a5a2a' }} />
                      <div style={{ color: '#2e4a2e', fontWeight: 700 }}>—</div>
                      <input type="number" min="0" max="10" value={set3.team2} onChange={e => setSet3({ ...set3, team2: e.target.value })} style={{ ...scoreInput(false), borderColor: '#4a5a2a' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {team1 && team2 && (
              <div>
                {lbl('Kazanan')}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={() => setWinnerId(team1Id)}
                    style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid', borderColor: winnerId === team1Id ? '#8bc34a' : '#2e4a2e', background: winnerId === team1Id ? '#162a16' : '#111f11', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                    {winnerId === team1Id && '🏆 '}{team1.name}
                  </div>
                  <div onClick={() => setWinnerId(team2Id)}
                    style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid', borderColor: winnerId === team2Id ? '#8bc34a' : '#2e4a2e', background: winnerId === team2Id ? '#162a16' : '#111f11', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                    {winnerId === team2Id && '🏆 '}{team2.name}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: matchStatus === 'cancelled' ? '#cc0000' : '#8bc34a', color: matchStatus === 'cancelled' ? '#fff' : '#0f1f0f', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {saving ? 'Kaydediliyor...' : matchStatus === 'cancelled' ? 'İptal edilmiş maçı kaydet' : 'Maçı oluştur ve sıralamayı güncelle'}
        </button>
      </div>
    </div>
  );
}