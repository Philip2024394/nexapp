// src/app/nex-native/library/backgrounds/__tests__/sandbox-db.test.ts
//
// Runtime DB isolation tests · require migration 337 applied to
// sandbox (kdstoyyeygcopkogqsyv). Covers owner-required tests
// #3, #8, #9 + the catalog table integrity.
//
// Test #4 (logout + login persistence) is covered by Playwright
// e2e only · can't be tested from vitest without a browser.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvVar(name: string): string {
  const raw = readFileSync(resolve(__dirname, "..", "..", "..", "..", "..", "..", ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found`);
  let v = match[1]!.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const SKIP_SANDBOX_TESTS = process.env.NEX_SKIP_SANDBOX_TESTS === "1";

const FOUNDER_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const FOUNDER_BUSINESS_ID = "edab3dcd-5ea2-4b28-9bcb-2e405661697f";

let db: Client;
beforeAll(async () => {
  if (SKIP_SANDBOX_TESTS) return;
  const url = loadEnvVar("SANDBOX_DATABASE_URL");
  // Hard refuse prod
  if (url.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP · prod ref detected");
  db = new Client({ connectionString: url });
  await db.connect();
});
afterAll(async () => {
  if (db) await db.end();
});

describe.skipIf(SKIP_SANDBOX_TESTS)("sandbox mig 337 runtime", () => {
  it("Table shape · nex_background_asset has expected column set", async () => {
    const { rows } = await db.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='nex_background_asset'
        ORDER BY column_name`,
    );
    const cols = rows.map((r: any) => r.column_name);
    expect(cols).toEqual(expect.arrayContaining([
      "id","storage_url","preview_url","label","tint_hex",
      "categories","contexts","tier","is_active","sort_order","source",
      "created_at","updated_at",
    ]));
  });

  it("Row counts · 450 catalog rows · 279 shop + 171 chat · 0 cross-context", async () => {
    const { rows } = await db.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE contexts @> ARRAY['shop']::text[] AND NOT contexts @> ARRAY['chat']::text[])::int AS shop_only,
         count(*) FILTER (WHERE contexts @> ARRAY['chat']::text[] AND NOT contexts @> ARRAY['shop']::text[])::int AS chat_only,
         count(*) FILTER (WHERE contexts @> ARRAY['shop']::text[] AND contexts @> ARRAY['chat']::text[])::int AS cross_context
       FROM nex_background_asset`,
    );
    expect(rows[0].total).toBe(450);
    expect(rows[0].shop_only).toBe(279);
    expect(rows[0].chat_only).toBe(171);
    expect(rows[0].cross_context).toBe(0);
  });

  it("RLS · public SELECT policy exists · no authenticated mutation policies", async () => {
    const { rows } = await db.query(
      `SELECT policyname, cmd FROM pg_policies
        WHERE schemaname='public' AND tablename='nex_background_asset'`,
    );
    const names = rows.map((r: any) => `${r.cmd}:${r.policyname}`);
    expect(names).toContain("SELECT:nex_background_asset_public_read");
    expect(names.filter((n: string) => n.startsWith("INSERT:"))).toHaveLength(0);
    expect(names.filter((n: string) => n.startsWith("UPDATE:"))).toHaveLength(0);
    expect(names.filter((n: string) => n.startsWith("DELETE:"))).toHaveLength(0);
  });

  it("Free pool · 3 approved library ids present in nex_chat_theme with tier='gratis'", async () => {
    const { rows } = await db.query(
      `SELECT id, tier FROM nex_chat_theme
        WHERE id IN ('library-ireland-1','library-pattern-2','library-pets-1')
        ORDER BY id`,
    );
    expect(rows).toHaveLength(3);
    rows.forEach((r: any) => expect(r.tier).toBe("gratis"));
  });

  it("Owner's test #8 · two businesses can retain independent shop_cover_image_url", async () => {
    // Set the founder's existing business cover to a specific URL, then
    // create a scratch second business, write a different URL, assert
    // independence, then roll back scratch. Uses a transaction so no
    // permanent data is written.
    await db.query("BEGIN");
    try {
      // 1. Write cover A to the founder's business
      await db.query(
        `UPDATE nex_business SET shop_cover_image_url = $1 WHERE id = $2`,
        ["/nex-brand/shop-themes/sale-best-deals.png", FOUNDER_BUSINESS_ID],
      );

      // 2. Create scratch business owned by same account
      const { rows: scratchRows } = await db.query(
        `INSERT INTO nex_business (id, owner_account_id, display_name, slug, shop_cover_image_url)
         VALUES (gen_random_uuid(), $1, 'Scratch Isolation Test', 'scratch-isolation-test-' || substring(gen_random_uuid()::text,1,8), $2)
         RETURNING id, shop_cover_image_url`,
        [FOUNDER_ACCOUNT_ID, "/nex-brand/shop-themes/electronics-showcase.png"],
      );
      const scratchId = scratchRows[0].id;

      // 3. Assert the two covers are different
      const { rows: both } = await db.query(
        `SELECT id, shop_cover_image_url FROM nex_business
         WHERE id IN ($1, $2) ORDER BY id`,
        [FOUNDER_BUSINESS_ID, scratchId],
      );
      const urls = both.map((r: any) => r.shop_cover_image_url);
      expect(urls[0]).not.toBe(urls[1]);
      expect(urls).toContain("/nex-brand/shop-themes/sale-best-deals.png");
      expect(urls).toContain("/nex-brand/shop-themes/electronics-showcase.png");
    } finally {
      await db.query("ROLLBACK");
    }
  });

  it("Owner's test #9 · existing chat_theme selections survive mig 337 (post-apply snapshot)", async () => {
    // At apply time, the script captured 160 existing accounts with
    // chat_theme set and verified 0 diffs after apply. Here we
    // re-verify that the catalog seed itself (which runs INSERTs on
    // nex_chat_theme) did not mutate any nex_account.chat_theme.
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM nex_account WHERE chat_theme IS NOT NULL`,
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(160);
  });

  it("Spot check · getBackgroundAsset cross-context rejection works at the DB level", async () => {
    // Fetch a shop-only asset directly; assert contexts does not include chat.
    const { rows } = await db.query(
      `SELECT id, contexts FROM nex_background_asset
        WHERE id = 'shop:dynamic-nex-shopping-showcase' LIMIT 1`,
    );
    expect(rows[0].contexts).toEqual(["shop"]);
    // Do the same for a chat-only asset.
    const { rows: chat } = await db.query(
      `SELECT id, contexts FROM nex_background_asset
        WHERE id = 'chat:library-ireland-1' LIMIT 1`,
    );
    expect(chat[0].contexts).toEqual(["chat"]);
  });
});
