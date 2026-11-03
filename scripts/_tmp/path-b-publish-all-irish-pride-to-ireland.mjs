#!/usr/bin/env node
// Path B · publish all 4 private Irish Pride tracks to Ireland feed.
// Sandbox-only · atomic (single transaction) · rolled back on any
// failure. Owner-authorised 2026-11-01.
//
// Per track:
//   1. UPDATE nex_music_track SET visibility='shared_live' WHERE id=X
//      AND visibility='private' (exactly 1 row)
//   2. INSERT INTO nex_country_placement (pending) requested_by=Irish Pride
//      (exactly 1 row)
//   3. UPDATE nex_country_placement SET placement_status='approved',
//      reviewed_by=HQ Admin, ... WHERE id=<new placement> (exactly 1 row)
//   4. INSERT INTO nex_hq_action_log (country_placement_approved)
//      (exactly 1 row)
//
// Pre-commit sanity:
//   · all 6 Irish Pride tracks visibility=shared_live
//   · all 6 have approved IE placements
//   · 0 tracks visibility=removed (defensive)
//
// Post-commit verification report.

import pg from "pg";
const SBX_DB = process.env.SBX_DB;
if (!SBX_DB) throw new Error("SBX_DB not set");
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("safeguard · production ref");
if (!SBX_DB.includes("kdstoyyeygcopkogqsyv")) throw new Error("safeguard · unexpected sandbox ref");

const IRISH_PRIDE = "11111111-1111-4111-8111-111111111111"; // nex-99901
const HQ_ADMIN    = "57fa2ccf-5d35-4697-8ef5-50507c05f1c9"; // nex-90001

// Private tracks to publish (verified from earlier Stage 3A.1 check):
const PRIVATE_TRACKS = [
  { id: "acfb6f29-9ac2-4673-aa2c-e201b3335b61", title: "Dirty Old Town" },
  { id: "93b1a638-c8b6-491c-9844-02b90a06b179", title: "Nosey Bridie" },
  { id: "b3c3b592-c4a3-45de-af6d-8b93e79ed4ce", title: "Taking One for the Team" },
  { id: "4cc8e6e9-9520-40ae-ac9a-74cbcbc80d2f", title: "Tell Me Ma" },
];

const c = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const inserted = { placements: [], audits: [], visibilityFlips: [] };

try {
  await c.query("BEGIN");

  for (const track of PRIVATE_TRACKS) {
    // Step 1 · flip visibility private → shared_live
    const flip = await c.query(
      `UPDATE public.nex_music_track
          SET visibility = 'shared_live'
        WHERE id = $1
          AND visibility = 'private'`,
      [track.id],
    );
    if (flip.rowCount !== 1) {
      throw new Error(`visibility flip rowCount=${flip.rowCount} for ${track.title} (${track.id}) · expected 1 · aborting`);
    }
    inserted.visibilityFlips.push({ track: track.title, trackId: track.id });

    // Step 2 · creator INSERT pending placement
    const ins = await c.query(
      `INSERT INTO public.nex_country_placement
         (content_type, content_id, country, placement_status, requested_by)
       VALUES ('music_track', $1, 'IE', 'pending', $2)
       RETURNING id`,
      [track.id, IRISH_PRIDE],
    );
    const placementId = ins.rows[0].id;

    // Step 3 · HQ Admin UPDATE pending → approved
    const upd = await c.query(
      `UPDATE public.nex_country_placement
          SET placement_status = 'approved',
              reviewed_by      = $1,
              reviewed_at      = now(),
              reviewer_reason  = $2,
              updated_at       = now()
        WHERE id = $3
          AND placement_status = 'pending'`,
      [HQ_ADMIN, `Path B · publish all Irish Pride to Ireland feed · ${track.title}`, placementId],
    );
    if (upd.rowCount !== 1) {
      throw new Error(`approval UPDATE rowCount=${upd.rowCount} for placementId=${placementId} · aborting`);
    }
    inserted.placements.push({ track: track.title, trackId: track.id, placementId });

    // Step 4 · audit log entry (pending → approved transition recorded)
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
        `Path B publish · ${track.title} · visibility flipped private → shared_live + IE placement approved`,
        JSON.stringify({
          stage: "E.1-content-publish",
          path: "B",
          placement_id: placementId,
          visibility_changed_private_to_shared_live: true,
          worldwide_feed_unchanged: true,
        }),
      ],
    );
    inserted.audits.push({ track: track.title, auditId: audit.rows[0].id });
    console.log(`  ${track.title} · flipped + placement ${placementId} approved + audit ${audit.rows[0].id}`);
  }

  // Pre-commit sanity · all 6 Irish Pride tracks visibility=shared_live
  const vis = await c.query(
    `SELECT visibility, count(*)::int AS n FROM public.nex_music_track
      WHERE owner_account_id = $1 GROUP BY visibility`,
    [IRISH_PRIDE],
  );
  const privateCount = vis.rows.find((r) => r.visibility === "private")?.n ?? 0;
  const sharedCount = vis.rows.find((r) => r.visibility === "shared_live")?.n ?? 0;
  const removedCount = vis.rows.find((r) => r.visibility === "removed")?.n ?? 0;
  if (privateCount !== 0 || sharedCount !== 6 || removedCount !== 0) {
    throw new Error(
      `pre-commit sanity failed · expected 0 private + 6 shared_live + 0 removed · got ${privateCount} / ${sharedCount} / ${removedCount}`,
    );
  }

  // Pre-commit sanity · all 6 Irish Pride tracks have approved IE placements
  const plc = await c.query(
    `SELECT count(*)::int AS n FROM public.nex_country_placement
      WHERE country='IE' AND placement_status='approved' AND requested_by = $1`,
    [IRISH_PRIDE],
  );
  if (plc.rows[0].n !== 6) {
    throw new Error(`pre-commit sanity failed · expected 6 approved IE placements for Irish Pride · got ${plc.rows[0].n}`);
  }

  console.log(`\n  pre-commit sanity: 6 shared_live tracks + 6 approved IE placements`);

  await c.query("COMMIT");
  console.log("\nCOMMIT · transaction succeeded\n");
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.log(`\nROLLBACK · ${e.message}`);
  process.exitCode = 1;
}

// ============================================================================
// Post-commit verification · fresh view of persisted state
// ============================================================================

console.log("=== Post-commit · Irish Pride tracks (full state) ===");
const final = await c.query(
  `SELECT t.id, t.title, t.visibility, p.placement_status, p.reviewed_at
     FROM public.nex_music_track t
     LEFT JOIN public.nex_country_placement p
       ON p.content_type='music_track' AND p.content_id=t.id AND p.country='IE'
    WHERE t.owner_account_id = $1
    ORDER BY t.title`,
  [IRISH_PRIDE],
);
for (const r of final.rows) {
  console.log(`  ${r.title.padEnd(30)} · visibility=${(r.visibility ?? "null").padEnd(11)} · IE placement=${r.placement_status ?? "none"}`);
}

console.log("\n=== Post-commit · Ireland feed roster ===");
const feed = await c.query(
  `SELECT t.title, t.visibility, p.placement_status
     FROM public.nex_country_placement p
     JOIN public.nex_music_track t ON t.id = p.content_id
    WHERE p.country='IE' AND p.content_type='music_track' AND p.placement_status='approved'
    ORDER BY t.title`,
);
console.log(`  Total approved music placements for IE: ${feed.rows.length}`);
for (const r of feed.rows) {
  console.log(`    ${r.title.padEnd(30)} · ${r.visibility}`);
}

console.log("\n=== Post-commit · nex_hq_action_log entries from this run ===");
for (const a of inserted.audits) {
  console.log(`  ${a.auditId} · ${a.track}`);
}

await c.end();
console.log("\n==========================================");
console.log("Path B complete · sandbox only · all 6 Irish Pride tracks published to Ireland feed");
console.log("==========================================");
