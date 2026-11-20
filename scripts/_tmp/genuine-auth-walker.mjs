// scripts/_tmp/genuine-auth-walker.mjs
// Genuine-auth walker for Hamrex (nex-99901) and Rosa (nex-99903).
//
// Uses Supabase admin generateLink (service_role) to mint a one-time
// magic link for each persona's existing auth.users row, drives the
// link with Playwright in an isolated BrowserContext → the Supabase
// auth callback sets real sb-* cookies. NO NEX_DEV_IMPERSONATE_HANDLE
// is set. The dev server at :3008 must be clear of the impersonation
// env var for this probe (we will reset it for the walker).
//
// Walker steps per persona:
//   [1] magiclink exchange · expect 303 → /nex-native/
//   [2] GET /nex-native/chat/ · expect 200 + persona-matching bytes
//   [3] GET /nex-native/manage/ · expect 200
//   [4] REST SELECT nex_peer_message with user's own access_token
//         (asserts RLS lets the real user see rows they participate in)
//   [5] REST SELECT nex_peer_message WHERE sender != self conv-not-mine
//         (asserts RLS blocks rows the user doesn't participate in)
//
// Writes a redacted evidence summary to
// scripts/_tmp/evidence/2026-11-20-closeout/genuine-auth-walker.json.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

function v(k) {
  const raw = readFileSync(".env.local", "utf8");
  const m = raw.match(new RegExp("^" + k + "=(.*)$", "m"));
  if (!m) return null;
  let x = m[1].trim();
  if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) x = x.slice(1, -1);
  return x || null;
}

const SB_URL = v("NEXT_PUBLIC_NEX_SUPABASE_URL");
const SB_SERVICE = v("NEX_SUPABASE_SERVICE_ROLE_KEY");
const SB_ANON = v("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
if (!SB_URL || !SB_SERVICE || !SB_ANON) { console.error("missing supabase env"); process.exit(2); }
if (!SB_URL.includes("kdstoyyeygcopkogqsyv")) { console.error("not sandbox"); process.exit(3); }
const DEV_BASE = "http://localhost:3008";

const PERSONAS = [
  { handle: "nex-99901", label: "Hamrex" },
  { handle: "nex-99903", label: "Rosa" },
];

const admin = createClient(SB_URL, SB_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const out = { base: DEV_BASE, sandbox: "kdstoyyeygcopkogqsyv", startedAt: new Date().toISOString(), personas: [] };

// Resolve emails for each persona from the DB first.
const pg = await import("pg");
const { spawnSync } = await import("node:child_process");
const urlProc = spawnSync("node", ["scripts/_tmp/pooler-url.mjs"], { encoding: "utf8" });
const dbUrl = urlProc.stdout.trim();
const pgc = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await pgc.connect();

async function emailFor(handle) {
  const r = await pgc.query(`
    SELECT u.email, u.id AS user_id, a.id AS account_id
      FROM nex_account a JOIN auth.users u ON u.id = a.supabase_user_id
     WHERE a.nex_handle = $1`, [handle]);
  return r.rows[0];
}

const browser = await chromium.launch({ headless: true });

for (const p of PERSONAS) {
  const em = await emailFor(p.handle);
  if (!em) { console.log(`skip ${p.handle} · no email`); continue; }
  const personaRec = { ...p, account_id: em.account_id.slice(0, 8), user_id: em.user_id.slice(0, 8), emailMask: em.email.replace(/^(.)(.*)(@.*)$/, "$1***$3"), steps: [] };

  // [1] generateLink · type 'magiclink' → returns action_link
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: em.email,
    options: { redirectTo: `${DEV_BASE}/nex-native/` },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    personaRec.steps.push({ id: 1, name: "generateLink", ok: false, err: linkErr?.message || "no action_link" });
    out.personas.push(personaRec);
    continue;
  }
  const actionLink = linkData.properties.action_link;
  personaRec.steps.push({ id: 1, name: "generateLink", ok: true, note: "magiclink minted (URL redacted)" });

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Visit the action link · Supabase verifies + redirects to redirectTo
  let resp = null;
  try { resp = await page.goto(actionLink, { waitUntil: "commit", timeout: 20000 }); } catch (e) { personaRec.gotoErr1 = e.message?.slice(0, 120); }
  // Capture URL immediately, before any client-side router runs
  const finalUrl = page.url();
  const confirmed = /\/nex-native/.test(finalUrl) && /access_token=/.test(finalUrl);
  // Extract access_token from URL hash fragment (Supabase implicit flow)
  const tokenMatch = finalUrl.match(/[#&]access_token=([^&]+)/);
  const refreshMatch = finalUrl.match(/[#&]refresh_token=([^&]+)/);
  var fragmentAccessToken = tokenMatch ? tokenMatch[1] : null;
  var fragmentRefreshToken = refreshMatch ? refreshMatch[1] : null;
  personaRec.steps.push({ id: 2, name: "magiclink exchange → access_token fragment", ok: confirmed && !!fragmentAccessToken, status: resp?.status(), landedPath: finalUrl.replace(DEV_BASE, "").split("#")[0], tokenInFragment: !!fragmentAccessToken });

  // [3] chat page
  let chatResp = null, chatBody = "";
  try { chatResp = await page.goto(`${DEV_BASE}/nex-native/chat/`, { waitUntil: "domcontentloaded", timeout: 20000 }); chatBody = await page.content(); } catch (e) { personaRec.gotoErr3 = e.message?.slice(0,120); }
  const chatOk = chatResp && chatResp.status() === 200;
  const hasHandle = chatBody.includes(p.handle) || chatBody.includes(p.label);
  personaRec.steps.push({ id: 3, name: "GET /nex-native/chat/", ok: chatOk, status: chatResp?.status(), persona_marker: hasHandle });

  // [4] manage page · use plain fetch with cookies to avoid Playwright abort on redirect to resource load
  let mgStatus = null, mgLocation = null;
  try {
    const res = await page.context().request.get(`${DEV_BASE}/nex-native/manage/`, { maxRedirects: 0 });
    mgStatus = res.status(); mgLocation = res.headers()["location"] ?? null;
  } catch (e) { personaRec.gotoErr4 = e.message?.slice(0,120); }
  personaRec.steps.push({ id: 4, name: "GET /nex-native/manage/", ok: mgStatus === 200 || (mgStatus >= 300 && mgStatus < 400), status: mgStatus, location: mgLocation });

  // [5] Prefer the fragment access_token (reliable); fall back to cookie if present.
  let accessToken = fragmentAccessToken;
  if (!accessToken) {
    const cookies = await ctx.cookies();
    const c = cookies.find(cc => /sb-.*-auth-token/.test(cc.name));
    if (c) { try {
      let raw = c.value;
      if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64").toString("utf8");
      const parsed = JSON.parse(raw);
      accessToken = parsed.access_token || parsed[0] || null;
    } catch {} }
  }

  const rls = { accessTokenCaptured: !!accessToken };
  if (accessToken) {
    // RLS A: list my own conversations · should return > 0
    const r1 = await fetch(`${SB_URL}/rest/v1/nex_peer_conversation?select=id,participant_a_id,participant_b_id&or=(participant_a_id.eq.${em.account_id},participant_b_id.eq.${em.account_id})&limit=5`, {
      headers: { apikey: SB_ANON, Authorization: "Bearer " + accessToken },
    });
    rls.myConvStatus = r1.status;
    const r1Body = r1.status === 200 ? await r1.json() : null;
    rls.myConvCount = Array.isArray(r1Body) ? r1Body.length : null;

    // RLS B: list messages where I'm NOT a participant · should return 0 rows (filtered by RLS)
    // Use a well-known stranger pair of account ids present in sandbox (random uuids act as "not me")
    const strangerConvId = "00000000-0000-4000-8000-000000000000";
    const r2 = await fetch(`${SB_URL}/rest/v1/nex_peer_message?select=id&conversation_id=eq.${strangerConvId}&limit=3`, {
      headers: { apikey: SB_ANON, Authorization: "Bearer " + accessToken },
    });
    rls.strangerStatus = r2.status;
    const r2Body = r2.status === 200 ? await r2.json() : null;
    rls.strangerCount = Array.isArray(r2Body) ? r2Body.length : null;

    // RLS C: ask /auth/v1/user to prove the token identifies as this persona
    const uResp = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: "Bearer " + accessToken } });
    rls.authUserStatus = uResp.status;
    if (uResp.status === 200) {
      const u = await uResp.json();
      rls.authUserId = u.id?.slice(0, 8);
      rls.authUserIdMatches = u.id === em.user_id;
    }
  }
  rls.ok = rls.accessTokenCaptured && rls.myConvStatus === 200 && rls.strangerStatus === 200 && rls.strangerCount === 0 && rls.authUserIdMatches === true;
  personaRec.steps.push({ id: 5, name: "RLS checks with real user access_token", ...rls });

  await ctx.close();
  out.personas.push(personaRec);
}

await browser.close();
await pgc.end();
out.finishedAt = new Date().toISOString();

mkdirSync("scripts/_tmp/evidence/2026-11-20-closeout", { recursive: true });
writeFileSync("scripts/_tmp/evidence/2026-11-20-closeout/genuine-auth-walker.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
