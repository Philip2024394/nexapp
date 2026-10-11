// scripts/cw-e2e-test.mjs
//
// NEX Community Watch · end-to-end verification against production.
// Requires two legitimate test accounts (created via admin API, no bypass).
// Loads /tmp/cw-test.json with their access tokens + cookies.

import fs from "node:fs";
import pg from "pg";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const BASE = "https://nexapp-mu.vercel.app";
const state = JSON.parse(fs.readFileSync("/tmp/cw-test.json", "utf8"));

const results = [];
function pass(step, info) {
  results.push({ step, status: "PASS", info });
  console.log(`[${step}] PASS · ${info}`);
}
function fail(step, info) {
  results.push({ step, status: "FAIL", info });
  console.log(`[${step}] FAIL · ${info}`);
}

async function call(method, path, headers = {}, body) {
  const h = { ...headers, "Content-Type": "application/json" };
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : null,
  });
  const t = await r.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    j = t;
  }
  return { status: r.status, body: j, raw: t };
}

const cookieA = { Cookie: state.cookieHeaderA };
const cookieB = { Cookie: state.cookieHeaderB };

// Step 1 · Sign in without dev bypass (already done pre-script)
const sip = await fetch(`${BASE}/nex-native/sign-in`);
const sipHtml = await sip.text();
if (
  sip.status === 200 &&
  !/signInAsDevAdminAction|data-nex-sign-in-dev-admin|NEX_ALLOW_DEV_ADMIN/.test(sipHtml)
)
  pass("1", "sign-in page serves · dev-admin form NOT rendered");
else fail("1", `unexpected · HTTP ${sip.status} · dev-admin markers present`);

// Step 2 · Pinned Community Watch entry in Contacts
const contacts = await call("GET", "/nex-native/contacts", cookieA);
if (
  contacts.status === 200 &&
  /NEX Community Watch/.test(contacts.raw) &&
  /data-nex-contacts-system-entry="community-watch"/.test(contacts.raw)
)
  pass(
    "2",
    `Contacts page served (${contacts.raw.length}B) · pinned entry present`,
  );
else fail("2", `Contacts page HTTP ${contacts.status}`);

// Step 3 · Confirm membership
const zones = await call("GET", "/api/nex-native/community/zones/suggest", cookieA);
const mantrijeron = (zones.body.zones ?? []).find(
  (z) => z.slug === "mantrijeron",
);
if (!mantrijeron) {
  fail("3", "mantrijeron zone not found in suggest list");
  process.exit(2);
}
const confirm = await call("POST", "/api/nex-native/community/membership", cookieA, {
  hyperlocalZoneId: mantrijeron.id,
  notificationPreference: "urgent_only",
});
if (
  confirm.status === 200 &&
  confirm.body.membership &&
  confirm.body.membership.hyperlocal_zone_id === mantrijeron.id
)
  pass("3", `Confirmed membership to ${mantrijeron.name}`);
else fail("3", `confirm HTTP ${confirm.status}`);

await call("POST", "/api/nex-native/community/membership", cookieB, {
  hyperlocalZoneId: mantrijeron.id,
  notificationPreference: "quiet",
});

// Step 4 · Persist across refresh
const persist = await call("GET", "/api/nex-native/community/membership", cookieA);
if (
  persist.status === 200 &&
  persist.body.membership &&
  persist.body.membership.hyperlocal_zone_id === mantrijeron.id
)
  pass(
    "4",
    `Membership persisted · pref=${persist.body.membership.notification_preference}`,
  );
else fail("4", `persist HTTP ${persist.status}`);

// Step 5 · Open the feed
const feed = await call(
  "GET",
  "/api/nex-native/community/notices?level=hyperlocal",
  cookieA,
);
if (
  feed.status === 200 &&
  Array.isArray(feed.body.notices) &&
  feed.body.zoneId === mantrijeron.id
)
  pass(
    "5",
    `Feed served · zoneId matches · ${feed.body.notices.length} existing notices`,
  );
else fail("5", `feed HTTP ${feed.status}`);

// Step 6 · Create a permitted notice
const noticeTitle = `E2E power outage ${state.SUFFIX}`;
const create = await call("POST", "/api/nex-native/community/notices", cookieA, {
  category: "power_outage",
  title: noticeTitle,
  body: "Testing create",
  affectedAreaText: "RW test",
});
if (
  create.status === 201 &&
  create.body.notice &&
  create.body.notice.title === noticeTitle
)
  pass(
    "6",
    `Notice created · id=${create.body.notice.id.slice(0, 8)} · status=${create.body.notice.status}`,
  );
else {
  fail("6", `create HTTP ${create.status}`);
  process.exit(2);
}
const noticeId = create.body.notice.id;
state.e2eNoticeId = noticeId;

// Step 6b · DB persistence
const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();
const dbRow = await client.query(
  `SELECT title, status, category, author_account_id, hyperlocal_zone_id FROM nex_community_notice WHERE id=$1`,
  [noticeId],
);
if (dbRow.rows.length === 1 && dbRow.rows[0].title === noticeTitle)
  pass("6b", `DB confirms persistence · author=${dbRow.rows[0].author_account_id.slice(0, 8)}`);
else fail("6b", `DB row missing or mismatched`);

// Step 7 · Second account visibility + confirmation + report
const bFeed = await call(
  "GET",
  "/api/nex-native/community/notices?level=hyperlocal",
  cookieB,
);
if (
  bFeed.status === 200 &&
  (bFeed.body.notices ?? []).some((n) => n.id === noticeId)
)
  pass("7a", `Account B sees A's notice in feed`);
else fail("7a", `B feed HTTP ${bFeed.status}`);

const bConfirm = await call(
  "POST",
  `/api/nex-native/community/notices/${noticeId}/confirm`,
  cookieB,
);
if (bConfirm.status === 200 && bConfirm.body.ok)
  pass("7b", `Account B successfully confirmed`);
else fail("7b", `B confirm HTTP ${bConfirm.status}`);

const bReport = await call(
  "POST",
  `/api/nex-native/community/notices/${noticeId}/report`,
  cookieB,
  { reason: "spam", note: "testing report path" },
);
if (bReport.status === 201 && bReport.body.report)
  pass(
    "7c",
    `Account B successfully reported · status=${bReport.body.report.status}`,
  );
else fail("7c", `B report HTTP ${bReport.status}`);
state.e2eReportId = bReport.body?.report?.id;

// Step 8 · Authorization boundaries
const dupConfirm = await call(
  "POST",
  `/api/nex-native/community/notices/${noticeId}/confirm`,
  cookieB,
);
if (dupConfirm.status === 200)
  pass("8a", "Duplicate confirmation handled idempotently · HTTP 200");
else fail("8a", `dup confirm HTTP ${dupConfirm.status}`);

const selfConfirm = await call(
  "POST",
  `/api/nex-native/community/notices/${noticeId}/confirm`,
  cookieA,
);
if (selfConfirm.status === 403)
  pass("8b", "Author cannot confirm own notice · HTTP 403");
else fail("8b", `self-confirm HTTP ${selfConfirm.status}`);

const bUpdate = await call(
  "POST",
  `/api/nex-native/community/notices/${noticeId}/update`,
  cookieB,
  { updateText: "B unauthorized update attempt" },
);
if (bUpdate.status === 403)
  pass("8c", "Non-author update rejected · HTTP 403");
else fail("8c", `B update HTTP ${bUpdate.status}`);

const aReport = await call(
  "POST",
  `/api/nex-native/community/notices/${noticeId}/report`,
  cookieA,
  { reason: "spam" },
);
if (aReport.status === 403)
  pass("8d", "Author cannot report own notice · HTTP 403");
else fail("8d", `A self-report HTTP ${aReport.status}`);

// Step 9 · Status transitions
const upd1 = await call(
  "POST",
  `/api/nex-native/community/notices/${noticeId}/update`,
  cookieA,
  { updateText: "Still out as of 15:30" },
);
if (upd1.status === 201) pass("9a", "Author posted update");
else fail("9a", `upd1 HTTP ${upd1.status}`);

const upd2 = await call(
  "POST",
  `/api/nex-native/community/notices/${noticeId}/update`,
  cookieA,
  { updateText: "Resolved at 16:00", markResolved: true },
);
if (upd2.status === 201) pass("9b", "Author marked resolved via update");
else fail("9b", `upd2 HTTP ${upd2.status}`);

const detail = await call(
  "GET",
  `/api/nex-native/community/notices/${noticeId}`,
  cookieA,
);
if (
  detail.status === 200 &&
  detail.body.notice.status === "resolved" &&
  detail.body.updates.length >= 2 &&
  detail.body.confirmationsCount === 1
)
  pass(
    "9c",
    `Status=resolved · updates=${detail.body.updates.length} · confirmations=${detail.body.confirmationsCount}`,
  );
else
  fail(
    "9c",
    `detail status=${detail.body.notice?.status} updates=${detail.body.updates?.length} conf=${detail.body.confirmationsCount}`,
  );

// Step 10 · Privacy / prohibited categories
const badCat = await call("POST", "/api/nex-native/community/notices", cookieA, {
  category: "suspicious_person",
  title: "should fail",
});
if (badCat.status === 400)
  pass("10a", "suspicious_person rejected at API · HTTP 400");
else fail("10a", `bad category HTTP ${badCat.status}`);

const badCrime = await call("POST", "/api/nex-native/community/notices", cookieA, {
  category: "crime",
  title: "should fail",
});
if (badCrime.status === 400)
  pass("10b", "crime category rejected at API · HTTP 400");
else fail("10b", `crime HTTP ${badCrime.status}`);

// 10c · No photo column (field silently dropped at API; schema has no column)
const probePhoto = await call("POST", "/api/nex-native/community/notices", cookieA, {
  category: "power_outage",
  title: "photo field probe",
  photo_url: "https://evil.example/x.jpg",
});
if (probePhoto.status === 201) {
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name=$1`,
    ["nex_community_notice"],
  );
  const hasPhotoCol = cols.rows.some((r) => /photo|attach|image/i.test(r.column_name));
  if (!hasPhotoCol)
    pass("10c", `No photo/attachment column in schema · field silently dropped`);
  else fail("10c", `photo column leaked into schema`);
  await client.query(`DELETE FROM nex_community_notice WHERE id=$1`, [
    probePhoto.body.notice.id,
  ]);
} else fail("10c", `probe create HTTP ${probePhoto.status}`);

// 10d · No GPS/coord columns
const cols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name=$1`,
  ["nex_community_notice"],
);
const hasGps = cols.rows.some((r) => /lat|lon|coord|gps|geo/i.test(r.column_name));
if (!hasGps)
  pass(
    "10d",
    `No lat/lon/coord/gps column in notice schema · GPS cannot leak`,
  );
else fail("10d", `geographic coordinate column present`);

// Step 11 · Notification preference change
const pref = await call("PATCH", "/api/nex-native/community/membership", cookieA, {
  notificationPreference: "all",
});
if (pref.status === 200 && pref.body.membership.notification_preference === "all")
  pass("11", `Preference updated to "all"`);
else fail("11", `pref HTTP ${pref.status}`);
// reset to urgent_only
await call("PATCH", "/api/nex-native/community/membership", cookieA, {
  notificationPreference: "urgent_only",
});

// Step 12 · Unauth vs auth
const unauth = await fetch(`${BASE}/api/nex-native/community/notices`);
const authed = await call("GET", "/api/nex-native/community/notices", cookieA);
if (unauth.status === 401 && authed.status === 200)
  pass("12", "Unauth=401 · Authed=200");
else fail("12", `unauth=${unauth.status} authed=${authed.status}`);

// Summary
const p = results.filter((r) => r.status === "PASS").length;
const f = results.filter((r) => r.status === "FAIL").length;
console.log(`\n== Summary · PASS=${p}  FAIL=${f} ==`);
await client.end();
fs.writeFileSync("/tmp/cw-test.json", JSON.stringify(state));
process.exit(f > 0 ? 2 : 0);
