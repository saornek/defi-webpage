import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../Firebase';
import { useNavigate } from 'react-router-dom';
import WOPanel from './WOPanel';
import AddMatchPanel from './AddMatchPanel';

export default function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('teams');
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);
  const [editingResult, setEditingResult] = useState(null);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'teams'), orderBy('position', 'asc')), snap => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsub2 = onSnapshot(query(collection(db, 'matchRequests'), orderBy('requestedAt', 'desc')), snap => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub3 = onSnapshot(query(collection(db, 'results'), orderBy('enteredAt', 'desc')), snap => {
      setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub4 = onSnapshot(query(collection(db, 'auditLog'), orderBy('createdAt', 'desc')), snap => {
      setAuditLog(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  function flash(msg, isError) {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
  }

  async function handleLogout() {
    await signOut(auth);
    navigate('/login');
  }

  async function handleAddTeam() {
    if (!newTeamName.trim()) return;
    const maxPos = teams.length > 0 ? Math.max(...teams.map(t => t.position)) : 0;
    try {
      await addDoc(collection(db, 'teams'), {
        name: newTeamName.trim(), position: maxPos + 1,
        status: 'active', activeChallenge: null,
        lastChallengeAt: null, createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'auditLog'), {
        action: 'team_added', actor: 'admin', targetId: newTeamName.trim(),
        payload: { name: newTeamName.trim() }, createdAt: serverTimestamp(),
      });
      setNewTeamName('');
      flash('Team added.');
    } catch { flash('Failed to add team.', true); }
  }

  async function handleDeleteTeam(team) {
    if (!window.confirm('Delete ' + team.name + '? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'teams', team.id));
      await addDoc(collection(db, 'auditLog'), {
        action: 'team_deleted', actor: 'admin', targetId: team.id,
        payload: { name: team.name }, createdAt: serverTimestamp(),
      });
      flash('Team deleted.');
    } catch { flash('Failed to delete team.', true); }
  }

  async function handleToggleStatus(team) {
    const newStatus = team.status === 'active' ? 'passive' : 'active';
    try {
      await updateDoc(doc(db, 'teams', team.id), { status: newStatus });
      await addDoc(collection(db, 'auditLog'), {
        action: 'team_status_changed', actor: 'admin', targetId: team.id,
        payload: { name: team.name, from: team.status, to: newStatus }, createdAt: serverTimestamp(),
      });
    } catch { flash('Failed to update status.', true); }
  }

  async function handleSaveTeam() {
    if (!editingTeam) return;
    try {
      await updateDoc(doc(db, 'teams', editingTeam.id), {
        name: editingTeam.name, position: Number(editingTeam.position),
      });
      await addDoc(collection(db, 'auditLog'), {
        action: 'team_edited', actor: 'admin', targetId: editingTeam.id,
        payload: { name: editingTeam.name, position: editingTeam.position }, createdAt: serverTimestamp(),
      });
      setEditingTeam(null);
      flash('Team updated.');
    } catch { flash('Failed to update team.', true); }
  }

  async function handleSaveMatch() {
    if (!editingMatch) return;
    try {
      const updates = { status: editingMatch.status };
      if (editingMatch.scheduledDate && editingMatch.scheduledHour && editingMatch.scheduledMin) {
        updates.scheduledAt = new Date(editingMatch.scheduledDate + 'T' + editingMatch.scheduledHour + ':' + editingMatch.scheduledMin);
      }
      if (editingMatch.expiresDate) updates.expiresAt = new Date(editingMatch.expiresDate);
      await updateDoc(doc(db, 'matchRequests', editingMatch.id), updates);
      if (editingMatch.status === 'cancelled') {
        await updateDoc(doc(db, 'teams', editingMatch.fromTeamId), { activeChallenge: null });
        await updateDoc(doc(db, 'teams', editingMatch.toTeamId), { activeChallenge: null });
      }
      await addDoc(collection(db, 'auditLog'), {
        action: 'match_edited', actor: 'admin', targetId: editingMatch.id,
        payload: { from: editingMatch.fromTeamName, to: editingMatch.toTeamName, status: editingMatch.status },
        createdAt: serverTimestamp(),
      });
      setEditingMatch(null);
      flash('Match updated.');
    } catch (err) {
      console.error(err);
      flash('Failed to update match.', true);
    }
  }

  async function handleSaveResult() {
    if (!editingResult) return;
    try {
      await updateDoc(doc(db, 'results', editingResult.id), {
        score: editingResult.score, winnerId: editingResult.winnerId,
      });
      await addDoc(collection(db, 'auditLog'), {
        action: 'result_edited', actor: 'admin', targetId: editingResult.id,
        payload: { score: editingResult.score }, createdAt: serverTimestamp(),
      });
      setEditingResult(null);
      flash('Result updated.');
    } catch { flash('Failed to update result.', true); }
  }

  function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function tsToInputDate(ts) {
    if (!ts) return '';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toISOString().split('T')[0];
  }

  function tsToHour(ts) {
    if (!ts) return '';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return String(d.getHours()).padStart(2, '0');
  }

  function tsToMin(ts) {
    if (!ts) return '';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return String(d.getMinutes()).padStart(2, '0');
  }

  function statusBadge(s) {
    const map = {
      completed: { bg: '#0f2a0f', color: '#8bc34a', border: '#3a6a3a' },
      accepted:  { bg: '#162a16', color: '#4caf50', border: '#2e4a2e' },
      pending:   { bg: '#1a2a0f', color: '#c8e64a', border: '#4a5a2a' },
      cancelled: { bg: '#2a0f0f', color: '#ff6b6b', border: '#6a2a2a' },
      declined:  { bg: '#2a1a0f', color: '#e09040', border: '#6a4a2a' },
    };
    const c = map[s] || { bg: '#1a1a1a', color: '#888', border: '#333' };
    return { display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: c.bg, color: c.color, border: '1px solid ' + c.border };
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #2e4a2e', background: '#111f11',
    color: '#fff', fontSize: 13, boxSizing: 'border-box',
  };

  const selectStyle = {
    padding: '9px 12px', borderRadius: 8,
    border: '1px solid #2e4a2e', background: '#111f11',
    color: '#fff', fontSize: 13, width: '100%',
  };

  const tabStyle = (t) => ({
    flex: 1, padding: '10px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
    background: tab === t ? '#8bc34a' : 'transparent',
    color: tab === t ? '#0f1f0f' : '#4a7a4a',
  });

  const btn = (color, outline) => ({
    padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
    background: outline ? 'transparent' : (color || '#8bc34a'),
    color: outline ? (color || '#4a7a4a') : (color === '#cc0000' ? '#fff' : '#0f1f0f'),
    border: outline ? '1px solid ' + (color || '#2e4a2e') : 'none',
    whiteSpace: 'nowrap',
  });

  const lbl = (text) => (
    <div style={{ fontSize: 11, color: '#4a7a4a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
      {text}
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f1f0f', padding: 40, fontSize: 14, color: '#4a7a4a' }}>
      Loading...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0f1f0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>

        <div style={{ paddingTop: 40, paddingBottom: 24, borderBottom: '1px solid #1e3a1e' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#8bc34a', textDecoration: 'none', fontWeight: 600, marginBottom: 16 }}>
            ← Back to ladder
          </a>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: '#4caf50', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Admin panel</div>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Tennis <span style={{ color: '#8bc34a' }}>Dashboard</span></h1>
            </div>
            <button onClick={handleLogout} style={btn(null, true)}>Sign out</button>
          </div>
        </div>

        {error && <div style={{ background: '#2a0f0f', border: '1px solid #cc000044', borderRadius: 8, padding: '10px 14px', marginTop: 16, fontSize: 13, color: '#ff6b6b' }}>{error}</div>}
        {success && <div style={{ background: '#0f2a0f', border: '1px solid #4caf5044', borderRadius: 8, padding: '10px 14px', marginTop: 16, fontSize: 13, color: '#8bc34a' }}>{success}</div>}

        <div style={{ display: 'flex', gap: 4, padding: '20px 0', borderBottom: '1px solid #1e3a1e' }}>
          {['teams', 'matches', 'results', 'wo', 'audit'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
              {t === 'wo' ? 'WO' : t}
            </button>
          ))}
        </div>

        <div style={{ paddingTop: 24, paddingBottom: 48 }}>

          {tab === 'teams' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                  placeholder="New team name" style={{ ...inputStyle, flex: 1, width: 'auto' }}
                  onKeyDown={e => e.key === 'Enter' && handleAddTeam()} />
                <button onClick={handleAddTeam} style={btn()}>Add team</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {teams.map(team => (
                  <div key={team.id} style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid #1e3a1e', background: '#131f13' }}>
                    {editingTeam?.id === team.id ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input value={editingTeam.name} onChange={e => setEditingTeam({ ...editingTeam, name: e.target.value })}
                          style={{ ...inputStyle, flex: 1, minWidth: 120 }} />
                        <input value={editingTeam.position} onChange={e => setEditingTeam({ ...editingTeam, position: e.target.value })}
                          type="number" placeholder="Pos" style={{ ...inputStyle, width: 70 }} />
                        <button onClick={handleSaveTeam} style={btn()}>Save</button>
                        <button onClick={() => setEditingTeam(null)} style={btn(null, true)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: team.position === 1 ? '#8bc34a' : '#1a2e1a', color: team.position === 1 ? '#0f1f0f' : '#8bc34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {team.position}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{team.name}</div>
                          <div style={{ fontSize: 11, color: team.status === 'active' ? '#4caf50' : '#e09040', marginTop: 2, fontWeight: 600 }}>{team.status}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => setEditingTeam(team)} style={btn(null, true)}>Edit</button>
                          <button onClick={() => handleToggleStatus(team)} style={btn(team.status === 'active' ? '#e09040' : '#4caf50', true)}>
                            {team.status === 'active' ? 'Set passive' : 'Set active'}
                          </button>
                          <button onClick={() => handleDeleteTeam(team)} style={btn('#cc0000')}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'matches' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button onClick={() => { setShowAddMatch(!showAddMatch); setEditingMatch(null); }}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: showAddMatch ? '#2e4a2e' : '#8bc34a', color: showAddMatch ? '#4a7a4a' : '#0f1f0f', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {showAddMatch ? '✕ Cancel' : '+ Add match'}
                </button>
              </div>

              {showAddMatch && (
                <div style={{ marginBottom: 24, padding: '20px', borderRadius: 12, border: '1px solid #3a6a3a', background: '#0f2a0f' }}>
                  <div style={{ fontSize: 11, color: '#8bc34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                    Create match
                  </div>
                  <AddMatchPanel teams={teams} onSuccess={() => setShowAddMatch(false)} />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {matches.length === 0 && <div style={{ fontSize: 14, color: '#4a7a4a' }}>No matches yet.</div>}
                {matches.map(match => (
                  <div key={match.id} style={{ borderRadius: 12, border: '1px solid #1e3a1e', background: '#131f13', overflow: 'hidden' }}>
                    {editingMatch?.id === match.id ? (
                      <div style={{ padding: '20px' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: '#8bc34a' }}>
                          {match.fromTeamName} vs {match.toTeamName}
                        </div>
                        <div style={{ marginBottom: 14 }}>
                          {lbl('Status')}
                          <select value={editingMatch.status} onChange={e => setEditingMatch({ ...editingMatch, status: e.target.value })} style={selectStyle}>
                            <option value="pending">Pending</option>
                            <option value="accepted">Accepted</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                          {lbl('Match date')}
                          <input type="date" value={editingMatch.scheduledDate || ''} onChange={e => setEditingMatch({ ...editingMatch, scheduledDate: e.target.value })} style={inputStyle} />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                          {lbl('Match time (24hr)')}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <select value={editingMatch.scheduledHour || ''} onChange={e => setEditingMatch({ ...editingMatch, scheduledHour: e.target.value })} style={{ ...selectStyle, flex: 1 }}>
                              <option value="">Hour</option>
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
                              ))}
                            </select>
                            <select value={editingMatch.scheduledMin || ''} onChange={e => setEditingMatch({ ...editingMatch, scheduledMin: e.target.value })} style={{ ...selectStyle, flex: 1 }}>
                              <option value="">Min</option>
                              {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={{ marginBottom: 20 }}>
                          {lbl('Expiry date (WO deadline)')}
                          <input type="date" value={editingMatch.expiresDate || ''} onChange={e => setEditingMatch({ ...editingMatch, expiresDate: e.target.value })} style={inputStyle} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={handleSaveMatch} style={btn()}>Save changes</button>
                          <button onClick={() => setEditingMatch(null)} style={btn(null, true)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                            {match.fromTeamName}
                            <span style={{ color: '#4a7a4a', fontWeight: 400, margin: '0 8px', fontSize: 13 }}>vs</span>
                            {match.toTeamName}
                          </div>
                          {match.createdByAdmin && (
                            <div style={{ fontSize: 11, color: '#8bc34a', marginBottom: 4 }}>⚙ Created by admin</div>
                          )}
                          <div style={{ fontSize: 12, color: '#4a7a4a', marginBottom: 4 }}>Requested: {formatDate(match.requestedAt)}</div>
                          {match.scheduledAt && <div style={{ fontSize: 12, color: '#8bc34a', marginBottom: 4 }}>📅 {formatDate(match.scheduledAt)}</div>}
                          {match.expiresAt && <div style={{ fontSize: 12, color: '#e09040', marginBottom: 4 }}>⏰ Expires: {formatDate(match.expiresAt)}</div>}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            <div style={statusBadge(match.status)}>{match.status}</div>
                            {match.woRequested && <div style={statusBadge('cancelled')}>WO requested</div>}
                            {match.postponed && <div style={{ ...statusBadge('pending'), color: '#8888ff' }}>Postponed</div>}
                          </div>
                        </div>
                        <button onClick={() => {
                          setShowAddMatch(false);
                          setEditingMatch({
                            ...match,
                            scheduledDate: tsToInputDate(match.scheduledAt),
                            scheduledHour: tsToHour(match.scheduledAt),
                            scheduledMin: tsToMin(match.scheduledAt),
                            expiresDate: tsToInputDate(match.expiresAt),
                          });
                        }} style={btn(null, true)}>Edit</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'results' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.length === 0 && <div style={{ fontSize: 14, color: '#4a7a4a' }}>No results yet.</div>}
              {results.map(result => (
                <div key={result.id} style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid #1e3a1e', background: '#131f13' }}>
                  {editingResult?.id === result.id ? (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#8bc34a' }}>
                        {result.fromTeamName} vs {result.toTeamName}
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        {lbl('Score')}
                        <input value={editingResult.score} onChange={e => setEditingResult({ ...editingResult, score: e.target.value })}
                          placeholder="e.g. 6-4, 3-6, 10-7 (TB)" style={inputStyle} />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        {lbl('Winner')}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div onClick={() => setEditingResult({ ...editingResult, winnerId: result.fromTeamId })}
                            style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid', borderColor: editingResult.winnerId === result.fromTeamId ? '#8bc34a' : '#2e4a2e', background: editingResult.winnerId === result.fromTeamId ? '#162a16' : '#111f11', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
                            {editingResult.winnerId === result.fromTeamId && '🏆 '}{result.fromTeamName}
                          </div>
                          <div onClick={() => setEditingResult({ ...editingResult, winnerId: result.toTeamId })}
                            style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid', borderColor: editingResult.winnerId === result.toTeamId ? '#8bc34a' : '#2e4a2e', background: editingResult.winnerId === result.toTeamId ? '#162a16' : '#111f11', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
                            {editingResult.winnerId === result.toTeamId && '🏆 '}{result.toTeamName}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleSaveResult} style={btn()}>Save</button>
                        <button onClick={() => setEditingResult(null)} style={btn(null, true)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                          {result.fromTeamName}
                          <span style={{ color: '#4a7a4a', fontWeight: 400, margin: '0 8px', fontSize: 13 }}>vs</span>
                          {result.toTeamName}
                        </div>
                        <div style={{ fontSize: 13, color: '#8bc34a', fontWeight: 600, marginBottom: 2 }}>
                          {result.score} {result.isWO && <span style={{ color: '#ff6b6b' }}>(WO)</span>}
                          {result.createdByAdmin && <span style={{ color: '#4a7a4a', fontSize: 11, marginLeft: 6 }}>⚙ admin</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#4a7a4a' }}>Entered: {formatDate(result.enteredAt)}</div>
                      </div>
                      <button onClick={() => setEditingResult(result)} style={btn(null, true)}>Edit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'wo' && <WOPanel teams={teams} matches={matches} />}

          {tab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {auditLog.length === 0 && <div style={{ fontSize: 14, color: '#4a7a4a' }}>No audit log entries yet.</div>}
              {auditLog.map(log => (
                <div key={log.id} style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #1e3a1e', background: '#131f13' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#8bc34a', marginBottom: 2 }}>
                        {log.action.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 12, color: '#4a7a4a', marginBottom: 4 }}>By: {log.actor}</div>
                      <div style={{ fontSize: 11, color: '#2e4a2e', fontFamily: 'monospace' }}>
                        {JSON.stringify(log.payload)}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#2e4a2e', whiteSpace: 'nowrap', marginLeft: 12 }}>
                      {formatDate(log.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}