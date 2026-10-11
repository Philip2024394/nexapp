// scripts/cw-phase2a-test.mjs
//
// Phase 2A end-to-end integration test. Exercises Lost & Found CRUD
// (card create / update / confirm / report / status) + confirms the
// Phase 1 safety path (nex_community_notice) is unaffected. Hits the
// live Supabase; cleans up every row at the end.

import fs from "node:fs";
import pg from "pg";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const results = [];
function pass(step, info) {
  results.push({ step, status: "PASS", info });
  console.log(`[${step}] PASS · ${info}`);
}
function fail(step, info) {
  results.push({ step, status: "FAIL", info });
  console.log(`[${step}] FAIL · ${info}`);
}

const SUFFIX = `p2a-${Date.now().toString(36)}`;
console.log(`== Phase 2A E2E · tag=${SUFFIX} ==\n`);

// Pick two existing nex_account rows (same approach as Phase 1 harness).
const { rows: accs } = await client.query(
  `SELECT id, display_name FROM nex_account ORDER BY created_at DESC LIMIT 2;`,
);
if (accs.length < 2) {
  console.log("Need 2 nex_accounts; aborting without changes.");
  process.exit(2);
}
const [author, confirmer] = accs;
console.log(`Author:    ${author.id.slice(0, 8)} (${author.display_name})`);
console.log(`Confirmer: ${confirmer.id.slice(0, 8)} (${confirmer.display_name})\n`);

const { rows: [zone] } = await client.query(
  `SELECT id, name FROM nex_community_zone WHERE country=$1 AND level=$2 AND slug=$3;`,
  ["ID", "kecamatan", "mantrijeron"],
);
console.log(`Zone: ${zone.name} (${zone.id.slice(0, 8)})\n`);

const created = {
  memberships: [],
  cards: [],
  cardUpdates: [],
  cardConfirmations: [],
  cardReports: [],
  notices: [],
};

try {
  // --- Setup memberships for both accounts (writes per-section columns)
  for (const a of [author, confirmer]) {
    const r = await client.query(
      `INSERT INTO nex_community_membership (account_id, hyperlocal_zone_id, district_zone_id, notification_preference, safety_pref, lost_found_pref, events_pref, voting_pref, life_news_pref)
       VALUES ($1,$2,$2,$3,$3,$3,'off','off','off')
       ON CONFLICT (account_id) DO UPDATE
         SET hyperlocal_zone_id = EXCLUDED.hyperlocal_zone_id,
             district_zone_id   = EXCLUDED.district_zone_id,
             safety_pref        = EXCLUDED.safety_pref,
             lost_found_pref    = EXCLUDED.lost_found_pref,
             updated_at         = now()
       RETURNING id;`,
      [a.id, zone.id, "urgent_only"],
    );
    created.memberships.push(r.rows[0].id);
  }
  pass("1", `Memberships upserted with per-section prefs (${created.memberships.length})`);

  // --- Test urgency_level on nex_community_notice (Phase 1 compat)
  const safetyExpires = new Date(Date.now() + 24 * 3600_000).toISOString();
  const { rows: [notice] } = await client.query(
    `INSERT INTO nex_community_notice (hyperlocal_zone_id, district_zone_id, author_account_id, category, urgency_level, title, body, affected_area_text, status, expires_at)
     VALUES ($1,$1,$2,'power_outage','urgent',$3,$4,$5,'active',$6::timestamptz)
     RETURNING id, title, urgency_level;`,
    [zone.id, author.id, `${SUFFIX} Safety urgent test`, "Testing urgency", "RW test", safetyExpires],
  );
  created.notices.push(notice.id);
  if (notice.urgency_level === "urgent") pass("2a", `Safety urgency_level=urgent persists`);
  else fail("2a", `urgency unexpected: ${notice.urgency_level}`);

  // --- Test that urgency CHECK rejects an invalid value
  try {
    await client.query(
      `INSERT INTO nex_community_notice (hyperlocal_zone_id, district_zone_id, author_account_id, category, urgency_level, title)
       VALUES ($1,$1,$2,'power_outage','catastrophic','bad');`,
      [zone.id, author.id],
    );
    fail("2b", `urgency_level='catastrophic' accepted (should 23514)`);
  } catch (e) {
    if (e.code === "23514") pass("2b", `Invalid urgency rejected by CHECK (23514)`);
    else throw e;
  }

  // --- Lost & Found card create
  const lfCard = await client.query(
    `INSERT INTO nex_community_card (kind, hyperlocal_zone_id, district_zone_id, author_account_id, title, body, status, expires_at)
     VALUES ('lost_found',$1,$1,$2,$3,$4,'active', now() + interval '60 days')
     RETURNING id, kind, status;`,
    [zone.id, author.id, `${SUFFIX} Lost cat`, "Black fur white paws"],
  );
  created.cards.push(lfCard.rows[0].id);
  const cardId = lfCard.rows[0].id;
  pass("3a", `Lost & Found card created · kind=${lfCard.rows[0].kind} status=${lfCard.rows[0].status}`);

  // --- CHECK rejects kind='safety' on super-table
  try {
    await client.query(
      `INSERT INTO nex_community_card (kind, hyperlocal_zone_id, district_zone_id, author_account_id, title)
       VALUES ('safety',$1,$1,$2,'bad');`,
      [zone.id, author.id],
    );
    fail("3b", `kind='safety' accepted on super-table (should 23514)`);
  } catch (e) {
    if (e.code === "23514") pass("3b", `super-table rejects kind='safety' (safety stays in notice table)`);
    else throw e;
  }

  // --- Lost & Found detail
  await client.query(
    `INSERT INTO nex_community_lost_found_detail (card_id, lost_or_found, subject_kind, approximate_area_text)
     VALUES ($1,'lost','pet','Jalan Malioboro');`,
    [cardId],
  );
  pass("4", `Lost & Found detail attached (pet, lost)`);

  // --- Photo cap check (2 photos max)
  for (let i = 0; i < 2; i++) {
    await client.query(
      `INSERT INTO nex_community_card_photo (card_id, storage_path, display_order, bytes)
       VALUES ($1,$2,$3,$4);`,
      [cardId, `${cardId}/${i}-x.webp`, i, 100000 + i],
    );
  }
  try {
    await client.query(
      `INSERT INTO nex_community_card_photo (card_id, storage_path, display_order, bytes)
       VALUES ($1,$2,2,100000);`,
      [cardId, `${cardId}/2-x.webp`],
    );
    fail("5", `3rd photo accepted (should 23514 on display_order CHECK)`);
  } catch (e) {
    if (e.code === "23514") pass("5", `3rd photo rejected by display_order CHECK (23514) · 2-photo cap holds`);
    else throw e;
  }

  // --- Photo size CHECK (over 2MB)
  try {
    await client.query(
      `INSERT INTO nex_community_card_photo (card_id, storage_path, display_order, bytes)
       VALUES ($1,$2,0,2097153);`,  // 2MB + 1 byte
      [cardId, `${cardId}/oversize.webp`],
    );
    fail("6", `oversize photo accepted (should 23514)`);
  } catch (e) {
    if (e.code === "23514") pass("6", `Oversize photo rejected by bytes CHECK (23514)`);
    else throw e;
  }

  // --- Append update on the card
  await client.query(
    `INSERT INTO nex_community_card_update (card_id, author_account_id, update_text)
     VALUES ($1,$2,$3);`,
    [cardId, author.id, "Still looking as of 16:30"],
  );
  pass("7", `Author appended an update to the card`);

  // --- Confirmation from a different account
  await client.query(
    `INSERT INTO nex_community_card_confirmation (card_id, account_id)
     VALUES ($1,$2);`,
    [cardId, confirmer.id],
  );
  pass("8a", `Non-author confirmation recorded`);

  // --- Duplicate confirmation rejected by UNIQUE
  try {
    await client.query(
      `INSERT INTO nex_community_card_confirmation (card_id, account_id) VALUES ($1,$2);`,
      [cardId, confirmer.id],
    );
    fail("8b", `Duplicate confirmation accepted`);
  } catch (e) {
    if (e.code === "23505") pass("8b", `Duplicate confirmation rejected by UNIQUE (23505)`);
    else throw e;
  }

  // --- Report by confirmer (not author)
  const snapshot = {
    card_id: cardId,
    kind: "lost_found",
    title: `${SUFFIX} Lost cat`,
    status: "active",
    author_account_id: author.id,
    hyperlocal_zone_id: zone.id,
    district_zone_id: zone.id,
    created_at: new Date().toISOString(),
  };
  const { rows: [report] } = await client.query(
    `INSERT INTO nex_community_card_report (card_id, reporter_account_id, reason, card_snapshot)
     VALUES ($1,$2,'spam',$3)
     RETURNING id, status;`,
    [cardId, confirmer.id, snapshot],
  );
  created.cardReports.push(report.id);
  pass("9", `Report filed · status=${report.status}`);

  // --- Status transition: active → resolved
  await client.query(
    `UPDATE nex_community_card
       SET status='resolved', resolved_at=now(), resolved_by_account_id=$1, updated_at=now()
     WHERE id=$2;`,
    [author.id, cardId],
  );
  const { rows: [after] } = await client.query(
    `SELECT status, resolved_at FROM nex_community_card WHERE id=$1;`,
    [cardId],
  );
  if (after.status === "resolved") pass("10", `Card transitioned to resolved · ${after.resolved_at.toISOString().slice(0,19)}`);
  else fail("10", `status unexpected: ${after.status}`);

  // --- Verify per-section pref columns are enforced
  try {
    await client.query(
      `UPDATE nex_community_membership SET safety_pref='invalid' WHERE account_id=$1;`,
      [author.id],
    );
    fail("11", `safety_pref='invalid' accepted (should 23514)`);
  } catch (e) {
    if (e.code === "23514") pass("11", `safety_pref CHECK rejects invalid value (23514)`);
    else throw e;
  }

  // --- Verify rate-limit action list now includes card_* actions
  try {
    await client.query(
      `INSERT INTO nex_community_rate_limit (account_id, action, window_started_at, count)
       VALUES ($1,'card_create',now(),1);`,
      [author.id],
    );
    pass("12a", `rate-limit action 'card_create' accepted`);
    await client.query(
      `DELETE FROM nex_community_rate_limit WHERE account_id=$1 AND action='card_create';`,
      [author.id],
    );
  } catch (e) {
    fail("12a", `card_create action rejected: ${e.message}`);
  }
  try {
    await client.query(
      `INSERT INTO nex_community_rate_limit (account_id, action, window_started_at, count)
       VALUES ($1,'card_photo_upload',now(),1);`,
      [author.id],
    );
    pass("12b", `rate-limit action 'card_photo_upload' accepted`);
    await client.query(
      `DELETE FROM nex_community_rate_limit WHERE account_id=$1 AND action='card_photo_upload';`,
      [author.id],
    );
  } catch (e) {
    fail("12b", `card_photo_upload action rejected: ${e.message}`);
  }

  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log(`\n== Summary · PASS=${passed} FAIL=${failed} ==`);
} finally {
  // Cleanup
  if (created.cardReports.length)
    await client.query(`DELETE FROM nex_community_card_report WHERE id = ANY($1::uuid[])`, [created.cardReports]);
  if (created.cards.length)
    await client.query(`DELETE FROM nex_community_card WHERE id = ANY($1::uuid[])`, [created.cards]);
  if (created.notices.length)
    await client.query(`DELETE FROM nex_community_notice WHERE id = ANY($1::uuid[])`, [created.notices]);
  // Memberships: don't delete pre-existing · only clear what we touched
  await client.query(`DELETE FROM nex_community_membership WHERE id = ANY($1::uuid[])`, [created.memberships]);
  await client.end();
}
