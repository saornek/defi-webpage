import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../Firebase';

export default function Ladder() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'teams'), orderBy('position', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeams(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const activeTeams = teams.filter(t => t.status !== 'archived');
  const archivedTeams = teams.filter(t => t.status === 'archived');

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
          ) : activeTeams.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎾</div>
              <div style={{ fontSize: 14, color: '#4a7a4a' }}>Henüz takım yok</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeTeams.map((team, index) => (
                <div key={team.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '0 20px',
                  height: team.status !== 'active' ? 72 : team.activeChallenge ? 72 : 64,
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
                        ⚡ Teklif edilen veya planlanan maç var
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

        {archivedTeams.length > 0 && (
          <div style={{ paddingTop: 36 }}>
            <button
              onClick={() => setShowArchived(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '14px 20px', borderRadius: 10, cursor: 'pointer',
                background: '#101614', border: '1px solid #2a323a', color: '#8a9aaa',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              }}>
              <span style={{ fontSize: 15 }}>📦</span>
              {showArchived ? 'Arşivlenmiş takımları gizle' : 'Arşivlenmiş takımları göster'}
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6a7a8a', background: '#6a7a8a22', padding: '2px 8px', borderRadius: 20, border: '1px solid #6a7a8a44' }}>
                {archivedTeams.length}
              </span>
              <span style={{ fontSize: 10, color: '#6a7a8a', transform: showArchived ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
            </button>

            {showArchived && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#4a5a6a', textAlign: 'center', marginBottom: 4 }}>
                Bu takımlar artık oynamıyor — sıralama tablosunda yer almaz.
              </div>
              {archivedTeams.map((team) => (
                <div key={team.id} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', height: 56,
                  borderRadius: 10, background: '#101614', border: '1px solid #2a323a', opacity: 0.6,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, background: '#1a222a', color: '#6a7a8a',
                  }}>
                    📦
                  </div>
                  <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#8a9aaa', textAlign: 'center' }}>
                    {team.name}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6a7a8a', background: '#6a7a8a22', padding: '3px 10px', borderRadius: 20, border: '1px solid #6a7a8a44', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Arşiv
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        <div style={{ paddingTop: 40, paddingBottom: 40, marginTop: 32, borderTop: '1px solid #1e3a1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#2e4a2e' }}>Canlı güncellemelerle sizlerle</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <a href="/login" style={{ fontSize: 12, color: '#2e4a2e', textDecoration: 'none' }}>Admin</a>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 733 496" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ height: 15, width: 'auto', color: '#1e3a1e', flexShrink: 0 }}><g transform="translate(-351.268352,793.400371) scale(0.100000,-0.100000)" fill="currentColor" stroke="none"> <path d="M7090 7927 c-19 -6 -190 -62 -379 -124 -320 -106 -362 -123 -585 -233 l-241 -118 -82 -99 c-152 -184 -426 -508 -655 -775 -125 -146 -228 -274 -228 -284 0 -9 23 -69 51 -133 74 -166 293 -648 384 -841 42 -91 131 -280 196 -420 l119 -256 -10 -114 c-29 -335 -57 -556 -101 -797 -16 -89 -29 -182 -29 -207 0 -61 35 -170 77 -239 36 -59 38 -83 11 -119 -12 -16 -52 -19 -397 -28 -408 -10 -415 -11 -441 -61 -6 -11 -8 -33 -5 -50 14 -64 -143 -59 1998 -59 l1948 0 24 25 c40 39 30 96 -21 123 -14 7 -121 14 -290 18 -352 8 -331 4 -359 85 -45 135 -130 252 -223 307 -26 15 -113 50 -196 77 l-149 50 -139 175 c-76 96 -143 184 -149 196 -9 17 0 38 60 136 39 63 71 119 71 124 0 5 -21 22 -47 38 -191 117 -292 176 -302 176 -27 0 -405 -513 -396 -537 4 -10 44 -52 89 -93 44 -41 151 -139 237 -218 154 -141 156 -143 169 -200 7 -31 28 -99 46 -151 19 -51 34 -95 34 -97 0 -2 -67 -4 -148 -4 l-148 0 -18 51 c-47 129 -137 204 -301 249 -44 12 -129 41 -190 63 -103 38 -114 45 -177 110 -38 38 -68 73 -68 78 0 6 169 236 376 512 416 557 401 531 389 672 -14 155 -60 303 -216 694 -97 243 -118 307 -90 275 167 -190 683 -916 923 -1299 l57 -90 228 -114 c125 -63 365 -181 532 -261 l305 -147 11 -50 c48 -213 277 -347 445 -260 l51 26 134 -67 c128 -63 135 -68 135 -97 1 -52 20 -116 60 -203 151 -322 545 -390 796 -137 79 79 96 111 71 130 -9 6 -112 25 -228 41 l-212 29 -30 64 c-54 115 -48 200 22 309 66 101 53 99 301 52 130 -24 217 -37 223 -31 12 12 -7 72 -46 140 -124 221 -417 310 -646 195 -67 -33 -167 -122 -199 -176 -9 -15 -20 -28 -25 -28 -5 0 -65 23 -133 52 -124 52 -124 52 -135 92 -40 153 -230 286 -409 286 l-55 0 -96 98 c-100 102 -278 294 -392 424 -76 86 -67 63 -157 407 l-61 235 -67 90 c-51 70 -299 391 -365 474 -17 21 6 29 121 43 64 7 106 17 109 25 2 7 -23 47 -57 89 -33 43 -59 82 -57 88 2 6 52 27 113 47 115 39 130 52 94 85 -11 10 -20 23 -20 29 0 6 60 41 134 78 l134 67 12 53 c45 188 152 425 260 576 33 46 60 89 60 96 0 19 -762 337 -1230 514 -165 62 -167 62 -210 49z"/> <path d="M8778 7551 c-83 -27 -184 -129 -241 -244 -64 -131 -106 -287 -77 -287 5 0 24 21 41 48 86 125 181 222 258 262 130 67 292 -138 386 -490 37 -139 38 -136 -40 -144 -76 -8 -85 -4 -85 32 0 44 -48 210 -81 279 -37 77 -89 133 -125 133 -18 0 -42 -16 -78 -54 -62 -63 -113 -162 -181 -351 -26 -71 -61 -156 -78 -187 -17 -31 -29 -59 -27 -61 9 -8 213 -75 426 -141 340 -105 478 -165 612 -266 171 -128 267 -307 249 -461 -7 -56 -64 -189 -81 -189 -6 0 -29 32 -51 71 -155 277 -484 421 -930 406 -163 -5 -423 -33 -438 -47 -20 -18 115 -340 200 -478 83 -134 98 -151 185 -203 46 -28 161 -103 256 -167 123 -82 178 -113 187 -106 7 5 48 39 90 76 128 111 254 166 401 176 l81 5 26 -94 c14 -52 25 -94 24 -94 -1 0 -24 -11 -52 -25 -58 -29 -95 -84 -95 -142 l0 -37 -37 6 c-21 3 -77 19 -125 35 -159 54 -242 23 -146 -55 97 -78 144 -90 470 -113 71 -6 81 -4 122 20 90 53 109 135 57 242 -32 66 -81 282 -81 360 0 123 54 301 122 407 48 73 51 82 60 170 30 317 -113 725 -340 968 -65 70 -184 162 -283 219 -54 31 -64 42 -87 95 -135 306 -334 477 -494 426z m495 -1992 c85 -44 69 -161 -24 -175 -52 -9 -103 37 -103 91 0 66 71 113 127 84z"/> <path d="M10135 6793 c-66 -9 -260 -44 -263 -48 -3 -2 16 -39 41 -82 59 -100 103 -205 131 -313 12 -47 26 -85 31 -85 31 0 350 478 343 515 -3 12 -24 15 -128 16 -69 1 -138 -1 -155 -3z"/> <path d="M4750 5609 c-84 -166 -144 -275 -253 -457 l-79 -133 71 -102 c185 -266 308 -511 402 -804 12 -40 28 -74 35 -77 16 -6 122 118 195 228 67 102 144 248 184 353 l28 72 -223 483 c-123 266 -232 504 -243 531 -11 26 -26 47 -33 47 -7 0 -45 -64 -84 -141z"/> <path d="M4064 4676 c-66 -44 -168 -112 -227 -150 -129 -82 -132 -86 -187 -222 -76 -191 -157 -572 -127 -600 17 -17 403 -38 537 -31 171 10 325 47 473 114 42 20 77 41 77 48 0 31 -108 342 -166 476 -77 179 -226 450 -247 448 -7 -1 -66 -38 -133 -83z"/> <path d="M3541 3103 c-35 -29 -38 -77 -8 -107 25 -25 31 -26 136 -26 123 0 156 8 173 44 14 33 -4 79 -38 95 -42 19 -238 14 -263 -6z"/> <path d="M4082 3100 c-29 -27 -29 -83 -2 -110 19 -19 33 -20 204 -20 170 0 185 1 210 21 34 27 36 79 4 109 -20 19 -34 20 -208 20 -174 0 -188 -1 -208 -20z"/> <path d="M9005 3095 c-14 -13 -25 -36 -25 -50 0 -14 11 -37 25 -50 23 -24 29 -25 154 -25 71 0 141 4 154 9 30 12 48 57 35 90 -16 45 -34 50 -181 51 -133 0 -139 -1 -162 -25z"/> <path d="M10563 3108 c-48 -23 -51 -103 -4 -127 11 -6 67 -11 126 -11 99 0 107 2 130 25 14 13 25 36 25 50 0 14 -11 37 -25 50 -23 23 -31 25 -127 24 -57 0 -113 -5 -125 -11z"/> </g></svg>
          <span style={{ fontSize: 11, color: '#1e3a1e' }}>Made by Selin Alara Ornek</span>
        </div>
        <div style={{ fontSize: 11, color: '#1e3a1e' }}>Beta Versiyonu</div>
        <div style={{ fontSize: 11, color: '#1e3a1e' }}>2026</div>

      </div>
    </div>
  );
}