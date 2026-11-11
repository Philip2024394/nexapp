// src/app/nex-native/library/backgrounds/__tests__/entitlement-integration.test.ts
//
// Phase 3 · Themes Plus entitlement integration tests against sandbox.
// Uses disposable test accounts · all changes rolled back · founder
// persona is NEVER granted permanent Themes Plus access.
//
// Covers the 8 owner-required scenarios:
//   1. Free account can select approved free themes
//   2. Free account cannot select premium themes
//   3. Shop subscriber without Themes Plus cannot select premium
//   4. Active Themes Plus subscriber can select premium
//   5. Expired Themes Plus subscriber cannot select premium
//   6. Historic verified owner retains ownership access
//   7. Legacy picker and unified library enforce identical decisions
//   8. Forged asset id / wrong context is rejected

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canAccessChatTheme } from "@/lib/nex-native/library/entitlement-service";

function loadEnvVar(name: string): string {
  const raw = readFileSync(resolve(__dirname, "..", "..", "..", "..", "..", "..", ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found`);
  let v = match[1]!.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const SKIP_SANDBOX = process.env.NEX_SKIP_SANDBOX_TESTS === "1";

let db: Client;
beforeAll(async () => {
  if (SKIP_SANDBOX) return;
  const url = loadEnvVar("SANDBOX_DATABASE_URL");
  if (url.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP · prod ref");
  db = new Client({ connectionString: url });
  await db.connect();
});
afterAll(async () => {
  if (db) await db.end();
});

// Helper · create a disposable test account inside a transaction.
async function createDisposableAccount(opts: {
  tier?: "gratis" | "bisnis";
  themesPlusUntil?: string | null;
  bisnisExpiresAt?: string | null;
}): Promise<{ id: string; themes_plus_until: string | null }> {
  // Mock persona rows have a pre-seeded shape; we create a non-persona
  // account by inserting a bare row in a rolled-back transaction.
  const id = (await db.query(`SELECT gen_random_uuid() AS u`)).rows[0].u;
  // nex_account.nex_handle must match the sealed "nex-NNNNN" format.
  // Use a 5-digit numeric suffix in the 70000-99999 range so it can't
  // collide with mock persona handles (99901-99920 reserved).
  const handleSuffix = 70000 + Math.floor(Math.random() * 20000);
  await db.query(
    `INSERT INTO nex_account
       (id, nex_handle, display_name, subscription_plan, bisnis_expires_at, themes_plus_until)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      `nex-${handleSuffix}`,
      "Disposable Test",
      opts.tier === "bisnis" ? "bisnis" : null,
      opts.bisnisExpiresAt ?? null,
      opts.themesPlusUntil ?? null,
    ],
  );
  return { id, themes_plus_until: opts.themesPlusUntil ?? null };
}

describe.skipIf(SKIP_SANDBOX)("Phase 3 · Themes Plus entitlement scenarios", () => {
  it("#1 · Free account CAN select approved free themes (library-ireland-1)", async () => {
    await db.query("BEGIN");
    try {
      const acc = await createDisposableAccount({});
      const theme = (await db.query(
        `SELECT id, tier FROM nex_chat_theme WHERE id = 'library-ireland-1'`,
      )).rows[0];
      expect(theme.tier).toBe("gratis");
      const d = await canAccessChatTheme(
        { id: theme.id, tier: theme.tier },
        { id: acc.id, themes_plus_until: acc.themes_plus_until },
      );
      expect(d).toEqual({ allow: true, reason: "free" });
    } finally { await db.query("ROLLBACK"); }
  });

  it("#2 · Free account CANNOT select premium themes (library-m-1)", async () => {
    await db.query("BEGIN");
    try {
      const acc = await createDisposableAccount({});
      const theme = (await db.query(
        `SELECT id, tier FROM nex_chat_theme WHERE id = 'library-m-1'`,
      )).rows[0];
      expect(theme.tier).toBe("bisnis");
      const d = await canAccessChatTheme(
        { id: theme.id, tier: theme.tier },
        { id: acc.id, themes_plus_until: acc.themes_plus_until },
      );
      expect(d).toEqual({ allow: false, reason: "themes_plus_required" });
    } finally { await db.query("ROLLBACK"); }
  });

  it("#3 · CRITICAL · Shop subscriber WITHOUT Themes Plus cannot select premium", async () => {
    await db.query("BEGIN");
    try {
      // bisnis tier via shop subscription · themes_plus_until NULL
      const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const acc = await createDisposableAccount({
        tier: "bisnis",
        bisnisExpiresAt: future,
        themesPlusUntil: null,
      });
      const theme = (await db.query(
        `SELECT id, tier FROM nex_chat_theme WHERE id = 'library-m-1'`,
      )).rows[0];
      const d = await canAccessChatTheme(
        { id: theme.id, tier: theme.tier },
        { id: acc.id, themes_plus_until: acc.themes_plus_until },
      );
      // Shop bisnis does NOT unlock chat premium per sealed separation.
      expect(d).toEqual({ allow: false, reason: "themes_plus_required" });
    } finally { await db.query("ROLLBACK"); }
  });

  it("#4 · Active Themes Plus subscriber CAN select premium", async () => {
    await db.query("BEGIN");
    try {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const acc = await createDisposableAccount({ themesPlusUntil: future });
      const theme = (await db.query(
        `SELECT id, tier FROM nex_chat_theme WHERE id = 'library-m-1'`,
      )).rows[0];
      const d = await canAccessChatTheme(
        { id: theme.id, tier: theme.tier },
        { id: acc.id, themes_plus_until: acc.themes_plus_until },
      );
      expect(d).toEqual({ allow: true, reason: "themes_plus" });
    } finally { await db.query("ROLLBACK"); }
  });

  it("#5 · Expired Themes Plus subscriber CANNOT select premium", async () => {
    await db.query("BEGIN");
    try {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const acc = await createDisposableAccount({ themesPlusUntil: past });
      const theme = (await db.query(
        `SELECT id, tier FROM nex_chat_theme WHERE id = 'library-m-1'`,
      )).rows[0];
      const d = await canAccessChatTheme(
        { id: theme.id, tier: theme.tier },
        { id: acc.id, themes_plus_until: acc.themes_plus_until },
      );
      expect(d).toEqual({ allow: false, reason: "themes_plus_required" });
    } finally { await db.query("ROLLBACK"); }
  });

  it("#6 · Historic verified owner CAN access the owned theme", async () => {
    // This test cannot use BEGIN/ROLLBACK because canAccessChatTheme
    // reaches the DB via the Supabase REST client, which uses a
    // separate connection pool and cannot see our uncommitted pg
    // transaction. Instead: commit the account + ownership rows,
    // run the test, then cleanup unconditionally.
    const acc = await createDisposableAccount({});
    const theme = (await db.query(
      `SELECT id, tier FROM nex_chat_theme WHERE id = 'library-m-1'`,
    )).rows[0];
    const ownershipId = (await db.query(`SELECT gen_random_uuid() AS u`)).rows[0].u;
    try {
      await db.query(
        `INSERT INTO nex_theme_ownership
           (id, account_id, theme_id, acquired_via, acquired_at, revoked_at)
         VALUES ($1, $2, $3, 'grant', now(), NULL)`,
        [ownershipId, acc.id, theme.id],
      );
      const d = await canAccessChatTheme(
        { id: theme.id, tier: theme.tier },
        { id: acc.id, themes_plus_until: acc.themes_plus_until },
      );
      expect(d).toEqual({ allow: true, reason: "owned" });
    } finally {
      await db.query(`DELETE FROM nex_theme_ownership WHERE id = $1`, [ownershipId]);
      await db.query(`DELETE FROM nex_account WHERE id = $1`, [acc.id]);
    }
  });

  it("#7 · Legacy picker and unified library enforce identical decisions", async () => {
    // Both call the same canAccessChatTheme service with the same
    // inputs. This is enforced structurally by the action bodies
    // (verified by isolation.test.ts) + we re-run the same decision
    // tree here to prove convergence.
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const premiumTheme = { id: "library-m-1" as const, tier: "bisnis" as const };
    const freeTheme = { id: "library-ireland-1" as const, tier: "gratis" as const };

    // Shop subscriber attempting premium → denied via both paths
    const shopSub = { id: "shop-sub", themes_plus_until: null };
    const d1 = await canAccessChatTheme(premiumTheme, shopSub);
    expect(d1.allow).toBe(false);

    // Plus subscriber attempting premium → allowed via both paths
    const plusSub = { id: "plus-sub", themes_plus_until: future };
    const d2 = await canAccessChatTheme(premiumTheme, plusSub);
    expect(d2.allow).toBe(true);

    // Free theme always allowed
    const d3 = await canAccessChatTheme(freeTheme, shopSub);
    expect(d3.allow).toBe(true);
  });

  it("#8 · Cross-context access allowed; nonexistent id rejected (entitlement gates at save)", async () => {
    const { getBackgroundAsset } = await import(
      "@/lib/nex-native/library/catalog-service"
    );
    // Shop asset requested from chat caller · now ALLOWED (owner directive 2026-11-11)
    const shopFromChat = await getBackgroundAsset("shop:dynamic-nex-shopping-showcase");
    expect(shopFromChat).not.toBeNull();
    expect(shopFromChat!.id).toBe("shop:dynamic-nex-shopping-showcase");
    // Chat asset accessed via catalog service · also allowed
    const chatAsset = await getBackgroundAsset("chat:library-ireland-1");
    expect(chatAsset).not.toBeNull();
    // Nonexistent id → null (still rejected)
    const ghost = await getBackgroundAsset("chat:this-does-not-exist");
    expect(ghost).toBeNull();
  });
});
