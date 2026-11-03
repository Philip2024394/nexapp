#!/usr/bin/env node
// Path B v2 · simplified · single-INSERT at approved (not pending → approved).
// Sandbox-only · atomic · rollback on any failure.
// v1 hit a param-binding issue on the UPDATE step · v2 inserts the
// placement directly at 'approved' with all reviewer fields set
// synchronously, saving one SQL round-trip and avoiding the collision.

import pg from "pg";
const SBX_DB = process.env.SBX_DB;
if (!SBX_DB) throw new Error("SBX_DB not set");
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("safeguard · production ref");
if (!SBX_DB.includes("kdstoyyeygcopkogqsyv")) throw new Error("safeguard · unexpected sandbox ref");

const IRISH_PRIDE = "11111111-1111-4111-8111-111111111111";
const HQ_ADMIN    = "57fa2ccf-5d35-4697-8ef5-50507c05f1c9";

const PRIVATE_TRACKS = [
  { id: "acfb6f29-9ac2-4673-aa2c-e201b3335b61", title: "Dirty Old Town" },
  { id: "93b1a638-c8b6-491c-9844-02b90a06b179", title: "Nosey Bridie" },
  { id: "b3c3b592-c4a3-45de-af6d-8b93e79ed4ce", title: "Taking One for the Team" },
  { id: "4cc8e6e9-9520-40ae-ac9a-74cbcbc80d2f", title: "Tell Me Ma" },
];

const c = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const insertedPlacementIds = [];
const insertedAuditIds = [];

try {
  await c.query("BEGIN");

  for (const track of PRIVATE_TRACKS) {
    // Step 1 · flip visibility private → shared_live
    const flip = await c.query(
      "UPDATE public.nex_music_track SET visibility='shared_live' WHERE id=$1 AND visibility='private'",
      [track.id],
    );
    if (flip.rowCount !== 1) throw new Error(`visibility flip rowCount=${flip.rowCount} for ${track.title}`);

    // Step 2 · INSERT placement directly at approved (single statement · reviewer set same insert)
    const ins = await c.query(
      "INSERT INTO public.nex_country_placement (content_type, content_id, country, placement_status, requested_by, reviewed_by, reviewed_at, reviewer_reason) VALUES ('music_track', $1, 'IE', 'approved', $2, $3, now(), $4) RETURNING id",
      [track.id, IRISH_PRIDE, HQ_ADMIN, "Path B publish · " + track.title],
    );
    const placementId = ins.rows[0].id;
    insertedPlacementIds.push(placementId);

    // Step 3 · audit log entry
    const audit = await c.query(
      "INSERT INTO public.nex_hq_action_log (actor_account_id, action, content_type, content_id, country, previous_status, new_status, reason, metadata) VALUES ($1, 'country_placement_approved', 'music_track', $2, 'IE', NULL, 'approved', $3, $4) RETURNING id",
      [
        HQ_ADMIN,
        track.id,
        "Path B publish · " + track.title + " · visibility flipped from private to shared_live + IE placement approved",
        JSON.stringify({
          stage: "E.1-content-publish",
          path: "B",
          placement_id: placementId,
          visibility_changed_private_to_shared_live: true,
          worldwide_feed_unchanged: true,
        }),
      ],
    );
    insertedAuditIds.push(audit.rows[0].id);
    console.log("  " + track.title + " · placement=" + placementId + " · audit=" + audit.rows[0].id);
  }

  // Pre-commit sanity
  const vis = await c.query(
    "SELECT visibility, count(*)::int AS n FROM public.nex_music_track WHERE owner_account_id=$1 GROUP BY visibility",
    [IRISH_PRIDE],
  );
  const map = Object.fromEntries(vis.rows.map((r) => [r.visibility, r.n]));
  if ((map.private ?? 0) !== 0 || (map.shared_live ?? 0) !== 6 || (map.removed ?? 0) !== 0) {
    throw new Error("visibility sanity failed: " + JSON.stringify(map));
  }
  const plc = await c.query(
    "SELECT count(*)::int AS n FROM public.nex_country_placement WHERE country='IE' AND placement_status='approved' AND requested_by=$1",
    [IRISH_PRIDE],
  );
  if (plc.rows[0].n !== 6) throw new Error("placement sanity failed: " + plc.rows[0].n);

  await c.query("COMMIT");
  console.log("\nCOMMIT · 4 tracks published to Ireland feed\n");
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.log("\nROLLBACK · " + e.message);
  process.exitCode = 1;
}

console.log("=== Final state · Irish Pride tracks ===");
const final = await c.query(
  "SELECT t.title, t.visibility, p.placement_status FROM public.nex_music_track t LEFT JOIN public.nex_country_placement p ON p.content_type='music_track' AND p.content_id=t.id AND p.country='IE' WHERE t.owner_account_id=$1 ORDER BY t.title",
  [IRISH_PRIDE],
);
for (const r of final.rows) {
  console.log("  " + r.title.padEnd(32) + " · visibility=" + (r.visibility ?? "null").padEnd(11) + " · IE placement=" + (r.placement_status ?? "none"));
}

console.log("\n=== Ireland feed roster ===");
const feed = await c.query(
  "SELECT t.title, t.visibility FROM public.nex_country_placement p JOIN public.nex_music_track t ON t.id=p.content_id WHERE p.country='IE' AND p.content_type='music_track' AND p.placement_status='approved' ORDER BY t.title",
);
console.log("  Total approved music placements for IE: " + feed.rows.length);
for (const r of feed.rows) console.log("    " + r.title.padEnd(32) + " · " + r.visibility);

await c.end();
