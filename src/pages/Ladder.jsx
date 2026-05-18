import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../Firebase';

export default function Ladder() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'teams'), orderBy('position', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeams(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0f1f0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px' }}>

        <div style={{ paddingTop: 48, paddingBottom: 32, borderBottom: '1px solid #1e3a1e', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: '#4caf50', marginBottom: 8, textTransform: 'uppercase' }}>
            Double ve Mix
          </div>
          <h1 style={{ fontSize: 56, fontWeight: 800, margin: '0 0 24px 0', lineHeight: 1 }}>
            Biz Bize <span style={{ color: '#8bc34a' }}>Defi 2026</span>
          </h1>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <a href="/schedule" style={{
              flex: 1, maxWidth: 200, textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px 8px', borderRadius: 6, background: 'transparent',
              color: '#fff', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em',
              border: '1px solid #2e4a2e'
            }}>
              Takvim
            </a>
            <a href="/challenge" style={{
              flex: 1, maxWidth: 200, textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px 8px', borderRadius: 6, background: '#8bc34a',
              color: '#0f1f0f', fontSize: 13, fontWeight: 700,
              textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em'
            }}>
              Maç Teklifi
            </a>
            <a href="/result" style={{
              flex: 1, maxWidth: 200, textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px 8px', borderRadius: 6, background: 'transparent',
              color: '#fff', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em',
              border: '1px solid #2e4a2e'
            }}>
              Sonuç Bildir
            </a>
          </div>
        </div>

        <div style={{ paddingTop: 32 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 4, height: 24, background: '#8bc34a', borderRadius: 2 }}></div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Sıralama Tablosu</h2>
            <div style={{ fontSize: 12, color: '#4a7a4a' }}>
              {teams.filter(t => t.status === 'active').length} aktif takım
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#4a7a4a', fontSize: 14 }}>Yükleniyor...</div>
          ) : teams.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎾</div>
              <div style={{ fontSize: 14, color: '#4a7a4a' }}>Henüz takım yok</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {teams.map((team, index) => (
                <div key={team.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '0 20px',
                  height: team.status !== 'active' ? 72 : 64,
                  borderRadius: 10,
                  background: team.status !== 'active'
                    ? 'repeating-linear-gradient(45deg, #111f11, #111f11 6px, #141f14 6px, #141f14 12px)'
                    : index === 0 ? '#162a16' : '#131f13',
                  border: '1px solid',
                  borderColor: team.status !== 'active' ? '#e07b0044' : index === 0 ? '#3a6a3a' : '#1e3a1e',
                  opacity: team.status === 'active' ? 1 : 0.75,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700,
                    background: index === 0 ? '#8bc34a' : '#1a2e1a',
                    color: index === 0 ? '#0f1f0f' : '#8bc34a',
                  }}>
                    {team.position}
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: team.status !== 'active' ? '#a0b8a0' : '#fff', textAlign: 'center' }}>
                      {team.name}
                    </div>
                    {team.status !== 'active' && (
                      <div style={{ fontSize: 10, color: '#e09040', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>
                        ⏸ Pasif — maç teklifine kapalı
                      </div>
                    )}
                    {team.activeChallenge && team.status === 'active' && (
                      <div style={{ fontSize: 10, color: '#8bc34a', fontWeight: 500, textAlign: 'center' }}>
                        ⚡ Aktif maç devam ediyor
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {team.status !== 'active' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#e09040', background: '#e09040' + '22', padding: '3px 10px', borderRadius: 20, border: '1px solid #e09040' + '44', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Pasif
                      </div>
                    )}
                    {index === 0 && team.status === 'active' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8bc34a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Lider
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ paddingTop: 40, paddingBottom: 40, marginTop: 32, borderTop: '1px solid #1e3a1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#2e4a2e' }}>Canlı güncellemelerle sizlerle</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <a href="/login" style={{ fontSize: 12, color: '#2e4a2e', textDecoration: 'none' }}>Admin</a>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#1e3a1e' }}>Made by Selin Alara Ornek</div>
        <div style={{ fontSize: 11, color: '#1e3a1e' }}>Beta Versiyonu</div>
        <div style={{ fontSize: 11, color: '#1e3a1e' }}>2026</div>

      </div>
    </div>
  );
}