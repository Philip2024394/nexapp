#!/usr/bin/env node
// =============================================================================
// Lane-G Agent C · GB-4CAP offline concurrency model
//
// OFFLINE CONCURRENCY MODEL ONLY · NOT POSTGRESQL CONCURRENCY PROOF
// GB-4CAP STAYS OPEN · This JS model demonstrates the race PATTERN and
// shows that a session-scoped mutex corresponds to the proposed
// `SELECT 1 ... FOR UPDATE` lock; it is not a proof that the
// corresponding Postgres migration applied against sandbox
// `kdstoyyeygcopkogqsyv` is race-safe. Only a real DB battery can prove
// that. See CANDIDATE_nex_group_call_4cap_lock_DESIGN_PREVIEW.sql.
// =============================================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BANNER = [
  '',
  '  ===========================================================',
  '  OFFLINE CONCURRENCY MODEL ONLY',
  '  NOT POSTGRESQL CONCURRENCY PROOF',
  '  GB-4CAP STAYS OPEN',
  '  ===========================================================',
  '',
].join('\n');

console.log(BANNER);

// -----------------------------------------------------------------------------
// In-memory world
// -----------------------------------------------------------------------------
function makeWorld() {
  return {
    sessions: new Map(),      // sessionId -> { participants: [accountId, ...] }
    locks: new Map(),         // sessionId -> Promise chain tail (mutex)
    cap: 4,
  };
}

function ensureSession(world, sessionId) {
  if (!world.sessions.has(sessionId)) {
    world.sessions.set(sessionId, { participants: [] });
  }
  return world.sessions.get(sessionId);
}

// Simulates a row-level FOR UPDATE lock on a specific session row.
// Each session has its own mutex; different sessions are independent.
function withSessionLock(world, sessionId, body) {
  const prev = world.locks.get(sessionId) ?? Promise.resolve();
  let release;
  const held = new Promise((r) => { release = r; });
  world.locks.set(sessionId, prev.then(() => held));
  return prev.then(async () => {
    try {
      return await body();
    } finally {
      release();
    }
  });
}

// Sleep helper · cooperative scheduler cue for interleaving.
const yieldMicro = () => new Promise((r) => setImmediate(r));

// -----------------------------------------------------------------------------
// Invite under CURRENT mig-133 semantics (COUNT then INSERT, no lock)
// -----------------------------------------------------------------------------
async function inviteNoLock(world, sessionId, accountId, hook = {}) {
  // SELECT COUNT(*) WHERE session_id = sessionId
  const session = ensureSession(world, sessionId);
  // Dedup check (UNIQUE(session_id, account_id))
  if (session.participants.includes(accountId)) {
    return { ok: true, dedup: true };
  }
  const cnt = session.participants.length;

  if (hook.afterCount) await hook.afterCount();  // interleave point

  if (cnt >= world.cap) {
    throw new Error(`cap_exceeded · session ${sessionId} already has ${cnt}`);
  }

  if (hook.beforeInsert) await hook.beforeInsert();

  session.participants.push(accountId);
  return { ok: true, dedup: false };
}

// -----------------------------------------------------------------------------
// Invite under PROPOSED semantics (session-scoped lock, then COUNT, then INSERT)
// -----------------------------------------------------------------------------
async function inviteWithLock(world, sessionId, accountId, hook = {}) {
  return withSessionLock(world, sessionId, async () => {
    const session = ensureSession(world, sessionId);
    if (session.participants.includes(accountId)) {
      return { ok: true, dedup: true };
    }
    const cnt = session.participants.length;

    if (hook.afterCount) await hook.afterCount();

    if (cnt >= world.cap) {
      throw new Error(`cap_exceeded · session ${sessionId} already has ${cnt}`);
    }

    if (hook.beforeInsert) await hook.beforeInsert();

    session.participants.push(accountId);
    return { ok: true, dedup: false };
  });
}

// -----------------------------------------------------------------------------
// Test cases
// -----------------------------------------------------------------------------
const results = { startedAt: new Date().toISOString(), cases: {} };

function recordCase(name, pass, detail) {
  results.cases[name] = { pass, ...detail };
  const marker = pass ? 'PASS' : 'FAIL';
  console.log(`[${marker}] ${name}: ${JSON.stringify(detail)}`);
}

// Case A · no-lock race. Pre-seed 3, fire 2 concurrent, interleaved.
async function caseA_NoLockRace() {
  const world = makeWorld();
  ensureSession(world, 'S1');
  world.sessions.get('S1').participants.push('P1', 'P2', 'P3');

  // Barriers so T1 and T2 both see cnt=3 before either inserts.
  let release;
  const barrier = new Promise((r) => { release = r; });
  let arrived = 0;
  const gate = async () => {
    arrived += 1;
    if (arrived === 2) release();
    await barrier;
  };

  const t1 = inviteNoLock(world, 'S1', 'P4', { afterCount: gate });
  const t2 = inviteNoLock(world, 'S1', 'P5', { afterCount: gate });

  const out = await Promise.allSettled([t1, t2]);
  const count = world.sessions.get('S1').participants.length;
  const violated = count > world.cap;

  recordCase('caseA_no_lock_race', violated, {
    expected: 'count > 4 (race produces cap violation)',
    finalCount: count,
    participants: world.sessions.get('S1').participants,
    outcomes: out.map((o) => o.status),
  });
}

// Case B · with lock. Same scenario, cap must hold at 4; second RAISEs.
async function caseB_WithLock() {
  const world = makeWorld();
  ensureSession(world, 'S1');
  world.sessions.get('S1').participants.push('P1', 'P2', 'P3');

  const t1 = inviteWithLock(world, 'S1', 'P4');
  const t2 = inviteWithLock(world, 'S1', 'P5');

  const out = await Promise.allSettled([t1, t2]);
  const count = world.sessions.get('S1').participants.length;
  const correct = count === 4;
  const oneRaised = out.filter((o) => o.status === 'rejected').length === 1;

  recordCase('caseB_with_lock_blocks_second', correct && oneRaised, {
    expected: 'count === 4 and exactly one rejection',
    finalCount: count,
    rejections: out.filter((o) => o.status === 'rejected').map((o) => String(o.reason.message)),
  });
}

// Case C · different sessions concurrent, lock must NOT serialise.
async function caseC_DifferentSessions() {
  const world = makeWorld();
  ensureSession(world, 'SA');
  ensureSession(world, 'SB');
  world.sessions.get('SA').participants.push('H1', 'G1', 'G2');
  world.sessions.get('SB').participants.push('H2', 'G3', 'G4');

  const t1 = inviteWithLock(world, 'SA', 'G5');
  const t2 = inviteWithLock(world, 'SB', 'G6');

  const out = await Promise.allSettled([t1, t2]);
  const caA = world.sessions.get('SA').participants.length;
  const caB = world.sessions.get('SB').participants.length;
  const bothOk = out.every((o) => o.status === 'fulfilled');
  const bothAtCap = caA === 4 && caB === 4;

  recordCase('caseC_different_sessions_independent', bothOk && bothAtCap, {
    expected: 'both sessions reach cap 4, no rejection',
    SA: caA, SB: caB,
    outcomes: out.map((o) => o.status),
  });
}

// Case D · same account_id dedup retry · no cap increment.
async function caseD_DedupRetry() {
  const world = makeWorld();
  ensureSession(world, 'S1');
  world.sessions.get('S1').participants.push('P1', 'P2');

  const first = await inviteWithLock(world, 'S1', 'P3');
  const second = await inviteWithLock(world, 'S1', 'P3');  // retry
  const count = world.sessions.get('S1').participants.length;

  recordCase('caseD_dedup_retry_no_increment', count === 3 && second.dedup === true, {
    expected: 'count stays 3, second call returns dedup=true',
    finalCount: count,
    first, second,
  });
}

// -----------------------------------------------------------------------------
// Driver
// -----------------------------------------------------------------------------
(async () => {
  try {
    await caseA_NoLockRace();
    await caseB_WithLock();
    await caseC_DifferentSessions();
    await caseD_DedupRetry();

    const passCount = Object.values(results.cases).filter((c) => c.pass).length;
    const total = Object.keys(results.cases).length;
    results.finishedAt = new Date().toISOString();
    results.summary = { passCount, total, allPass: passCount === total };

    console.log('');
    console.log(`SUMMARY · ${passCount}/${total} cases pass as expected`);
    console.log(BANNER);

    const __filename = fileURLToPath(import.meta.url);
    const outPath = dirname(__filename) + '/31-4cap-model-results.json';
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`Results written: ${outPath}`);

    process.exit(passCount === total ? 0 : 1);
  } catch (err) {
    console.error('UNEXPECTED ERROR', err);
    process.exit(2);
  }
})();
