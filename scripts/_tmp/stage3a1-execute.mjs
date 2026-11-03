#!/usr/bin/env node
// Stage 3A.1 execution · sandbox only.
// Owner authorisation 2026-11-01 (Option B flow).
//
// Scope (strict):
//   · 2 placements for Irish Pride (nex-99901) in IE
//     - music_track b6b68909 Hotel California (Irish Style)
//     - music_track 076bab93 Stand By Me Irish Style
//   · Each: INSERT pending → UPDATE to approved by HQ Admin (nex-90001)
//     → INSERT nex_hq_action_log entry
//   · Single transaction · roll back everything on any failure
//   · Each UPDATE must affect exactly 1 row or abort
//   · No touch to content visibility / profiles / media / worldwide feed
//
// Verification after commit · reports exact IDs + final state.

import pg from "pg";

const SBX_DB = process.env.SBX_DB;
if (!SBX_DB) throw new Error("SBX_DB not set");
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("safeguard · production ref");
if (!SBX_DB.includes("kdstoyyeygcopkogqsyv")) throw new Error("safeguard · unexpected sandbox ref");

const IRISH_PRIDE = "11111111-1111-4111-8111-111111111111"; // nex-99901
const HQ_ADMIN = "57fa2ccf-5d35-4697-8ef5-50507c05f1c9"; // nex-90001

const TRACKS = [
  { id: "b6b68909-4f4c-4281-aaf7-e24f8d58a9ad", title: "Hotel California (Irish Style)" },
  { id: "076bab93-6a25-4022-b570-410aca2b75f5", title: "Stand By Me Irish Style" },
];

const c = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const insertedPlacementIds = [];
const insertedAuditIds = [];

try {
  await c.query("BEGIN");

  for (const track of TRACKS) {
    // Step 1 · creator INSERT pending
    const ins = await c.query(
      `INSERT INTO public.nex_country_placement
         (content_type, content_id, country, placement_status, requested_by)
       VALUES ('music_track', $1, 'IE', 'pending', $2)
       RETURNING id`,
      [track.id, IRISH_PRIDE],
    );
    const placementId = ins.rows[0].id;
    insertedPlacementIds.push({ track: track.title, trackId: track.id, placementId });
    console.log(`  [${track.title}] placement inserted · id=${placementId} · status=pending`);

    // Step 2 · HQ Admin UPDATE pending → approved
    const upd = await c.query(
      `UPDATE public.nex_country_placement
          SET placement_status = 'approved',
              reviewed_by      = $1,
              reviewed_at      = now(),
              reviewer_reason  = 'Stage 3A.1 Ireland test launch',
              updated_at       = now()
        WHERE id = $2
          AND placement_status = 'pending'`,
      [HQ_ADMIN, placementId],
    );
    if (upd.rowCount !== 1) {
      throw new Error(`UPDATE rowCount=${upd.rowCount} for placementId=${placementId} · must be exactly 1 · aborting`);
    }
    console.log(`  [${track.title}] placement approved · rowCount=1`);

    // Step 3 · audit log entry
    const audit = await c.query(
      `INSERT INTO public.nex_hq_action_log
         (actor_account_id, action, content_type, content_id, country,
          previous_status, new_status, reason, metadata)
       VALUES ($1, 'country_placement_approved', 'music_track', $2, 'IE',
               'pending', 'approved',
               $3,
               $4::jsonb)
       RETURNING id`,
      [
        HQ_ADMIN,
        track.id,
        `Stage 3A.1 Ireland test launch · ${track.title}`,
        JSON.stringify({
          stage: "3A.1",
          placement_id: placementId,
          worldwide_feed_unchanged: true,
        }),
      ],
    );
    const auditId = audit.rows[0].id;
    insertedAuditIds.push({ track: track.title, auditId });
    console.log(`  [${track.title}] audit entry inserted · id=${auditId}`);
  }

  // Pre-commit sanity · exactly 2 approved placements for Irish Pride in IE
  const sanity = await c.query(
    `SELECT count(*)::int AS n FROM public.nex_country_placement
      WHERE country='IE' AND placement_status='approved' AND requested_by=$1`,
    [IRISH_PRIDE],
  );
  if (sanity.rows[0].n !== 2) {
    throw new Error(`pre-commit sanity failed · expected 2 approved IE placements · got ${sanity.rows[0].n}`);
  }

  // Pre-commit sanity · Irish Pride track visibility unchanged
  const vis = await c.query(
    `SELECT visibility, count(*)::int AS n FROM public.nex_music_track
      WHERE owner_account_id = $1 GROUP BY visibility ORDER BY visibility`,
    [IRISH_PRIDE],
  );
  const priv = vis.rows.find((r) => r.visibility === "private")?.n;
  const shared = vis.rows.find((r) => r.visibility === "shared_live")?.n;
  if (priv !== 4 || shared !== 2) {
    throw new Error(`pre-commit visibility baseline failed · expected 4 private + 2 shared_live · got ${priv} private + ${shared} shared_live`);
  }
  console.log(`  pre-commit sanity: 2 approved placements · 4 private + 2 shared_live preserved`);

  await c.query("COMMIT");
  console.log("\nCOMMIT · transaction succeeded");
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.log(`\nROLLBACK · ${e.message}`);
  process.exitCode = 1;
}

// ============================================================================
// Post-commit verification · fresh connection view of persisted state
// ============================================================================
console.log("\n=== Post-commit verification ===");

const plc = await c.query(
  `SELECT p.id, p.content_id, p.country, p.placement_status,
          p.requested_by, p.reviewed_by, p.reviewed_at, p.reviewer_reason, p.created_at,
          t.title
     FROM public.nex_country_placement p
     JOIN public.nex_music_track t ON t.id = p.content_id
    WHERE p.country='IE'
    ORDER BY t.title`,
);
console.log(`\nnex_country_placement (IE):`);
for (const r of plc.rows) {
  console.log(`  ${r.title}`);
  console.log(`    placement_id = ${r.id}`);
  console.log(`    content_id   = ${r.content_id}`);
  console.log(`    status       = ${r.placement_status}`);
  console.log(`    requested_by = ${r.requested_by}`);
  console.log(`    reviewed_by  = ${r.reviewed_by}`);
  console.log(`    reviewed_at  = ${r.reviewed_at.toISOString()}`);
  console.log(`    reason       = ${r.reviewer_reason}`);
}

const al = await c.query(
  `SELECT id, actor_account_id, action, content_type, content_id, country,
          previous_status, new_status, reason, metadata, created_at
     FROM public.nex_hq_action_log
    ORDER BY created_at`,
);
console.log(`\nnex_hq_action_log:`);
for (const r of al.rows) {
  console.log(`  audit_id         = ${r.id}`);
  console.log(`    actor          = ${r.actor_account_id}`);
  console.log(`    action         = ${r.action}`);
  console.log(`    content_type   = ${r.content_type}`);
  console.log(`    content_id     = ${r.content_id}`);
  console.log(`    country        = ${r.country}`);
  console.log(`    ${r.previous_status} → ${r.new_status}`);
  console.log(`    reason         = ${r.reason}`);
  console.log(`    metadata       = ${JSON.stringify(r.metadata)}`);
  console.log(`    created_at     = ${r.created_at.toISOString()}`);
}

console.log(`\nIrish Pride tracks · visibility unchanged check:`);
const ip = await c.query(
  "SELECT id, title, visibility FROM public.nex_music_track WHERE owner_account_id = $1 ORDER BY visibility, title",
  [IRISH_PRIDE],
);
let privCount = 0, sharedCount = 0;
for (const r of ip.rows) {
  console.log(`  ${r.visibility.padEnd(11)} · ${r.title}`);
  if (r.visibility === "private") privCount++;
  if (r.visibility === "shared_live") sharedCount++;
}
if (privCount === 4 && sharedCount === 2) {
  console.log(`  PASS · 4 private + 2 shared_live preserved exactly`);
} else {
  console.log(`  FAIL · expected 4 private + 2 shared_live · got ${privCount} private + ${sharedCount} shared_live`);
  process.exitCode = 1;
}

await c.end();

console.log("\n==========================================");
console.log("Stage 3A.1 complete · sandbox only");
console.log("==========================================");
