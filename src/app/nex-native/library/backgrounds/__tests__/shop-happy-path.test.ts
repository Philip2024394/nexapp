// src/app/nex-native/library/backgrounds/__tests__/shop-happy-path.test.ts
//
// Disposable-subscriber shop happy path · owner-authorised 2026-11-11.
// -----------------------------------------------------------------------------
// Creates a disposable sandbox account WITH a temporary Shop bisnis
// subscription, creates a disposable business for that account, applies
// a background via the real applyFromLibraryShopAction server action,
// verifies the correct business row is written, then CLEANS UP all
// temporary data.
//
// Does NOT touch the founder's account or business.
// Does NOT leave any subscription state behind.
// Rolls back everything even on test failure (try/finally).

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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

const SKIP_SANDBOX = process.env.NEX_SKIP_SANDBOX_TESTS === "1";
const FOUNDER_BUSINESS_ID = "edab3dcd-5ea2-4b28-9bcb-2e405661697f";

let db: Client;
beforeAll(async () => {
  if (SKIP_SANDBOX) return;
  const url = loadEnvVar("SANDBOX_DATABASE_URL");
  if (url.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP · prod ref");
  db = new Client({ connectionString: url });
  await db.connect();
});
afterAll(async () => { if (db) await db.end(); });

// Mock the dev-impersonation layer so the server action's
// resolveSessionWithDevOverride() returns whatever account id we pin
// here. The `tier` field is the one effectiveTier() reads (not
// subscription_plan) · see account-service.ts:431.
const mockAccountRef: {
  id: string | null;
  tier: "gratis" | "bisnis" | "pro";
  bisnis: string | null;
} = { id: null, tier: "gratis", bisnis: null };

// revalidatePath cannot run outside a Next.js request context · stub it.
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: async () => {
    if (!mockAccountRef.id) return null;
    return {
      account: {
        id: mockAccountRef.id,
        display_name: "Disposable Shop Sub",
        nex_handle: `nex-${mockAccountRef.id.slice(0, 8)}`,
        tier: mockAccountRef.tier,
        bisnis_expires_at: mockAccountRef.bisnis,
        themes_trial_used_at: null,
      },
    };
  },
}));

describe.skipIf(SKIP_SANDBOX)("Shop happy path · disposable bisnis subscriber", () => {
  it("creates disposable subscriber · applies shop bg · verifies · cleans up", async () => {
    // --- Setup disposable records ---
    const accId = (await db.query(`SELECT gen_random_uuid() AS u`)).rows[0].u;
    const bizId = (await db.query(`SELECT gen_random_uuid() AS u`)).rows[0].u;
    const handle = `nex-${80000 + Math.floor(Math.random() * 10000)}`;
    const futureIso = new Date(Date.now() + 86400_000).toISOString();

    try {
      await db.query(
        `INSERT INTO nex_account (id, nex_handle, display_name, subscription_plan, bisnis_expires_at)
         VALUES ($1, $2, 'Disposable Shop Sub', 'bisnis', $3)`,
        [accId, handle, futureIso],
      );
      await db.query(
        `INSERT INTO nex_business (id, owner_account_id, display_name, slug)
         VALUES ($1, $2, 'Disposable Shop', $3)`,
        [bizId, accId, `disposable-shop-${handle.slice(4)}`],
      );

      // Pin the mocked session to this disposable id for the action call
      mockAccountRef.id = accId;
      mockAccountRef.tier = "bisnis";
      mockAccountRef.bisnis = futureIso;

      // --- Call the real server action ---
      const { applyFromLibraryShopAction } = await import("../_actions");
      const assetId = "shop:dynamic-nex-shopping-showcase";
      const result = await applyFromLibraryShopAction(bizId, assetId);

      expect(result).toEqual({ ok: true, assetId });

      // --- Verify the database row was written on the DISPOSABLE
      //     business, and the founder's business was UNTOUCHED.
      const disposable = await db.query(
        `SELECT shop_cover_image_url, shop_cover_tint_hex FROM nex_business WHERE id = $1`,
        [bizId],
      );
      expect(disposable.rows[0].shop_cover_image_url).toBe(
        "/nex-brand/shop-themes/dynamic-nex-shopping-showcase.png",
      );
      expect(disposable.rows[0].shop_cover_tint_hex).toBe("#C6A15B");

      const founder = await db.query(
        `SELECT shop_cover_image_url, shop_cover_tint_hex FROM nex_business WHERE id = $1`,
        [FOUNDER_BUSINESS_ID],
      );
      // Founder should be unchanged (null · we never touch it)
      expect(founder.rows[0].shop_cover_image_url).toBeNull();
    } finally {
      // --- Cleanup unconditionally ---
      mockAccountRef.id = null;
      mockAccountRef.tier = "gratis";
      mockAccountRef.bisnis = null;
      await db.query(`DELETE FROM nex_business WHERE id = $1`, [bizId]);
      await db.query(`DELETE FROM nex_account WHERE id = $1`, [accId]);
    }
  });

  it("two-business isolation · each disposable biz keeps its own bg", { timeout: 20_000 }, async () => {
    const accId = (await db.query(`SELECT gen_random_uuid() AS u`)).rows[0].u;
    const biz1 = (await db.query(`SELECT gen_random_uuid() AS u`)).rows[0].u;
    const biz2 = (await db.query(`SELECT gen_random_uuid() AS u`)).rows[0].u;
    const handle = `nex-${85000 + Math.floor(Math.random() * 5000)}`;
    const futureIso = new Date(Date.now() + 86400_000).toISOString();

    try {
      await db.query(
        `INSERT INTO nex_account (id, nex_handle, display_name, subscription_plan, bisnis_expires_at)
         VALUES ($1, $2, 'Two-Biz Owner', 'bisnis', $3)`,
        [accId, handle, futureIso],
      );
      await db.query(
        `INSERT INTO nex_business (id, owner_account_id, display_name, slug)
         VALUES ($1, $2, 'Biz One', $3), ($4, $2, 'Biz Two', $5)`,
        [biz1, accId, `biz-one-${handle.slice(4)}`, biz2, `biz-two-${handle.slice(4)}`],
      );

      mockAccountRef.id = accId;
      mockAccountRef.tier = "bisnis";
      mockAccountRef.bisnis = futureIso;

      const { applyFromLibraryShopAction } = await import("../_actions");
      // Biz 1 gets asset A
      const r1 = await applyFromLibraryShopAction(biz1, "shop:global-cart-glow");
      expect(r1).toMatchObject({ ok: true });
      // Biz 2 gets asset B
      const r2 = await applyFromLibraryShopAction(biz2, "shop:electronics-showcase");
      expect(r2).toMatchObject({ ok: true });

      const final = await db.query(
        `SELECT id, shop_cover_image_url FROM nex_business
          WHERE id IN ($1, $2) ORDER BY display_name`,
        [biz1, biz2],
      );
      const map = Object.fromEntries(final.rows.map((r: any) => [r.id, r.shop_cover_image_url]));
      expect(map[biz1]).toBe("/nex-brand/shop-themes/global-cart-glow.png");
      expect(map[biz2]).toBe("/nex-brand/shop-themes/electronics-showcase.png");
    } finally {
      mockAccountRef.id = null;
      mockAccountRef.tier = "gratis";
      mockAccountRef.bisnis = null;
      await db.query(`DELETE FROM nex_business WHERE id IN ($1, $2)`, [biz1, biz2]);
      await db.query(`DELETE FROM nex_account WHERE id = $1`, [accId]);
    }
  });

  it("CRITICAL · cross-context · gratis chat user picking a SHOP asset for chat = DENIED (Themes Plus required)", async () => {
    // Owner directive 2026-11-11 · all 450 assets visible in both
    // pickers · but entitlement is still enforced. Shop assets applied
    // as chat theme get a lazy-inserted nex_chat_theme row with
    // tier='bisnis', so a gratis chat user (no Themes Plus) is denied.
    const accId = (await db.query(`SELECT gen_random_uuid() AS u`)).rows[0].u;
    const handle = `nex-${86000 + Math.floor(Math.random() * 1000)}`;
    try {
      await db.query(
        `INSERT INTO nex_account (id, nex_handle, display_name) VALUES ($1, $2, 'Gratis Chat User')`,
        [accId, handle],
      );
      mockAccountRef.id = accId;
      mockAccountRef.tier = "gratis";
      mockAccountRef.bisnis = null;

      const { applyFromLibraryChatAction } = await import("../_actions");
      const result = await applyFromLibraryChatAction("shop:dynamic-nex-shopping-showcase");
      expect(result).toEqual({ ok: false, error: "themes_plus_required" });
    } finally {
      mockAccountRef.id = null;
      // Clean the lazy-inserted nex_chat_theme row too
      await db.query(
        `DELETE FROM nex_chat_theme WHERE id = 's-dynamic-nex-shopping-showcase'`,
      );
      await db.query(`DELETE FROM nex_account WHERE id = $1`, [accId]);
    }
  });

  it("gratis account CANNOT apply shop background (denial path)", async () => {
    const accId = (await db.query(`SELECT gen_random_uuid() AS u`)).rows[0].u;
    const bizId = (await db.query(`SELECT gen_random_uuid() AS u`)).rows[0].u;
    const handle = `nex-${90000 + Math.floor(Math.random() * 5000)}`;

    try {
      // Gratis tier · no subscription_plan, no bisnis_expires_at
      await db.query(
        `INSERT INTO nex_account (id, nex_handle, display_name)
         VALUES ($1, $2, 'Gratis Denied')`,
        [accId, handle],
      );
      await db.query(
        `INSERT INTO nex_business (id, owner_account_id, display_name, slug)
         VALUES ($1, $2, 'Gratis Biz', $3)`,
        [bizId, accId, `gratis-biz-${handle.slice(4)}`],
      );

      mockAccountRef.id = accId;
      mockAccountRef.tier = "gratis";
      mockAccountRef.bisnis = null;

      const { applyFromLibraryShopAction } = await import("../_actions");
      const result = await applyFromLibraryShopAction(bizId, "shop:dynamic-nex-shopping-showcase");
      expect(result).toEqual({ ok: false, error: "shop-tier-required" });

      // Verify the business cover is still NULL (not written)
      const biz = await db.query(
        `SELECT shop_cover_image_url FROM nex_business WHERE id = $1`,
        [bizId],
      );
      expect(biz.rows[0].shop_cover_image_url).toBeNull();
    } finally {
      mockAccountRef.id = null;
      await db.query(`DELETE FROM nex_business WHERE id = $1`, [bizId]);
      await db.query(`DELETE FROM nex_account WHERE id = $1`, [accId]);
    }
  });
});
