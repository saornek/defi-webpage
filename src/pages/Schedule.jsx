import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../Firebase';

export default function Schedule() {
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'matchRequests'), snap => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsub2 = onSnapshot(collection(db, 'results'), snap => {
      setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub3 = onSnapshot(collection(db, 'teams'), snap => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  function formatDate(ts) {
    if (!ts) return null;
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return {
      day: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
      date: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
      isPast: d < new Date(),
      raw: d,
    };
  }

  function getResult(matchId) {
    return results.find(r => r.matchId === matchId);
  }

  const now = new Date();

  const upcoming = matches
    .filter(m => m.status === 'accepted' && m.scheduledAt)
    .filter(m => {
      const d = m.scheduledAt.seconds ? new Date(m.scheduledAt.seconds * 1000) : new Date(m.scheduledAt);
      return d >= now;
    })
    .sort((a, b) => (a.scheduledAt.seconds || 0) - (b.scheduledAt.seconds || 0));

  const pending = matches
    .filter(m => m.status === 'pending')
    .sort((a, b) => (a.requestedAt?.seconds || 0) - (b.requestedAt?.seconds || 0));

  const completed = matches
    .filter(m => m.status === 'completed' || m.status === 'cancelled')
    .sort((a, b) => (b.completedAt?.seconds || b.declinedAt?.seconds || 0) - (a.completedAt?.seconds || a.declinedAt?.seconds || 0));

  const filterStyle = (f) => ({
    padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
    background: filter === f ? '#8bc34a' : 'transparent',
    color: filter === f ? '#0f1f0f' : '#4a7a4a',
  });

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f1f0f', padding: 40, fontSize: 14, color: '#4a7a4a' }}>
      Yükleniyor...
    </div>
  );

  const shown = filter === 'upcoming' ? upcoming : filter === 'pending' ? pending : completed;

  return (
    <div style={{ minHeight: '100vh', background: '#0f1f0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px' }}>

        <div style={{ paddingTop: 48, paddingBottom: 24, borderBottom: '1px solid #1e3a1e' }}>
          <a href="/" style={{ fontSize: 13, color: '#4a7a4a', textDecoration: 'none' }}>← Sıralamalara geri dön</a>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '12px 0 4px' }}>
            Maç <span style={{ color: '#8bc34a' }}>Takvimi</span>
          </h1>
          <p style={{ fontSize: 13, color: '#4a7a4a', margin: 0 }}>Bütün Maçlar</p>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '20px 0', borderBottom: '1px solid #1e3a1e' }}>
          <button onClick={() => setFilter('upcoming')} style={filterStyle('upcoming')}>
            Gelecek ({upcoming.length})
          </button>
          <button onClick={() => setFilter('pending')} style={filterStyle('pending')}>
            Tarih Bekleyen ({pending.length})
          </button>
          <button onClick={() => setFilter('completed')} style={filterStyle('completed')}>
            Tamamlanan ({completed.length})
          </button>
        </div>

        <div style={{ paddingTop: 24, paddingBottom: 48 }}>
          {shown.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎾</div>
              <div style={{ fontSize: 14, color: '#4a7a4a' }}>
                {filter === 'upcoming' && 'Henüz planlanmış bir maç yok.'}
                {filter === 'pending' && 'Tarih atanması beklenen herhangi bir maç yok.'}
                {filter === 'completed' && 'Henüz tamamlanmış maç yok.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shown.map(match => {
                const scheduled = match.scheduledAt ? formatDate(match.scheduledAt) : null;
                const requested = match.requestedAt ? formatDate(match.requestedAt) : null;
                const result = getResult(match.id);
                const winnerName = result ? (result.winnerId === match.fromTeamId ? match.fromTeamName : match.toTeamName) : null;
                const loserName = result ? (result.winnerId === match.fromTeamId ? match.toTeamName : match.fromTeamName) : null;

                return (
                  <div key={match.id} style={{
                    borderRadius: 12, border: '1px solid',
                    borderColor: match.status === 'cancelled' ? '#6a2a2a' : match.status === 'completed' ? '#2e4a2e' : match.woRequested ? '#cc000044' : '#1e3a1e',
                    background: match.status === 'cancelled' ? '#1a0f0f' : match.status === 'completed' ? '#0f2a0f' : match.woRequested ? '#2a0f0f' : '#131f13',
                    overflow: 'hidden',
                  }}>

                    {filter === 'upcoming' && scheduled && (
                      <div style={{ display: 'flex' }}>
                        <div style={{ padding: '16px 20px', background: '#162a16', borderRight: '1px solid #1e3a1e', textAlign: 'center', minWidth: 80, flexShrink: 0 }}>
                          <div style={{ fontSize: 11, color: '#4a7a4a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {scheduled.day}
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#8bc34a', lineHeight: 1.1, marginTop: 2 }}>
                            {scheduled.date.split(' ')[0]}
                          </div>
                          <div style={{ fontSize: 11, color: '#4a7a4a', marginTop: 2 }}>
                            {scheduled.date.split(' ').slice(1).join(' ')}
                          </div>
                        </div>
                        <div style={{ padding: '16px 20px', flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                            {match.fromTeamName}
                            <span style={{ color: '#4a7a4a', fontWeight: 400, margin: '0 10px', fontSize: 13 }}>vs</span>
                            {match.toTeamName}
                          </div>
                          <div style={{ fontSize: 13, color: '#8bc34a', fontWeight: 600 }}>🕐 {scheduled.time}</div>
                          {match.woRequested && (
                            <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6, fontWeight: 600 }}>🔴 WO talep edildi</div>
                          )}
                        </div>
                      </div>
                    )}

                    {filter === 'pending' && (
                      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1a2e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⏳</div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                            {match.fromTeamName}
                            <span style={{ color: '#4a7a4a', fontWeight: 400, margin: '0 10px', fontSize: 13 }}>vs</span>
                            {match.toTeamName}
                          </div>
                          <div style={{ fontSize: 12, color: '#4a7a4a' }}>
                            Teklif {requested ? requested.date : ''} tarihinde gönderildi — cevap bekleniyor.
                          </div>
                        </div>
                      </div>
                    )}

                    {filter === 'completed' && (
                      <div style={{ padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: match.status === 'cancelled' ? '#2a0f0f' : '#162a16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                            {match.status === 'cancelled' ? '❌' : '✅'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 15, fontWeight: 700 }}>
                                {match.fromTeamName}
                                <span style={{ color: '#4a7a4a', fontWeight: 400, margin: '0 10px', fontSize: 13 }}>vs</span>
                                {match.toTeamName}
                              </div>
                              {match.status === 'cancelled' && (
                                <div style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: '#2a0f0f', color: '#ff6b6b', border: '1px solid #6a2a2a' }}>
                                  İptal
                                </div>
                              )}
                              {result?.isWO && (
                                <div style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: '#2a1a0f', color: '#e09040', border: '1px solid #6a4a2a' }}>
                                  WO
                                </div>
                              )}
                            </div>

                            {match.status === 'cancelled' ? (
                              <div style={{ fontSize: 12, color: '#4a7a4a' }}>Bu maç iptal edildi.</div>
                            ) : result ? (
                              <div style={{ background: '#162a16', borderRadius: 10, padding: '12px 16px', border: '1px solid #2e4a2e' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                  <div style={{ fontSize: 16 }}>🏆</div>
                                  <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#8bc34a' }}>{winnerName}</div>
                                    <div style={{ fontSize: 11, color: '#4a7a4a' }}>Kazanan</div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#0f1f0f', padding: '4px 12px', borderRadius: 20, border: '1px solid #2e4a2e' }}>
                                    {result.score}
                                    {result.isWO && <span style={{ color: '#ff6b6b', marginLeft: 6, fontSize: 11 }}>(WO)</span>}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#4a7a4a' }}>Kaybeden: {loserName}</div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: '#4a7a4a' }}>Sonuçlar daha girilmedi.</div>
                            )}

                            {scheduled && (
                              <div style={{ fontSize: 11, color: '#2e4a2e', marginTop: 8 }}>
                                Oynanma Tarihi: {scheduled.date}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}