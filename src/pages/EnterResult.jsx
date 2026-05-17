import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, getDocs, orderBy, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../Firebase';

export default function EnterResult() {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [view, setView] = useState('select-match');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [set1, setSet1] = useState({ team1: '', team2: '' });
  const [set2, setSet2] = useState({ team1: '', team2: '' });
  const [set3, setSet3] = useState({ team1: '', team2: '' });
  const [matchResult, setMatchResult] = useState('winner');
  const [winnerId, setWinnerId] = useState('');
  const [onlyOneSet, setOnlyOneSet] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'matchRequests'), where('status', '==', 'accepted'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMatches(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  function formatScheduled(ts) {
    if (!ts) return null;
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' saat ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function set1Winner() {
    const a = parseInt(set1.team1), b = parseInt(set1.team2);
    if (isNaN(a) || isNaN(b)) return null;
    if (a > b) return 'team1';
    if (b > a) return 'team2';
    return 'tie';
  }

  function set2Winner() {
    const a = parseInt(set2.team1), b = parseInt(set2.team2);
    if (isNaN(a) || isNaN(b)) return null;
    if (a > b) return 'team1';
    if (b > a) return 'team2';
    return 'tie';
  }

  const isTiebreak = set1Winner() !== null && set1Winner() !== 'tie' &&
    set2Winner() !== null && set2Winner() !== 'tie' &&
    set1Winner() !== set2Winner() && !onlyOneSet;

  const isTie = matchResult === 'tie';

  const isAbandonedSplit = !onlyOneSet &&
    set1Winner() !== null && set1Winner() !== 'tie' &&
    set2Winner() !== null && set2Winner() !== 'tie' &&
    set1Winner() !== set2Winner() &&
    !set3.team1 && !set3.team2;

  const hasClearWinner = !isTie && winnerId &&
    (onlyOneSet || (set1Winner() !== null && set2Winner() !== null && !isAbandonedSplit));

  async function recalculateLadder(winnerId, loserId, matchId) {
    const teamsSnapshot = await getDocs(query(collection(db, 'teams'), orderBy('position', 'asc')));
    const allTeams = teamsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const match = matches.find(m => m.id === matchId);
    const winnerTeam = allTeams.find(t => t.id === winnerId);
    const loserTeam = allTeams.find(t => t.id === loserId);
    if (!winnerTeam || !loserTeam || !match) return;
    const winnerPos = winnerTeam.position;
    const loserPos = loserTeam.position;
    const challengerIsWinner = winnerId === match.fromTeamId;
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

  async function handleSubmit() {
    setError('');
    if (!set1.team1 || !set1.team2) { setError('Set 1 skorlarını giriniz.'); return; }
    if (isTiebreak && (!set3.team1 || !set3.team2)) { setError('Tiebreak skorlarını giriniz.'); return; }
    if (matchResult === 'winner' && !winnerId) { setError('Kazananı seçiniz.'); return; }

    let score = set1.team1 + '-' + set1.team2;
    if (!onlyOneSet && set2.team1 && set2.team2) score += ', ' + set2.team1 + '-' + set2.team2;
    if (isTiebreak && set3.team1 && set3.team2) score += ', ' + set3.team1 + '-' + set3.team2 + ' (TB)';
    if (isTie) score += ' (Berabere)';
    if (isAbandonedSplit) score += ' (Tamamlanmadı)';

    setSubmitting(true);
    const loserId = isTie || isAbandonedSplit ? null : (winnerId === selectedMatch.fromTeamId ? selectedMatch.toTeamId : selectedMatch.fromTeamId);

    try {
      await addDoc(collection(db, 'results'), {
        matchId: selectedMatch.id,
        fromTeamId: selectedMatch.fromTeamId,
        toTeamId: selectedMatch.toTeamId,
        fromTeamName: selectedMatch.fromTeamName,
        toTeamName: selectedMatch.toTeamName,
        score,
        winnerId: isTie || isAbandonedSplit ? null : winnerId,
        loserId,
        isTie: isTie || isAbandonedSplit,
        enteredAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'matchRequests', selectedMatch.id), {
        status: 'completed', completedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'teams', selectedMatch.fromTeamId), { activeChallenge: null });
      await updateDoc(doc(db, 'teams', selectedMatch.toTeamId), { activeChallenge: null });

      if (hasClearWinner && winnerId && loserId) {
        await recalculateLadder(winnerId, loserId, selectedMatch.id);
      }

      await addDoc(collection(db, 'matchHistory'), {
        team1Id: selectedMatch.fromTeamId, team2Id: selectedMatch.toTeamId,
        team1Name: selectedMatch.fromTeamName, team2Name: selectedMatch.toTeamName,
        winnerId: isTie || isAbandonedSplit ? null : winnerId,
        loserId, isTie: isTie || isAbandonedSplit, score,
        playedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'auditLog'), {
        action: 'result_entered', actor: 'player', targetId: selectedMatch.id,
        payload: { fromTeamName: selectedMatch.fromTeamName, toTeamName: selectedMatch.toTeamName, score, isTie: isTie || isAbandonedSplit },
        createdAt: serverTimestamp(),
      });

      setView('success');
    } catch (err) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError('Bu maç için sonuç önceden sisteme girildi.');
      } else {
        setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      }
    }
    setSubmitting(false);
  }

  const inputStyle = (disabled) => ({
    width: 72, padding: '10px', borderRadius: 8,
    border: '1px solid', borderColor: disabled ? '#1a2a1a' : '#2e4a2e',
    background: disabled ? '#0f1a0f' : '#111f11',
    color: disabled ? '#2e4a2e' : '#fff',
    fontSize: 16, fontWeight: 700, textAlign: 'center',
    boxSizing: 'border-box',
  });

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f1f0f', padding: 40, fontSize: 14, color: '#4a7a4a' }}>
      Yükleniyor...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0f1f0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px' }}>

        <div style={{ paddingTop: 48, paddingBottom: 24, borderBottom: '1px solid #1e3a1e' }}>
          <a href="/" style={{ fontSize: 13, color: '#4a7a4a', textDecoration: 'none' }}>← Sıralamalara geri dön</a>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '12px 0 4px' }}>
            Sonuç <span style={{ color: '#8bc34a' }}>Bildir</span>
          </h1>
          <p style={{ fontSize: 13, color: '#4a7a4a', margin: 0 }}>Skor girişlerinde bir hata yaptıysanız, lütfen admin ile iletişime geçiniz</p>
        </div>

        <div style={{ paddingTop: 32, paddingBottom: 48 }}>

          {error && (
            <div style={{ background: '#2a0f0f', border: '1px solid #cc000044', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#ff6b6b' }}>
              {error}
            </div>
          )}

          {view === 'success' && (
            <div style={{ background: '#0f2a0f', border: '1px solid #4caf5044', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎾</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#8bc34a', marginBottom: 8 }}>Sonuç girildi!</div>
              <div style={{ fontSize: 13, color: '#4a7a4a', marginBottom: 24 }}>
                {isTie || isAbandonedSplit ? 'Sıralama değişmedi.' : 'Sıralama güncellendi.'}
              </div>
              <a href="/" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 8, background: '#8bc34a', color: '#0f1f0f', fontSize: 13, fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Sıralamalara geri dön
              </a>
            </div>
          )}

          {view === 'select-match' && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 16, color: '#8bc34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Maçınızı Seçin
              </p>
              {matches.length === 0 ? (
                <div style={{ padding: '48px 24px', borderRadius: 12, border: '1px solid #1e3a1e', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                  <div style={{ fontSize: 14, color: '#4a7a4a' }}>Aktif maç yok.</div>
                  <div style={{ fontSize: 13, color: '#2e4a2e', marginTop: 6 }}>Sonuç girilebilmesi için maç teklifinin kabul edilmesi gerekmektedir.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {matches.map(match => (
                    <div key={match.id}
                      onClick={() => {
                        setSelectedMatch(match);
                        setView('enter-result');
                        setWinnerId('');
                        setMatchResult('winner');
                        setOnlyOneSet(false);
                        setSet1({ team1: '', team2: '' });
                        setSet2({ team1: '', team2: '' });
                        setSet3({ team1: '', team2: '' });
                      }}
                      style={{ padding: '18px 20px', borderRadius: 12, border: '1px solid #1e3a1e', background: '#131f13', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#8bc34a'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#1e3a1e'}
                    >
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                        {match.fromTeamName}
                        <span style={{ color: '#4a7a4a', fontWeight: 400, margin: '0 10px', fontSize: 13 }}>vs</span>
                        {match.toTeamName}
                      </div>
                      {match.scheduledAt ? (
                        <div style={{ fontSize: 12, color: '#8bc34a' }}>📅 {formatScheduled(match.scheduledAt)}</div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#4a7a4a' }}>Maç ayarlandı — sonuç bekleniyor</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'enter-result' && selectedMatch && (
            <div>
              <div style={{ marginBottom: 28, padding: '16px 20px', background: '#162a16', borderRadius: 12, border: '1px solid #2e4a2e' }}>
                <div style={{ fontSize: 11, color: '#4caf50', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Maç</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {selectedMatch.fromTeamName}
                  <span style={{ color: '#4a7a4a', fontWeight: 400, margin: '0 10px', fontSize: 13 }}>vs</span>
                  {selectedMatch.toTeamName}
                </div>
                {selectedMatch.scheduledAt && (
                  <div style={{ fontSize: 12, color: '#8bc34a', marginTop: 6 }}>📅 {formatScheduled(selectedMatch.scheduledAt)}</div>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, color: '#8bc34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Maç Sonucu</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={() => { setMatchResult('winner'); setWinnerId(''); }}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: matchResult === 'winner' ? '#8bc34a' : '#2e4a2e', background: matchResult === 'winner' ? '#162a16' : '#111f11', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
                    🏆 Kazanan var
                  </div>
                  <div onClick={() => { setMatchResult('tie'); setWinnerId(''); }}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: matchResult === 'tie' ? '#8888ff' : '#2e4a2e', background: matchResult === 'tie' ? '#1a1a2a' : '#111f11', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600, color: matchResult === 'tie' ? '#8888ff' : '#fff' }}>
                    🤝 Berabere
                  </div>
                </div>
                {matchResult === 'tie' && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#1a1a2a', borderRadius: 8, border: '1px solid #3a3a6a', fontSize: 12, color: '#8888ff' }}>
                    Skor eşitse sıralama değişmez.
                  </div>
                )}
                {isAbandonedSplit && matchResult === 'winner' && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#1a1a2a', borderRadius: 8, border: '1px solid #3a3a6a', fontSize: 12, color: '#8888ff' }}>
                    ⚠ 1-1 berabere, tiebreak oynanmadı — sıralama değişmeyecek.
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#8bc34a', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Set Skorları</p>
                  <div onClick={() => { setOnlyOneSet(!onlyOneSet); setSet2({ team1: '', team2: '' }); setSet3({ team1: '', team2: '' }); }}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid', borderColor: onlyOneSet ? '#e09040' : '#2e4a2e', background: onlyOneSet ? '#2a1a0f' : '#111f11', color: onlyOneSet ? '#e09040' : '#4a7a4a', cursor: 'pointer', fontWeight: 600 }}>
                    {onlyOneSet ? '✓ Tek set' : 'Tek set mi?'}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#4a7a4a', marginBottom: 16, marginTop: 0 }}>
                  {onlyOneSet ? 'Sadece 1 set oynandı.' : 'En fazla 2 set. 1-1 berabere kalınırsa tiebreak oynanır (10\'a ilk ulaşan kazanır).'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <div style={{ width: 30 }}></div>
                  <div style={{ width: 72, fontSize: 11, color: '#4a7a4a', textAlign: 'center' }}>{selectedMatch.fromTeamName.split(' ')[0]}</div>
                  <div style={{ width: 18 }}></div>
                  <div style={{ width: 72, fontSize: 11, color: '#4a7a4a', textAlign: 'center' }}>{selectedMatch.toTeamName.split(' ')[0]}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                  <div style={{ width: 30, fontSize: 11, color: '#4a7a4a', fontWeight: 600 }}>S1</div>
                  <input type="number" min="0" max="7" value={set1.team1}
                    onChange={e => setSet1({ ...set1, team1: e.target.value })}
                    style={inputStyle(false)} />
                  <div style={{ fontSize: 18, color: '#2e4a2e', fontWeight: 700 }}>—</div>
                  <input type="number" min="0" max="7" value={set1.team2}
                    onChange={e => setSet1({ ...set1, team2: e.target.value })}
                    style={inputStyle(false)} />
                  {set1Winner() && set1Winner() !== 'tie' && (
                    <div style={{ fontSize: 11, color: '#8bc34a', fontWeight: 600 }}>
                      {set1Winner() === 'team1' ? selectedMatch.fromTeamName : selectedMatch.toTeamName} kazandı
                    </div>
                  )}
                  {set1Winner() === 'tie' && (
                    <div style={{ fontSize: 11, color: '#8888ff', fontWeight: 600 }}>Berabere</div>
                  )}
                </div>

                {!onlyOneSet && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                    <div style={{ width: 30, fontSize: 11, color: set1Winner() ? '#4a7a4a' : '#2e4a2e', fontWeight: 600 }}>S2</div>
                    <input type="number" min="0" max="7" value={set2.team1}
                      onChange={e => setSet2({ ...set2, team1: e.target.value })}
                      disabled={!set1Winner()}
                      style={inputStyle(!set1Winner())} />
                    <div style={{ fontSize: 18, color: '#2e4a2e', fontWeight: 700 }}>—</div>
                    <input type="number" min="0" max="7" value={set2.team2}
                      onChange={e => setSet2({ ...set2, team2: e.target.value })}
                      disabled={!set1Winner()}
                      style={inputStyle(!set1Winner())} />
                    {set2Winner() && set2Winner() !== 'tie' && (
                      <div style={{ fontSize: 11, color: '#8bc34a', fontWeight: 600 }}>
                        {set2Winner() === 'team1' ? selectedMatch.fromTeamName : selectedMatch.toTeamName} kazandı
                      </div>
                    )}
                    {set2Winner() === 'tie' && (
                      <div style={{ fontSize: 11, color: '#8888ff', fontWeight: 600 }}>Berabere</div>
                    )}
                  </div>
                )}

                {isTiebreak && (
                  <div>
                    <div style={{ padding: '10px 14px', background: '#1a2a0f', borderRadius: 8, border: '1px solid #4a5a2a', marginBottom: 12, fontSize: 12, color: '#c8e64a' }}>
                      ⚡ Setler 1-1 berabere, tiebreak skorlarını girin.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, fontSize: 11, color: '#c8e64a', fontWeight: 600 }}>TB</div>
                      <input type="number" min="0" max="10" value={set3.team1}
                        onChange={e => setSet3({ ...set3, team1: e.target.value })}
                        style={{ ...inputStyle(false), borderColor: '#4a5a2a' }} />
                      <div style={{ fontSize: 18, color: '#2e4a2e', fontWeight: 700 }}>—</div>
                      <input type="number" min="0" max="10" value={set3.team2}
                        onChange={e => setSet3({ ...set3, team2: e.target.value })}
                        style={{ ...inputStyle(false), borderColor: '#4a5a2a' }} />
                    </div>
                  </div>
                )}
              </div>

              {matchResult === 'winner' && !isAbandonedSplit && (
                <div style={{ marginBottom: 28 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 14, color: '#8bc34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kazanan</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div onClick={() => setWinnerId(selectedMatch.fromTeamId)}
                      style={{ flex: 1, padding: '16px 12px', borderRadius: 10, border: '1px solid', borderColor: winnerId === selectedMatch.fromTeamId ? '#8bc34a' : '#1e3a1e', background: winnerId === selectedMatch.fromTeamId ? '#162a16' : '#131f13', cursor: 'pointer', textAlign: 'center', fontSize: 14, fontWeight: 700 }}>
                      {winnerId === selectedMatch.fromTeamId && <div style={{ fontSize: 20, marginBottom: 4 }}>🏆</div>}
                      {selectedMatch.fromTeamName}
                    </div>
                    <div onClick={() => setWinnerId(selectedMatch.toTeamId)}
                      style={{ flex: 1, padding: '16px 12px', borderRadius: 10, border: '1px solid', borderColor: winnerId === selectedMatch.toTeamId ? '#8bc34a' : '#1e3a1e', background: winnerId === selectedMatch.toTeamId ? '#162a16' : '#131f13', cursor: 'pointer', textAlign: 'center', fontSize: 14, fontWeight: 700 }}>
                      {winnerId === selectedMatch.toTeamId && <div style={{ fontSize: 20, marginBottom: 4 }}>🏆</div>}
                      {selectedMatch.toTeamName}
                    </div>
                  </div>
                </div>
              )}

              <button onClick={handleSubmit} disabled={submitting}
                style={{ width: '100%', padding: 16, borderRadius: 10, border: 'none', background: isTie || isAbandonedSplit ? '#3a3a8a' : '#8bc34a', color: isTie || isAbandonedSplit ? '#fff' : '#0f1f0f', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                {submitting ? 'Gönderiliyor...' : isTie ? 'Berabere olarak kaydet' : isAbandonedSplit ? 'Tamamlanmadı olarak kaydet' : 'Gönder'}
              </button>

              <button onClick={() => { setSelectedMatch(null); setView('select-match'); setError(''); }}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #2e4a2e', background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#4a7a4a' }}>
                Geri
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}