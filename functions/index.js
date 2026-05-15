const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

async function writeAuditLog(action, actor, targetId, payload) {
  await db.collection('auditLog').add({
    action,
    actor,
    targetId,
    payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

exports.onResultCreated = functions.firestore
  .document('results/{resultId}')
  .onCreate(async (snap, context) => {
    const result = snap.data();
    const { winnerId, loserId, fromTeamId, toTeamId, score, fromTeamName, toTeamName } = result;

    const teamsSnapshot = await db.collection('teams').orderBy('position', 'asc').get();
    const allTeams = teamsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const activeTeams = allTeams.filter(t => t.status === 'active');

    const winnerTeam = allTeams.find(t => t.id === winnerId);
    const loserTeam = allTeams.find(t => t.id === loserId);

    if (!winnerTeam || !loserTeam) return;

    const winnerPos = winnerTeam.position;
    const loserPos = loserTeam.position;

    const challengerIsWinner = winnerId === fromTeamId;

    const batch = db.batch();

    if (challengerIsWinner && winnerPos > loserPos) {
      const teamsToShiftDown = allTeams.filter(
        t => t.position >= loserPos && t.position < winnerPos && t.id !== winnerId
      );
      teamsToShiftDown.forEach(t => {
        const ref = db.collection('teams').doc(t.id);
        batch.update(ref, { position: t.position + 1 });
      });
      batch.update(db.collection('teams').doc(winnerId), { position: loserPos });
    }

    await batch.commit();

    await db.collection('matchHistory').add({
      team1Id: fromTeamId,
      team2Id: toTeamId,
      team1Name: fromTeamName,
      team2Name: toTeamName,
      winnerId,
      loserId,
      score,
      playedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog(
      'result_entered',
      'player',
      context.params.resultId,
      { winnerId, loserId, score, fromTeamName, toTeamName }
    );
  });

exports.onMatchRequestWritten = functions.firestore
  .document('matchRequests/{requestId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    if (!before && after) {
      await writeAuditLog(
        'challenge_sent',
        after.fromTeamName,
        context.params.requestId,
        { from: after.fromTeamName, to: after.toTeamName }
      );
    }

    if (before && after && before.status !== after.status) {
      await writeAuditLog(
        'challenge_' + after.status,
        after.toTeamName,
        context.params.requestId,
        { from: after.fromTeamName, to: after.toTeamName, status: after.status }
      );
    }
  });

exports.onTeamWritten = functions.firestore
  .document('teams/{teamId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    if (!before && after) {
      await writeAuditLog('team_added', 'admin', context.params.teamId, { name: after.name });
    }

    if (before && !after) {
      await writeAuditLog('team_deleted', 'admin', context.params.teamId, { name: before.name });
    }

    if (before && after) {
      if (before.status !== after.status) {
        await writeAuditLog('team_status_changed', 'admin', context.params.teamId, {
          name: after.name, from: before.status, to: after.status
        });
      }
      if (before.position !== after.position) {
        await writeAuditLog('position_changed', 'system', context.params.teamId, {
          name: after.name, from: before.position, to: after.position
        });
      }
    }
  });