import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../Firebase';

export default function Challenge() {
  const [teams, setTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [eligibleTargets, setEligibleTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [requests, setRequests] = useState([]);
  const [view, setView] = useState('select-team');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [acceptingRequest, setAcceptingRequest] = useState(null);
  const [matchDate, setMatchDate] = useState('');
  const [matchHour, setMatchHour] = useState('');
  const [matchMin, setMatchMin] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'teams'), orderBy('position', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeams(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'matchRequests'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
    });
    return unsubscribe;
  }, []);

  function getEligibleTargets(team, allTeams) {
    const activeTeams = allTeams.filter(t => t.status === 'active');
    const myActiveIndex = activeTeams.findIndex(t => t.id === team.id);
    const targetsAbove = activeTeams.slice(Math.max(0, myActiveIndex - 3), myActiveIndex);
    return targetsAbove.reverse();
  }

  function daysSince(timestamp) {
    if (!timestamp) return 0;
    const sent = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return Math.floor((new Date() - sent) / (1000 * 60 * 60 * 24));
  }

  function formatScheduled(ts) {
    if (!ts) return null;
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' saat ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function handleSelectMyTeam(team) {
    if (team.status !== 'active') return;
    const pendingIncoming = requests.filter(r => r.toTeamId === team.id && r.status === 'pending');
    const hasSentChallenge = requests.some(
      r => r.fromTeamId === team.id && ['pending', 'accepted', 'scheduled'].includes(r.status)
    );
    if (hasSentChallenge && pendingIncoming.length === 0) {
      setError('Takımınızın planlanan bir maçı var.');
      return;
    }
    setMyTeam(team);
    setEligibleTargets(getEligibleTargets(team, teams));
    setError('');
    setView('select-target');
  }

  async function handleSendChallenge() {
    if (!myTeam || !selectedTarget) return;
    setSending(true);
    setError('');
    try {
      await addDoc(collection(db, 'matchRequests'), {
        fromTeamId: myTeam.id,
        fromTeamName: myTeam.name,
        toTeamId: selectedTarget.id,
        toTeamName: selectedTarget.name,
        status: 'pending',
        requestedAt: serverTimestamp(),
        expiresAt: null,
        scheduledAt: null,
        woRequested: false,
        woRequestedBy: null,
        woRequestedAt: null,
      });
      await updateDoc(doc(db, 'teams', myTeam.id), { activeChallenge: 'pending' });
      setSuccess(selectedTarget.name + ' takımına teklif gönderildi!');
      setView('success');
    } catch (err) {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    }
    setSending(false);
  }

  async function handleConfirmAccept() {
    if (!matchDate || !matchHour || !matchMin) {
      setError('Maç için tarih ve saat belirleyin.');
      return;
    }
    const scheduledAt = new Date(matchDate + 'T' + matchHour + ':' + matchMin);
    try {
      await updateDoc(doc(db, 'matchRequests', acceptingRequest.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        scheduledAt: scheduledAt,
      });
      await updateDoc(doc(db, 'teams', acceptingRequest.toTeamId), { activeChallenge: acceptingRequest.id });
      await updateDoc(doc(db, 'teams', acceptingRequest.fromTeamId), { activeChallenge: acceptingRequest.id });
      await addDoc(collection(db, 'auditLog'), {
        action: 'challenge_accepted',
        actor: acceptingRequest.toTeamName,
        targetId: acceptingRequest.id,
        payload: {
          from: acceptingRequest.fromTeamName,
          to: acceptingRequest.toTeamName,
          scheduledAt: scheduledAt.toISOString(),
        },
        createdAt: serverTimestamp(),
      });
      setAcceptingRequest(null);
      setMatchDate('');
      setMatchHour('');
      setMatchMin('');
      setSuccess('Maç teklifi kabul edildi. Maç ' + formatScheduled({ seconds: scheduledAt.getTime() / 1000 }) + ' tarihinde oynanacak.');
      setView('success');
    } catch (err) {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    }
  }

  async function handleRequestWO(request) {
    try {
      await updateDoc(doc(db, 'matchRequests', request.id), {
        woRequested: true,
        woRequestedBy: request.fromTeamId,
        woRequestedByName: request.fromTeamName,
        woRequestedAt: serverTimestamp(),
        woReason: 'no_date_set',
      });
      await addDoc(collection(db, 'auditLog'), {
        action: 'wo_requested',
        actor: request.fromTeamName,
        targetId: request.id,
        payload: { from: request.fromTeamName, to: request.toTeamName, reason: 'Teklif edilen takım 3 gün içinde bir tarih belirlemedi.' },
        createdAt: serverTimestamp(),
      });
      setSuccess('WO talebi gönderildi. Admin geri dönüş sağlayacaktır.');
      setView('success');
    } catch (err) {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    }
  }

  const pendingIncoming = myTeam
    ? requests.filter(r => r.toTeamId === myTeam.id && r.status === 'pending')
    : [];

  const mySentChallenges = myTeam
    ? requests.filter(r => r.fromTeamId === myTeam.id && r.status === 'pending')
    : [];

  const myActiveChallenge = myTeam
    ? requests.find(r => (r.fromTeamId === myTeam.id || r.toTeamId === myTeam.id) && ['pending', 'accepted'].includes(r.status))
    : null;

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #2e4a2e', background: '#111f11',
    color: '#fff', fontSize: 14, boxSizing: 'border-box',
  };

  const selectStyle = {
    flex: 1, padding: '10px 12px', borderRadius: 8,
    border: '1px solid #2e4a2e', background: '#111f11',
    color: '#fff', fontSize: 14,
  };

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
            {acceptingRequest ? 'Maç saati belirle' : 'Maç Teklifi'}
          </h1>
          <p style={{ fontSize: 13, color: '#4a7a4a', margin: 0 }}>
            {acceptingRequest ? 'Maçı kabul etmeden önce bir tarih ve saat seçin.' : 'Maç teklifi gönderin veya tekliflere yanıt verin.'}
          </p>
        </div>

        <div style={{ paddingTop: 32 }}>

          {error && (
            <div style={{ background: '#2a0f0f', border: '1px solid #cc000044', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#ff6b6b' }}>
              {error}
            </div>
          )}

          {view === 'success' && (
            <div style={{ background: '#0f2a0f', border: '1px solid #4caf5044', borderRadius: 8, padding: '20px', fontSize: 14, color: '#8bc34a' }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>{success}</div>
              <a href="/" style={{ fontSize: 13, color: '#8bc34a', textDecoration: 'none', fontWeight: 600 }}>Sıralamalara geri dön →</a>
            </div>
          )}

          {acceptingRequest && (
            <div>
              <div style={{ padding: '16px', background: '#162a16', borderRadius: 10, border: '1px solid #2e4a2e', marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: '#4caf50', marginBottom: 4 }}>Maç teklifi aldığınız takım:</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{acceptingRequest.fromTeamName}</div>
                <div style={{ fontSize: 12, color: '#e09040', marginTop: 6 }}>
                  ⚠ Maç tarihini 3 gün içinde belirlemeniz gerekiyor, aksi takdirde rakip WO talep edebilir.
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#4a7a4a', marginBottom: 6 }}>Maç Tarihi</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={e => setMatchDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#4a7a4a', marginBottom: 6 }}>Maç Saati</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={matchHour} onChange={e => setMatchHour(e.target.value)} style={selectStyle}>
                    <option value=''>Saat</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <select value={matchMin} onChange={e => setMatchMin(e.target.value)} style={selectStyle}>
                    <option value=''>Dakika</option>
                    {['00', '15', '30', '45'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button onClick={handleConfirmAccept}
                style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: '#8bc34a', color: '#0f1f0f', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Teklifi Kabul Et
              </button>
              <button onClick={() => { setAcceptingRequest(null); setError(''); }}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #2e4a2e', background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#4a7a4a' }}>
                İptal
              </button>
            </div>
          )}

          {!acceptingRequest && view === 'select-team' && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 12, color: '#8bc34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hangi takımdasın?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {teams.filter(t => t.status === 'active').map(team => (
                  <div key={team.id} onClick={() => handleSelectMyTeam(team)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 10, border: '1px solid #1e3a1e', background: '#131f13', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#8bc34a'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#1e3a1e'}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a2e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#8bc34a', flexShrink: 0 }}>
                      {team.position}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{team.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!acceptingRequest && view === 'select-target' && myTeam && (
            <div>

              <div style={{ marginBottom: 20, padding: '16px', background: '#162a16', borderRadius: 10, border: '1px solid #2e4a2e' }}>
                <div style={{ fontSize: 11, color: '#4caf50', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Oynayan takım</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{myTeam.name} (#{myTeam.position})</div>

                {myActiveChallenge ? (() => {
                  const isSender = myActiveChallenge.fromTeamId === myTeam.id;
                  const opponent = isSender ? myActiveChallenge.toTeamName : myActiveChallenge.fromTeamName;
                  const days = daysSince(myActiveChallenge.requestedAt);
                  const scheduled = myActiveChallenge.scheduledAt ? formatScheduled(myActiveChallenge.scheduledAt) : null;
                  const daysLeft = 3 - days;
                  return (
                    <div>
                      <div style={{ fontSize: 12, color: '#4a7a4a', marginBottom: 6 }}>Aktif maçınız</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        {isSender ? 'Maç teklifini gönderdiğiniz takım:' : 'Size maç teklifi gönderen takım:'} {opponent}
                      </div>
                      <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, marginBottom: scheduled ? 8 : 0,
                        background: myActiveChallenge.status === 'accepted' ? '#0f2a0f' : '#1a2a0f',
                        color: myActiveChallenge.status === 'accepted' ? '#8bc34a' : '#c8e64a',
                        border: '1px solid',
                        borderColor: myActiveChallenge.status === 'accepted' ? '#3a6a3a' : '#4a5a2a',
                      }}>
                        {myActiveChallenge.status === 'pending'
                          ? '⏳ Tarih belirlemeniz gerekiyor.'
                          : '✅ Teklif kabul edildi. Maç tarihi belirlendi.'}
                      </div>
                      {scheduled && (
                        <div style={{ fontSize: 12, color: '#8bc34a', marginTop: 4 }}>
                          📅 {scheduled}
                        </div>
                      )}
                      {myActiveChallenge.status === 'pending' && isSender && days >= 3 && !myActiveChallenge.woRequested && (
                        <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6 }}>
                          ⚠ Teklifiniz üzerinden {days} gün geçti — aşağıdan WO talebi isteyebilirsiniz.
                        </div>
                      )}
                      {myActiveChallenge.status === 'pending' && isSender && days < 3 && (
                        <div style={{ fontSize: 11, color: '#e09040', marginTop: 6 }}>
                          {opponent} tarih belirlemesi için kalan gün: {daysLeft}
                        </div>
                      )}
                      {myActiveChallenge.status === 'pending' && !isSender && (
                        <div style={{ fontSize: 11, color: '#e09040', marginTop: 6 }}>
                          ⚠ Maç tarihi belirlemen gerekiyor — {daysLeft > 0 ? daysLeft + ' gün kaldı' : 'süre doldu.'}
                        </div>
                      )}
                      {myActiveChallenge.woRequested && (
                        <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6 }}>
                          🔴 WO talep edildi — admin incelemesi bekleniyor.
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div style={{ fontSize: 12, color: '#4a7a4a' }}>Henüz maç teklifi yok.</div>
                )}
              </div>

              {pendingIncoming.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, color: '#8bc34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Gelen teklifler
                  </p>
                  {pendingIncoming.map(req => {
                    const days = daysSince(req.requestedAt);
                    const daysLeft = 3 - days;
                    return (
                      <div key={req.id} style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid #3a6a3a', background: '#162a16', marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{req.fromTeamName} seninle maç yapmak istiyor.</div>
                        <div style={{ fontSize: 12, color: daysLeft <= 1 ? '#ff6b6b' : '#e09040', marginBottom: 10 }}>
                          ⚠ {daysLeft > 0 ? 'Maç tarihi belirlemen için ' + daysLeft + ' gün kaldı.' : 'Teklif süresi doldu — teklif eden takım WO talep edebilir.'}
                        </div>
                        <button onClick={() => { setAcceptingRequest(req); setError(''); }}
                          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#8bc34a', color: '#0f1f0f', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          Tarih Belirle
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {mySentChallenges.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, color: '#8bc34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Gönderdiğiniz teklifler
                  </p>
                  {mySentChallenges.map(req => {
                    const days = daysSince(req.requestedAt);
                    const canRequestWO = days >= 3 && !req.woRequested;
                    return (
                      <div key={req.id} style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid #2e4a2e', background: '#131f13', marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                          {req.toTeamName} takımının tarih belirlemesi bekleniyor
                        </div>
                        <div style={{ fontSize: 12, color: days >= 3 ? '#ff6b6b' : '#4a7a4a', marginBottom: canRequestWO ? 10 : 0 }}>
                          {days === 0 ? 'Bugün gönderildi.' : days + ' gün önce gönderildi.'}
                          {days >= 3 && !req.woRequested && ' — Teklif süresi doldu'}
                          {req.woRequested && ' — WO talep edildi, admin incelemesi bekleniyor.'}
                        </div>
                        {canRequestWO && (
                          <button onClick={() => handleRequestWO(req)}
                            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#cc0000', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            WO talep et
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, color: '#8bc34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Rakibini belirle
              </p>

              {eligibleTargets.length === 0 ? (
                <div style={{ padding: 24, borderRadius: 10, border: '1px solid #1e3a1e', fontSize: 14, color: '#4a7a4a', textAlign: 'center' }}>
                  Maç teklifi edebileceğiniz bir takım yok. Sıralamada 1. olabilirsiniz veya üstünüzdeki tüm takımlar pasif durumda olabilir.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {eligibleTargets.map(team => (
                    <div key={team.id} onClick={() => setSelectedTarget(team)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 10, border: '1px solid', borderColor: selectedTarget?.id === team.id ? '#8bc34a' : '#1e3a1e', background: selectedTarget?.id === team.id ? '#162a16' : '#131f13', cursor: 'pointer' }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a2e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#8bc34a', flexShrink: 0 }}>
                        {team.position}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{team.name}</div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTarget && (
                <div style={{ marginTop: 20 }}>
                  <button onClick={handleSendChallenge} disabled={sending}
                    style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: '#8bc34a', color: '#0f1f0f', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: sending ? 0.7 : 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {sending ? 'Gönderiliyor...' : selectedTarget.name + ' takımına maç teklifi gönder'}
                  </button>
                  <button onClick={() => { setMyTeam(null); setView('select-team'); setSelectedTarget(null); }}
                    style={{ width: '100%', marginTop: 8, padding: 12, borderRadius: 10, border: '1px solid #2e4a2e', background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#4a7a4a' }}>
                    Geri
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ paddingTop: 40, paddingBottom: 40, marginTop: 32, borderTop: '1px solid #1e3a1e' }}>
          <a href="/" style={{ fontSize: 12, color: '#2e4a2e', textDecoration: 'none' }}>← Sıralamalara geri dön</a>
        </div>

      </div>
    </div>
  );
}