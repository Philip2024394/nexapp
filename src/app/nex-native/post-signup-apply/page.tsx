// src/app/nex-native/post-signup-apply/page.tsx
//
// NEX Account Wall · post-signup replay intercept · Phase 0 integration.
// ----------------------------------------------------------------------
// Both /create-account and /sign-in redirect here after a successful
// auth transition WHEN there is a pending account-wall cookie waiting.
// This page:
//
//   1. requires a real session · if guest, kick back to /sign-in with
//      the pending cookie INTACT (do not consume · the user is in a
//      bad state and may still complete auth)
//   2. consumes the pending-wall cookie exactly once
//   3. validates the action id + nextUrl + payload against server-side
//      rules (nextUrl re-validated, theme id re-validated against the
//      live catalogue, tier gate enforced)
//   4. for SAFE preferences (`pick-theme`) → persists the preference
//      and redirects to the validated nextUrl
//   5. for CONSEQUENTIAL actions (order · message · post · etc.) →
//      DOES NOT auto-execute. Redirects to the destination carrying
//      the action payload in the URL so the destination page can show
//      a "continue with your selection" affordance that the user
//      must confirm.
//
// Load-bearing rules enforced here:
//   · One-shot consumption via consumePendingAccountWall()
//   · Server-side theme validation (chat_theme_service + tier gate)
//   · Open-redirect protection re-applied even though the cookie was
//     validated at write time (defence in depth)
//   · Safe fallback to /home for any error state
//   · Idempotent on re-visit (second visit sees no cookie, lands at
//     /home) so refresh / back-button does not double-apply

import { redirect } from "next/navigation";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import {
  consumePendingAccountWall,
  isAllowedNextUrl,
} from "@/lib/nex-native/account-wall/pending-action";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import type { NexAccountRow } from "@/lib/nex-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PostSignupApplyPage() {
  const viewer = await resolveNexAppSessionOrGuest();

  if (viewer.kind === "guest") {
    // Auth state didn't carry over · keep the cookie so a successful
    // auth retry can still land here. Send them to sign-in.
    redirect("/nex-native/sign-in");
  }

  // One-shot consumption · subsequent revisits see nothing.
  const pending = await consumePendingAccountWall();
  if (!pending) {
    redirect("/nex-native/home");
  }

  // Server-side re-validation of the destination · defence in depth.
  const safeNextUrl = isAllowedNextUrl(pending.nextUrl)
    ? pending.nextUrl
    : "/nex-native/home";

  switch (pending.action) {
    case "pick-theme":
      await applyPickTheme({
        accountId: viewer.session.account.id,
        themeId: pending.payload,
      });
      redirect(buildWithBanner(safeNextUrl, "theme_updated", pending.payload ?? ""));
    // Consequential actions · we don't auto-execute. The destination
    // page handles the "continue with your selection" affordance.
    case "save-business":
    case "message-business":
    case "order-product":
    case "book-service":
    case "join-community":
    case "post-community-notice":
    case "confirm-community-notice":
    case "message-community-author":
    case "join-affiliate":
    case "open-chat":
    case "open-vault":
    case "open-contacts":
    case "generic":
      redirect(safeNextUrl);
  }
}

/** Apply the pick-theme preference. Mirrors the server-side invariants
 *  of updateChatThemeAction without going through its form-action API
 *  (we're not driven by a form submission here). */
async function applyPickTheme(input: {
  accountId: string;
  themeId: string | null | undefined;
}): Promise<void> {
  const raw = (input.themeId ?? "").trim();
  if (!raw) return;

  // Live catalogue + tier gate · same logic as updateChatThemeAction.
  const row = await chatThemeService.getThemeById(raw).catch(() => null);
  if (!row || !row.is_active) return;

  if (row.tier === "bisnis") {
    const acc = await nexSupabaseAdmin
      .from("nex_account")
      .select("tier, bisnis_expires_at, themes_trial_used_at")
      .eq("id", input.accountId)
      .maybeSingle();
    const tier = effectiveTier(
      (acc.data ?? {}) as Pick<
        NexAccountRow,
        "tier" | "bisnis_expires_at" | "themes_trial_used_at"
      >,
    );
    if (tier !== "bisnis" && tier !== "pro") {
      // Silently decline · the destination banner will show
      // "theme not applied · requires NEX Business" if we add that
      // later. Not an error — just not applied.
      return;
    }
  }

  await nexSupabaseAdmin
    .from("nex_account")
    .update({ chat_theme: raw })
    .eq("id", input.accountId);
}

/** Append a success banner to the destination URL · reuses the e/m
 *  convention most NEX pages already parse via `searchParams`. */
function buildWithBanner(nextUrl: string, code: string, message: string): string {
  const [path, query] = nextUrl.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("e", code);
  params.set("m", message);
  return `${path}?${params.toString()}`;
}
