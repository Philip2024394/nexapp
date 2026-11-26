// src/lib/nex-native/__tests__/seed-chat-theme-from-free-chat-cookie.integration.test.ts
//
// L-052 follow-up · Option B cookie→DB migration on signup · sandbox
// integration test. Exercises `seedChatThemeFromFreeChatCookie` end-to-
// end against the sandbox Supabase project: mints a throwaway
// nex_account, runs the helper with a known chat-context library asset
// id (`library-ireland-1`), asserts `nex_account.chat_theme` is
// updated to the derived nex_chat_theme id, verifies idempotency, and
// confirms the two negative paths (invalid id format, missing asset).
//
// Sandbox-only · asserts the active Supabase project ref is
// `kdstoyyeygcopkogqsyv` and refuses to run against production. All
// writes are cleaned up in `finally`.

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";

function envVar(name: string): string {
  const raw = readFileSync("./.env.local", "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} missing from .env.local`);
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

const SB_URL = envVar("NEXT_PUBLIC_NEX_SUPABASE_URL");
const SB_KEY = envVar("NEX_SUPABASE_SERVICE_ROLE_KEY");
const activeRef = new URL(SB_URL).hostname.split(".")[0];
if (activeRef === PROD_REF) throw new Error("STOP · production ref detected");
if (activeRef !== SANDBOX_REF) throw new Error(`STOP · unknown ref ${activeRef}`);

// supabase-admin reads these at import time.
process.env.NEXT_PUBLIC_NEX_SUPABASE_URL = SB_URL;
process.env.NEX_SUPABASE_SERVICE_ROLE_KEY = SB_KEY;

let sb: SupabaseClient;
let createdAccountId: string | null = null;

beforeAll(() => {
  sb = createClient(SB_URL, SB_KEY);
});

afterAll(async () => {
  if (createdAccountId) {
    await sb.from("nex_account").delete().eq("id", createdAccountId);
  }
});

describe("seedChatThemeFromFreeChatCookie · sandbox", () => {
  it("writes nex_account.chat_theme from a chat-context library asset and is idempotent", async () => {
    const { seedChatThemeFromFreeChatCookie } = await import(
      "../chat-theme-service"
    );

    // Mint throwaway account · seeded with the sealed default theme-0.
    const { data: acc, error: accErr } = await sb
      .from("nex_account")
      .insert({ display_name: `verify-seed-${Date.now()}`, chat_theme: "theme-0" })
      .select("*")
      .single();
    expect(accErr?.message ?? null, "account create").toBeNull();
    expect(acc?.id).toBeTruthy();
    createdAccountId = acc!.id as string;
    expect((acc as { chat_theme: string }).chat_theme).toBe("theme-0");

    // Pick a real chat-gratis library asset from sandbox.
    const { data: asset, error: assetErr } = await sb
      .from("nex_background_asset")
      .select("id,tier")
      .like("id", "chat:library-ireland-%")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<{ id: string; tier: string }>();
    expect(assetErr?.message ?? null, "asset lookup").toBeNull();
    expect(asset).toBeTruthy();
    expect(asset!.tier).toBe("gratis");

    const bareId = asset!.id.replace(/^chat:/, "");

    const result = await seedChatThemeFromFreeChatCookie({
      accountId: createdAccountId as string,
      bareWallpaperId: bareId,
    });
    expect(result.ok, "seed result ok").toBe(true);
    if (!result.ok) throw new Error(`seed failed: ${result.reason}`);
    expect(result.chatThemeId).toBe(bareId);

    // DB-side truth · chat_theme column flipped.
    const { data: after, error: afterErr } = await sb
      .from("nex_account")
      .select("id,chat_theme")
      .eq("id", createdAccountId as string)
      .maybeSingle<{ id: string; chat_theme: string | null }>();
    expect(afterErr?.message ?? null, "readback").toBeNull();
    expect(after?.chat_theme).toBe(bareId);

    // Idempotency · second call returns the same chatThemeId.
    const second = await seedChatThemeFromFreeChatCookie({
      accountId: createdAccountId as string,
      bareWallpaperId: bareId,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error(`second seed failed: ${second.reason}`);
    expect(second.chatThemeId).toBe(bareId);
  }, 30_000);

  it("rejects malformed cookie values (invalid-id-format)", async () => {
    const { seedChatThemeFromFreeChatCookie } = await import(
      "../chat-theme-service"
    );
    expect(createdAccountId).toBeTruthy();
    const res = await seedChatThemeFromFreeChatCookie({
      accountId: createdAccountId as string,
      bareWallpaperId: "../../etc/passwd",
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("invalid id should have been rejected");
    expect(res.reason).toBe("invalid-id-format");
  });

  it("returns asset-not-found for unknown library ids", async () => {
    const { seedChatThemeFromFreeChatCookie } = await import(
      "../chat-theme-service"
    );
    expect(createdAccountId).toBeTruthy();
    const res = await seedChatThemeFromFreeChatCookie({
      accountId: createdAccountId as string,
      bareWallpaperId: "library-does-not-exist-9999",
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unknown id should have failed");
    expect(res.reason).toBe("asset-not-found");
  });
});
