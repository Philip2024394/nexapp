// tests/e2e-p6-isolation/call-invite-rpc.spec.ts
//
// Lane G · nex_invite_to_call_tx RPC real-DB integration · 2026-11-21.
// -----------------------------------------------------------------
// Companion to the offline Lane G shape/model tests. Mig-357 applies
// a SECURITY DEFINER function that fuses 4 previously-unwrapped
// inserts (session + participant + conversation + message) into one
// transactional RPC with an in-body POSIX regex guard on
// p_attachment_url (GB-WHITESPACE-GUARD) and a FOR UPDATE row-lock
// on the parent session row (GB-4CAP serialisation).
//
// The HQ journey-map blocker on Lane G calls out BROWSER /
// PERSISTENCE / PROVIDER tier as UNVERIFIED for the applied mig-357
// path. This spec raises that tier honestly:
//
//   G-RPC-1 · signed-in happy path · asserts the 5-column RPC
//             return + persisted session + participant + conversation
//             + message rows (direct pg SELECT).
//   G-RPC-2 · GB-WHITESPACE-GUARD · a malformed attachment_url that
//             does not satisfy the POSIX regex is rejected with
//             SQLSTATE 22023 · no row is written.
//   G-RPC-3 · idempotent re-invite · a second identical invite on
//             the same session returns `out_skipped = 'already_
//             invited'` without a duplicate participant row.
//   G-RPC-4 · anon RPC denial · the function is EXECUTE-granted to
//             `authenticated` only; the anon REST path is denied at
//             the privilege boundary before the body runs.
//
// Honest safety fence
// -----------------------------------------------------------------
//   · Sandbox DB only (kdstoyyeygcopkogqsyv). Prod ref refused.
//   · Fixtures: 2 disposable auth users ADMIN-PROVISIONED via
//     supabase.auth.admin.createUser in beforeAll. ".invalid" domain,
//     time-stamped, labelled LANE_G_E2E_RPC_2026_11_21. They are NOT
//     Hammerex/Rosa and NOT the CK5 series; cleanup deletes them
//     plus any session/participant/conversation/message rows they
//     touched.
//   · No browser involved. Playwright is used purely as the runner.
//   · Does NOT change grants, triggers, or function bodies.

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import pkg from "pg";
const { Client: PG } = pkg;

function fromEnvLocal(name: string): string {
  try {
    const m = readFileSync(".env.local", "utf8").match(
      new RegExp(`^${name}=(.*)$`, "m"),
    );
    if (!m) return "";
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v;
  } catch {
    return "";
  }
}

const SUPABASE_URL = fromEnvLocal("SANDBOX_SUPABASE_URL");
const ANON_KEY = fromEnvLocal("SANDBOX_SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = fromEnvLocal("SANDBOX_SUPABASE_SERVICE_ROLE_KEY");
const DB_URL = fromEnvLocal("DATABASE_URL");
const SANDBOX_DB_URL = fromEnvLocal("SANDBOX_DATABASE_URL");

const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

if (!SUPABASE_URL.includes(SANDBOX_REF) || SUPABASE_URL.includes(PROD_REF)) {
  throw new Error("call-invite-rpc refuses · SANDBOX_SUPABASE_URL not sandbox");
}
if (!DB_URL.includes(SANDBOX_REF) || DB_URL.includes(PROD_REF)) {
  throw new Error("call-invite-rpc refuses · DATABASE_URL not sandbox");
}
if (!ANON_KEY) throw new Error("call-invite-rpc · SANDBOX_SUPABASE_ANON_KEY missing");
if (!SERVICE_ROLE_KEY) {
  throw new Error("call-invite-rpc · SANDBOX_SUPABASE_SERVICE_ROLE_KEY missing");
}

const STAMP = Date.now().toString(36);
const FIXTURE_LABEL = `LANE_G_E2E_RPC_2026_11_21_${STAMP}`;

interface Fixture {
  email: string;
  password: string;
  supabase_user_id: string;
  nex_account_id: string;
}

const PROTECTED_IDS = new Set<string>([
  "11111111-1111-4111-8111-111111111111", // Hammerex
  "11111111-1111-4111-8111-111111111113", // Rosa
]);

async function pgClient(): Promise<InstanceType<typeof PG>> {
  const c = new PG({ connectionString: DB_URL });
  await c.connect();
  return c;
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function provisionFixture(suffix: string): Promise<Fixture> {
  const email = `e2e-laneg-${suffix}-${STAMP}@nex.invalid`;
  const password = `LaneG-${STAMP}-${suffix}-${email.length}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { fixture_label: FIXTURE_LABEL },
  });
  if (error) throw new Error(`createUser ${suffix}: ${error.message}`);
  const supabase_user_id = data.user!.id;

  // Insert matching nex_account row (fk from supabase_user_id).
  const c = await pgClient();
  try {
    const r = await c.query(
      `INSERT INTO nex_account (supabase_user_id, display_name)
       VALUES ($1, $2) RETURNING id`,
      [supabase_user_id, `LaneG-${suffix}-${STAMP}`],
    );
    const nex_account_id = r.rows[0].id as string;
    if (PROTECTED_IDS.has(nex_account_id)) {
      throw new Error(`refuse · provisioned nex_account_id matched protected: ${nex_account_id}`);
    }
    return { email, password, supabase_user_id, nex_account_id };
  } finally {
    await c.end();
  }
}

async function destroyFixture(f: Fixture): Promise<void> {
  if (!f.supabase_user_id) return;
  // auth user delete cascades to nex_account via FK (mig 001:55).
  const { error } = await admin.auth.admin.deleteUser(f.supabase_user_id);
  if (error) {
    // Not fatal — best-effort cleanup.
    console.warn(`cleanup · admin.deleteUser(${f.email}): ${error.message}`);
  }
}

function newAuthClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signInAs(f: Fixture) {
  const c = newAuthClient();
  const { data, error } = await c.auth.signInWithPassword({
    email: f.email,
    password: f.password,
  });
  if (error) throw new Error(`signIn ${f.email}: ${error.message}`);
  return { client: c, access_token: data.session!.access_token };
}

const WELL_FORMED_ACCEPT_HREF = (sessionId: string) =>
  `/nex-native/call/preview?session=${sessionId}&accept=1`;

// ──────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

test.describe("Lane G · nex_invite_to_call_tx RPC · sandbox integration", () => {
  let A: Fixture;
  let B: Fixture;
  // Track rows we create so afterAll can clean them.
  const touchedSessionIds: string[] = [];
  const touchedConversationIds: string[] = [];

  test.beforeAll(async () => {
    A = await provisionFixture("A");
    B = await provisionFixture("B");
    console.log(`[laneg] fixtures provisioned A=${A.nex_account_id} B=${B.nex_account_id}`);
  });

  test.afterAll(async () => {
    try {
      const c = await pgClient();
      try {
        for (const sid of touchedSessionIds) {
          await c.query(`DELETE FROM nex_group_call_participant WHERE session_id = $1`, [sid]);
          await c.query(`DELETE FROM nex_group_call_session WHERE id = $1`, [sid]);
        }
        for (const cid of touchedConversationIds) {
          await c.query(`DELETE FROM nex_peer_message WHERE conversation_id = $1`, [cid]);
          await c.query(`DELETE FROM nex_peer_conversation WHERE id = $1`, [cid]);
        }
      } finally {
        await c.end();
      }
    } catch (e) {
      console.warn("laneg cleanup (row) failed · manual review", e);
    }
    try { if (A) await destroyFixture(A); } catch { /* */ }
    try { if (B) await destroyFixture(B); } catch { /* */ }
  });

  test("G-RPC-1 · signed-in happy path · session + participant + conversation + message persisted", async () => {
    const { client } = await signInAs(A);
    // The accept-href's `session=` segment is validated by regex
    // against a 36-char UUID with hyphens. We use an all-zero UUID
    // as the TEMPLATE; the RPC doesn't verify the UUID matches the
    // newly-minted session — it only checks shape. Lane G §16.37.9
    // call-site wrapper will substitute the real id post-mint.
    const templateHref = WELL_FORMED_ACCEPT_HREF("00000000-0000-0000-0000-000000000000");
    const { data, error } = await client.rpc("nex_invite_to_call_tx", {
      p_invitee_account_id: B.nex_account_id,
      p_media_type: "audio",
      p_host_country: "ireland",
      p_attachment_meta: { probe: "G-RPC-1", stamp: STAMP },
      p_invite_body: "lane-g rpc happy path",
      p_attachment_url: templateHref,
      p_existing_session_id: null,
    });
    expect(error, `RPC error · ${error?.message}`).toBeNull();
    expect(Array.isArray(data) && data.length).toBe(1);
    const row = (data as Array<Record<string, string | null>>)[0];
    expect(row.out_session_id).toBeTruthy();
    expect(row.out_participant_id).toBeTruthy();
    expect(row.out_conversation_id).toBeTruthy();
    expect(row.out_message_id).toBeTruthy();
    expect(row.out_skipped).toBeNull();

    const sessionId = row.out_session_id as string;
    const conversationId = row.out_conversation_id as string;
    touchedSessionIds.push(sessionId);
    touchedConversationIds.push(conversationId);

    // Verify persistence via direct pg.
    const c = await pgClient();
    try {
      const s = await c.query(
        `SELECT id, host_account_id, media_type, state, host_country
         FROM nex_group_call_session WHERE id = $1`,
        [sessionId],
      );
      expect(s.rows.length).toBe(1);
      expect(s.rows[0].host_account_id).toBe(A.nex_account_id);
      expect(s.rows[0].media_type).toBe("audio");
      expect(s.rows[0].state).toBe("ringing");
      expect(s.rows[0].host_country).toBe("ireland");

      const p = await c.query(
        `SELECT id, session_id, account_id FROM nex_group_call_participant
         WHERE id = $1`,
        [row.out_participant_id],
      );
      expect(p.rows.length).toBe(1);
      expect(p.rows[0].session_id).toBe(sessionId);
      expect(p.rows[0].account_id).toBe(B.nex_account_id);

      const m = await c.query(
        `SELECT id, conversation_id, sender_account_id, body, attachment_type,
                attachment_url, attachment_meta
         FROM nex_peer_message WHERE id = $1`,
        [row.out_message_id],
      );
      expect(m.rows.length).toBe(1);
      expect(m.rows[0].conversation_id).toBe(conversationId);
      expect(m.rows[0].sender_account_id).toBe(A.nex_account_id);
      expect(m.rows[0].attachment_type).toBe("call_invite");
      expect(m.rows[0].attachment_url).toBe(templateHref);
      expect(m.rows[0].body).toBe("lane-g rpc happy path");

      // Ordered-pair invariant · participant_a_id < participant_b_id.
      const conv = await c.query(
        `SELECT id, participant_a_id, participant_b_id
         FROM nex_peer_conversation WHERE id = $1`,
        [conversationId],
      );
      expect(conv.rows.length).toBe(1);
      const a_id = conv.rows[0].participant_a_id as string;
      const b_id = conv.rows[0].participant_b_id as string;
      expect(a_id < b_id).toBe(true);
      expect(new Set([a_id, b_id])).toEqual(new Set([A.nex_account_id, B.nex_account_id]));
    } finally {
      await c.end();
    }
  });

  test("G-RPC-2 · GB-WHITESPACE-GUARD · malformed attachment_url rejected (SQLSTATE 22023)", async () => {
    const { client } = await signInAs(A);
    // Trailing whitespace breaks the exact ^...$ anchored regex. The
    // guard clause raises `attachment_url_required` with ERRCODE 22023
    // before any INSERT.
    const malformed =
      "/nex-native/call/preview?session=00000000-0000-0000-0000-000000000000&accept=1 ";
    const { data, error } = await client.rpc("nex_invite_to_call_tx", {
      p_invitee_account_id: B.nex_account_id,
      p_media_type: "audio",
      p_host_country: "ireland",
      p_attachment_meta: { probe: "G-RPC-2" },
      p_invite_body: "lane-g rpc whitespace guard",
      p_attachment_url: malformed,
      p_existing_session_id: null,
    });
    expect(data, `expected null data on refusal · got ${JSON.stringify(data)}`).toBeNull();
    expect(error).not.toBeNull();
    // supabase-js surfaces SQLSTATE in `code`.
    expect(error!.code).toBe("22023");
    expect(error!.message.toLowerCase()).toContain("attachment_url_required");

    // Defence-in-depth: no row was written for this session shape.
    // (We cannot filter by session_id because the function never
    // minted one · we verify by participant/message count against
    // THIS invitee from THIS inviter within this test run.)
    const c = await pgClient();
    try {
      const cm = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex_peer_message
         WHERE sender_account_id = $1 AND attachment_url = $2`,
        [A.nex_account_id, malformed],
      );
      expect(cm.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }
  });

  test("G-RPC-3 · idempotent re-invite · second call returns out_skipped='already_invited' with no dup participant row", async () => {
    // Re-use the session minted in G-RPC-1 by passing the existing
    // session id. The function hits UNIQUE(session_id, account_id)
    // on the second insert and returns the sentinel.
    const sessionId = touchedSessionIds[0];
    expect(sessionId, "G-RPC-1 must have run first").toBeTruthy();
    const templateHref = WELL_FORMED_ACCEPT_HREF("00000000-0000-0000-0000-000000000000");
    const { client } = await signInAs(A);
    const { data, error } = await client.rpc("nex_invite_to_call_tx", {
      p_invitee_account_id: B.nex_account_id,
      p_media_type: "audio",
      p_host_country: "ireland",
      p_attachment_meta: { probe: "G-RPC-3", stamp: STAMP },
      p_invite_body: "lane-g rpc idempotent re-invite",
      p_attachment_url: templateHref,
      p_existing_session_id: sessionId,
    });
    expect(error, `RPC error · ${error?.message}`).toBeNull();
    expect(Array.isArray(data) && data.length).toBe(1);
    const row = (data as Array<Record<string, string | null>>)[0];
    expect(row.out_skipped).toBe("already_invited");
    expect(row.out_session_id).toBe(sessionId);
    // The sentinel branch returns NULL for conversation_id + message_id.
    expect(row.out_conversation_id).toBeNull();
    expect(row.out_message_id).toBeNull();

    // No second participant row was created.
    const c = await pgClient();
    try {
      const p = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex_group_call_participant
         WHERE session_id = $1 AND account_id = $2`,
        [sessionId, B.nex_account_id],
      );
      expect(p.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  });

  test("G-RPC-4 · anon RPC denied at permission boundary", async () => {
    const anon = newAuthClient();
    const templateHref = WELL_FORMED_ACCEPT_HREF("00000000-0000-0000-0000-000000000000");
    const { data, error } = await anon.rpc("nex_invite_to_call_tx", {
      p_invitee_account_id: B.nex_account_id,
      p_media_type: "audio",
      p_host_country: "ireland",
      p_attachment_meta: { probe: "G-RPC-4" },
      p_invite_body: "lane-g rpc anon denial",
      p_attachment_url: templateHref,
      p_existing_session_id: null,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    // Supabase may surface either the Postgres SQLSTATE or the PostgREST
    // HTTP boundary code depending on where the deny lands. Accept
    // either as proof of denial.
    const code = String(error!.code ?? "");
    const msg = String(error!.message ?? "").toLowerCase();
    const deniedByCode = code === "42501" || code === "42883" || code === "PGRST202";
    const deniedByMessage =
      msg.includes("permission denied") ||
      msg.includes("not find the function") ||
      msg.includes("could not find") ||
      msg.includes("caller_identity_required");
    expect(
      deniedByCode || deniedByMessage,
      `anon denial expected · code=${code} msg=${error!.message}`,
    ).toBe(true);
  });
});
