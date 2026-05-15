import { useState } from 'react';
import { collection, addDoc, updateDoc, getDocs, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../Firebase';

export default function WOPanel({ teams, matches }) {
  const [applying, setApplying] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const woRequests = matches.filter(m => m.woRequested && m.status !== 'completed' && m.status !== 'cancelled');
  const overdueMatches = matches.filter(m => {
    if (m.status !== 'accepted' || !m.scheduledAt) return false;
    const scheduled = m.scheduledAt.seconds ? new Date(m.scheduledAt.seconds * 1000) : new Date(m.scheduledAt);
    return scheduled < new Date() && !m.woRequested;
  });

  async function recalcAfterWO(winnerId, loserId) {
    const teamsSnapshot = await getDocs(query(collection(db, 'teams'), orderBy('position', 'asc')));
    const allTeams = teamsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const winnerTeam = allTeams.find(t => t.id === winnerId);
    const loserTeam = allTeams.find(t => t.id === loserId);
    if (!winnerTeam || !loserTeam) return;
    if (winnerTeam.position > loserTeam.position) {
      const updates = allTeams
        .filter(t => t.position >= loserTeam.position && t.position < winnerTeam.position && t.id !== winnerId)
        .map(t => updateDoc(doc(db, 'teams', t.id), { position: t.position + 1 }));
      updates.push(updateDoc(doc(db, 'teams', winnerId), { position: loserTeam.position }));
      await Promise.all(updates);
    }
  }

  async function handleApplySingleWO(match, winnerId) {
    const loserId = winnerId === match.fromTeamId ? match.toTeamId : match.fromTeamId;
    const winnerName = winnerId === match.fromTeamId ? match.fromTeamName : match.toTeamName;
    const loserName = loserId === match.fromTeamId ? match.fromTeamName : match.toTeamName;
    setApplying(match.id);
    try {
      await addDoc(collection(db, 'results'), {
        matchId: match.id, fromTeamId: match.fromTeamId, toTeamId: match.toTeamId,
        fromTeamName: match.fromTeamName, toTeamName: match.toTeamName,
        score: '6-0, 6-0', winnerId, loserId, isWO: true, enteredAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'matchRequests', match.id), { status: 'completed', completedAt: serverTimestamp() });
      await updateDoc(doc(db, 'teams', match.fromTeamId), { activeChallenge: null });
      await updateDoc(doc(db, 'teams', match.toTeamId), { activeChallenge: null });
      await recalcAfterWO(winnerId, loserId);
      await addDoc(collection(db, 'auditLog'), {
        action: 'wo_applied', actor: 'admin', targetId: match.id,
        payload: { winner: winnerName, loser: loserName, score: '6-0, 6-0' }, createdAt: serverTimestamp(),
      });
      setSuccess('WO applied — ' + winnerName + ' wins 6-0 / 6-0. Ladder updated.');
      setTimeout(() => setSuccess(''), 4000);
    } catch { setError('Something went wrong.'); }
    setApplying(null);
  }

  async function handleDoubleWO(match) {
    setApplying(match.id);
    try {
      const team1 = teams.find(t => t.id === match.fromTeamId);
      const team2 = teams.find(t => t.id === match.toTeamId);
      const updates = [];
      if (team1) updates.push(updateDoc(doc(db, 'teams', match.fromTeamId), { position: team1.position + 1, activeChallenge: null }));
      if (team2) updates.push(updateDoc(doc(db, 'teams', match.toTeamId), { position: team2.position + 1, activeChallenge: null }));
      updates.push(updateDoc(doc(db, 'matchRequests', match.id), { status: 'cancelled', completedAt: serverTimestamp() }));
      await Promise.all(updates);
      await addDoc(collection(db, 'auditLog'), {
        action: 'double_wo_applied', actor: 'admin', targetId: match.id,
        payload: { team1: match.fromTeamName, team2: match.toTeamName }, createdAt: serverTimestamp(),
      });
      setSuccess('Double WO — both teams drop 1 position. Match cancelled.');
      setTimeout(() => setSuccess(''), 4000);
    } catch { setError('Something went wrong.'); }
    setApplying(null);
  }

  async function handleGrantPostponement(match) {
    try {
      await updateDoc(doc(db, 'matchRequests', match.id), { postponed: true, postponedAt: serverTimestamp(), woRequested: false });
      await addDoc(collection(db, 'auditLog'), {
        action: 'postponement_granted', actor: 'admin', targetId: match.id,
        payload: { from: match.fromTeamName, to: match.toTeamName }, createdAt: serverTimestamp(),
      });
      setSuccess('Postponement granted.');
      setTimeout(() => setSuccess(''), 4000);
    } catch { setError('Something went wrong.'); }
  }

  function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const btn = (color) => ({
    padding: '7px 14px', borderRadius: 8, border: 'none',
    background: color || '#8bc34a',
    color: color === '#cc0000' || color === '#e09040' ? '#fff' : '#0f1f0f',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  });

  const outlineBtn = {
    padding: '7px 14px', borderRadius: 8, border: '1px solid #2e4a2e',
    background: 'transparent', color: '#4a7a4a', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div>
      {success && <div style={{ background: '#0f2a0f', border: '1px solid #4caf5044', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#8bc34a' }}>{success}</div>}
      {error && <div style={{ background: '#2a0f0f', border: '1px solid #cc000044', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ff6b6b' }}>{error}</div>}

      {woRequests.length === 0 && overdueMatches.length === 0 && (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 14, color: '#4a7a4a' }}>No WO requests or overdue matches.</div>
        </div>
      )}

      {woRequests.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            WO Requests ({woRequests.length})
          </div>
          {woRequests.map(match => (
            <div key={match.id} style={{ padding: '18px 20px', borderRadius: 12, border: '1px solid #6a2a2a', background: '#1a0f0f', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{match.fromTeamName} vs {match.toTeamName}</div>
              <div style={{ fontSize: 12, color: '#4a7a4a', marginBottom: 2 }}>
                Requested by: {match.woRequestedByName}
              </div>
              <div style={{ fontSize: 12, color: '#4a7a4a', marginBottom: 14 }}>
                {match.woReason === 'no_date_set' ? 'Defending team did not set a date within 3 days' : match.woReason}
              </div>
              <div style={{ fontSize: 12, color: '#4a7a4a', marginBottom: 14 }}>
                Requested: {formatDate(match.woRequestedAt)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ff6b6b', marginBottom: 10 }}>Apply WO:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button onClick={() => handleApplySingleWO(match, match.fromTeamId)} disabled={applying === match.id} style={btn()}>
                  {match.fromTeamName} wins (6-0 / 6-0)
                </button>
                <button onClick={() => handleApplySingleWO(match, match.toTeamId)} disabled={applying === match.id} style={btn()}>
                  {match.toTeamName} wins (6-0 / 6-0)
                </button>
                <button onClick={() => handleDoubleWO(match)} disabled={applying === match.id} style={btn('#e09040')}>
                  Double WO — both drop 1
                </button>
                {!match.postponed && (
                  <button onClick={() => handleGrantPostponement(match)} disabled={applying === match.id} style={outlineBtn}>
                    Grant postponement
                  </button>
                )}
              </div>
              {match.postponed && (
                <div style={{ fontSize: 11, color: '#e09040', marginTop: 10 }}>⚠ Postponement already granted</div>
              )}
            </div>
          ))}
        </div>
      )}

      {overdueMatches.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#e09040', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Overdue matches ({overdueMatches.length})
          </div>
          {overdueMatches.map(match => (
            <div key={match.id} style={{ padding: '18px 20px', borderRadius: 12, border: '1px solid #4a3a1a', background: '#1a1a0f', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{match.fromTeamName} vs {match.toTeamName}</div>
              <div style={{ fontSize: 12, color: '#e09040', marginBottom: 14 }}>
                Was scheduled: {formatDate(match.scheduledAt)} — no result entered
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e09040', marginBottom: 10 }}>Apply WO:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button onClick={() => handleApplySingleWO(match, match.fromTeamId)} disabled={applying === match.id} style={btn()}>
                  {match.fromTeamName} wins (6-0 / 6-0)
                </button>
                <button onClick={() => handleApplySingleWO(match, match.toTeamId)} disabled={applying === match.id} style={btn()}>
                  {match.toTeamName} wins (6-0 / 6-0)
                </button>
                <button onClick={() => handleDoubleWO(match)} disabled={applying === match.id} style={btn('#e09040')}>
                  Double WO — both drop 1
                </button>
                {!match.postponed && (
                  <button onClick={() => handleGrantPostponement(match)} disabled={applying === match.id} style={outlineBtn}>
                    Grant postponement
                  </button>
                )}
              </div>
              {match.postponed && (
                <div style={{ fontSize: 11, color: '#e09040', marginTop: 10 }}>⚠ Postponement already granted</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}