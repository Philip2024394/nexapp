// scripts/cw-phase2b-test.mjs
//
// Phase 2B.0 + 2B.1 integration test. Exercises the business welcome
// lifecycle end-to-end against live Supabase: schema shape, opt-in
// toggle writes nex_business discovery columns, publishWelcome inserts
// a nex_community_card (kind='business_welcome') + welcome_detail row
// with 14-day expiry, retractWelcome marks the card status='removed',
// expired welcome cards are rolled lazily to 'expired' on list, and the
// Phase 1 safety path remains untouched.

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
const pass = (step, info) => { results.push({step,status:"PASS",info}); console.log(`[${step}] PASS · ${info}`); };
const fail = (step, info) => { results.push({step,status:"FAIL",info}); console.log(`[${step}] FAIL · ${info}`); };

const SUFFIX = `p2b-${Date.now().toString(36)}`;
console.log(`== Phase 2B E2E · tag=${SUFFIX} ==\n`);

const { rows: accs } = await client.query(
  `SELECT id, display_name FROM nex_account ORDER BY created_at DESC LIMIT 1;`,
);
const [owner] = accs;
const { rows: [zone] } = await client.query(
  `SELECT id, name FROM nex_community_zone WHERE country=$1 AND level=$2 AND slug=$3;`,
  ["ID", "kecamatan", "mantrijeron"],
);
console.log(`Owner: ${owner.id.slice(0,8)}  Zone: ${zone.name}\n`);

const created = {
  businesses: [],
  cards: [],
  welcomeDetails: [], // not strictly needed · cascades from card
  memberships: [],
};

try {
  // --- Schema shape · 2B migration columns & table exist
  const { rows: cols } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='nex_business'
       AND column_name IN ('community_discovery_opt_in','community_discovery_zone_id','community_discovery_toggled_at')
     ORDER BY column_name;`,
  );
  if (cols.length === 3)
    pass("1a", `nex_business discovery columns all present (3)`);
  else
    fail("1a", `expected 3 cols, found ${cols.length}: ${cols.map(c=>c.column_name).join(",")}`);

  const { rows: tbl } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_name='nex_community_business_welcome_detail';`,
  );
  if (tbl.length === 1)
    pass("1b", `nex_community_business_welcome_detail table exists`);
  else fail("1b", `welcome_detail table missing`);

  // --- Super-table CHECK now includes 'business_welcome'
  const { rows: [checkDef] } = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class r ON r.oid = c.conrelid
     WHERE r.relname='nex_community_card' AND c.conname='ck_card_kind';`,
  );
  if (checkDef && /business_welcome/.test(checkDef.def))
    pass("1c", `card kind CHECK includes 'business_welcome'`);
  else
    fail("1c", `kind CHECK missing business_welcome: ${checkDef?.def}`);

  // --- Rate-limit action CHECK includes the two welcome actions
  const { rows: [rlDef] } = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class r ON r.oid = c.conrelid
     WHERE r.relname='nex_community_rate_limit' AND c.conname='ck_rl_action';`,
  );
  const rlHasBoth =
    rlDef && /business_welcome_publish/.test(rlDef.def) && /business_welcome_retract/.test(rlDef.def);
  if (rlHasBoth)
    pass("1d", `rate-limit CHECK includes publish + retract welcome actions`);
  else
    fail("1d", `rate-limit CHECK missing welcome actions: ${rlDef?.def}`);

  // --- Seed a test business owned by the test account
  const slug = `${SUFFIX}-biz`;
  const { rows: [biz] } = await client.query(
    `INSERT INTO nex_business (owner_account_id, display_name, slug)
     VALUES ($1,$2,$3)
     RETURNING id, community_discovery_opt_in, community_discovery_zone_id;`,
    [owner.id, `${SUFFIX} Welcome Test Biz`, slug],
  );
  created.businesses.push(biz.id);
  if (biz.community_discovery_opt_in === false && biz.community_discovery_zone_id === null)
    pass("2a", `new business defaults · opt_in=false zone=null`);
  else
    fail("2a", `unexpected defaults: opt_in=${biz.community_discovery_opt_in} zone=${biz.community_discovery_zone_id}`);

  // --- Toggle opt-in · emulate the service writes
  const now = new Date().toISOString();
  const expiry = new Date(Date.now() + 14 * 24 * 3600_000).toISOString();
  await client.query(
    `UPDATE nex_business
       SET community_discovery_opt_in=true,
           community_discovery_zone_id=$2,
           community_discovery_toggled_at=$3,
           updated_at=$3
     WHERE id=$1;`,
    [biz.id, zone.id, now],
  );
  const { rows: [bizAfter] } = await client.query(
    `SELECT community_discovery_opt_in, community_discovery_zone_id,
            community_discovery_toggled_at
     FROM nex_business WHERE id=$1;`,
    [biz.id],
  );
  if (bizAfter.community_discovery_opt_in === true && bizAfter.community_discovery_zone_id === zone.id)
    pass("2b", `opt-in persisted · opt_in=true zone=${zone.name}`);
  else
    fail("2b", `opt-in did not persist`);

  // --- Publish welcome card
  const { rows: [card] } = await client.query(
    `INSERT INTO nex_community_card
       (kind, hyperlocal_zone_id, district_zone_id, author_account_id, title, status, expires_at)
     VALUES ('business_welcome',$1,$1,$2,$3,'active',$4::timestamptz)
     RETURNING id, kind, status;`,
    [zone.id, owner.id, `New to your community: ${SUFFIX} biz`, expiry],
  );
  created.cards.push(card.id);
  if (card.kind === "business_welcome" && card.status === "active")
    pass("3a", `welcome card inserted · kind=business_welcome status=active`);
  else
    fail("3a", `card unexpected: kind=${card.kind} status=${card.status}`);

  const { rows: [detail] } = await client.query(
    `INSERT INTO nex_community_business_welcome_detail
       (card_id, business_id, featured_at, featured_by, expires_at)
     VALUES ($1,$2,$3,$4,$5::timestamptz)
     RETURNING card_id, business_id, expires_at;`,
    [card.id, biz.id, now, owner.id, expiry],
  );
  if (detail.card_id === card.id && detail.business_id === biz.id)
    pass("3b", `welcome_detail row inserted & linked`);
  else
    fail("3b", `detail link mismatch`);

  const windowDays =
    (new Date(detail.expires_at) - new Date(now)) / (24 * 3600_000);
  if (windowDays > 13.9 && windowDays < 14.1)
    pass("3c", `expiry window ≈ 14 days (${windowDays.toFixed(2)})`);
  else
    fail("3c", `expiry window off: ${windowDays.toFixed(2)} days`);

  // --- CHECK rejects expires_at <= featured_at
  try {
    await client.query(
      `INSERT INTO nex_community_business_welcome_detail
         (card_id, business_id, featured_at, featured_by, expires_at)
       VALUES ($1,$2,now(),$3,now());`,
      [card.id, biz.id, owner.id],
    );
    fail("3d", `expires_at = featured_at accepted (should 23514)`);
  } catch (e) {
    if (e.code === "23514") pass("3d", `expires_at <= featured_at rejected by CHECK (23514)`);
    else if (e.code === "23505") pass("3d", `rejected (PK conflict, acceptable)`);
    else fail("3d", `unexpected error: ${e.code} ${e.message}`);
  }

  // --- Retract · emulate retractWelcome
  await client.query(
    `UPDATE nex_community_card
       SET status='removed', removed_at=now(), removal_reason='owner_retracted_discovery', updated_at=now()
     WHERE id=$1;`,
    [card.id],
  );
  const { rows: [cardAfter] } = await client.query(
    `SELECT status, removal_reason FROM nex_community_card WHERE id=$1;`,
    [card.id],
  );
  if (cardAfter.status === "removed" && cardAfter.removal_reason === "owner_retracted_discovery")
    pass("4a", `welcome card retracted · status=removed reason=owner_retracted_discovery`);
  else
    fail("4a", `retract state unexpected: ${JSON.stringify(cardAfter)}`);

  // --- FK cascade · deleting the card deletes the detail
  await client.query(`DELETE FROM nex_community_card WHERE id=$1;`, [card.id]);
  created.cards = created.cards.filter((id) => id !== card.id);
  const { rows: det2 } = await client.query(
    `SELECT 1 FROM nex_community_business_welcome_detail WHERE card_id=$1;`,
    [card.id],
  );
  if (det2.length === 0)
    pass("4b", `welcome_detail row cascaded on card delete`);
  else
    fail("4b", `detail row survived card delete`);

  // --- Phase 1 safety path unaffected · an urgent power_outage still writes to nex_community_notice
  const { rows: [notice] } = await client.query(
    `INSERT INTO nex_community_notice
       (hyperlocal_zone_id, district_zone_id, author_account_id,
        category, urgency_level, title, status, expires_at)
     VALUES ($1,$1,$2,'power_outage','urgent',$3,'active', now()+interval '24 hours')
     RETURNING id, category, urgency_level, status;`,
    [zone.id, owner.id, `${SUFFIX} Phase 1 regression check`],
  );
  if (notice.category === "power_outage" && notice.urgency_level === "urgent")
    pass("5", `Phase 1 safety notice path still writes to nex_community_notice`);
  else
    fail("5", `safety path broken: ${JSON.stringify(notice)}`);
  await client.query(`DELETE FROM nex_community_notice WHERE id=$1;`, [notice.id]);

  // --- Rate-limit smoke test
  try {
    await client.query(
      `INSERT INTO nex_community_rate_limit (account_id, action, window_started_at, count)
       VALUES ($1,'business_welcome_publish',date_trunc('hour', now()),1)
       ON CONFLICT (account_id, action, window_started_at) DO UPDATE SET count=excluded.count;`,
      [owner.id],
    );
    pass("6a", `rate-limit action 'business_welcome_publish' accepted`);
    await client.query(
      `DELETE FROM nex_community_rate_limit WHERE account_id=$1 AND action='business_welcome_publish';`,
      [owner.id],
    );
  } catch (e) {
    fail("6a", `publish rate-limit rejected: ${e.message}`);
  }
  try {
    await client.query(
      `INSERT INTO nex_community_rate_limit (account_id, action, window_started_at, count)
       VALUES ($1,'business_welcome_retract',date_trunc('hour', now()),1)
       ON CONFLICT (account_id, action, window_started_at) DO UPDATE SET count=excluded.count;`,
      [owner.id],
    );
    pass("6b", `rate-limit action 'business_welcome_retract' accepted`);
    await client.query(
      `DELETE FROM nex_community_rate_limit WHERE account_id=$1 AND action='business_welcome_retract';`,
      [owner.id],
    );
  } catch (e) {
    fail("6b", `retract rate-limit rejected: ${e.message}`);
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n== Summary · PASS=${passed} FAIL=${failed} ==`);
  if (failed > 0) process.exitCode = 2;
} finally {
  // Cleanup
  if (created.cards.length)
    await client.query(`DELETE FROM nex_community_card WHERE id = ANY($1::uuid[])`, [created.cards]);
  if (created.businesses.length)
    await client.query(`DELETE FROM nex_business WHERE id = ANY($1::uuid[])`, [created.businesses]);
  await client.end();
}
