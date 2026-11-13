"use server";

// src/app/nex-native/settings/chat-settings/_actions.ts
//
// NEX Chat settings · server actions · owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// Thin wrappers around the sealed chat-preferences-service. Every
// action enforces session → account match before writing. Coming-soon
// controls do NOT have actions here · they're inert in the UI until a
// backend lands.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
// Owner directive 2026-11-12 · use the dev-impersonation resolver so
// NEX_DEV_IMPERSONATE_HANDLE=nex-99901 can write settings from the
// dev persona · same parity as the chat-settings page.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  updateChatPreferences,
  type VisibilityLevel,
} from "@/lib/nex-native/chat-preferences-service";
import {
  setGlobalThemeSharingEnabled,
} from "@/lib/nex-native/theme-sharing-service";
import {
  setBubbleColours,
} from "@/lib/nex-native/bubble-colours-service";

type ReturnPath = "/nex-native/settings/chat-settings";
const RETURN_PATH: ReturnPath = "/nex-native/settings/chat-settings";

function redirectBack(status: string): never {
  const qs = new URLSearchParams({ s: status });
  redirect(`${RETURN_PATH}?${qs.toString()}`);
}

async function requireSession(): Promise<{ accountId: string }> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/chat-settings");
  }
  return { accountId: session.account.id };
}

/** Toggle read receipts. Reciprocal · OFF suppresses the signal both ways. */
export async function setReadReceiptsAction(formData: FormData): Promise<never> {
  const { accountId } = await requireSession();
  const raw = String(formData.get("enabled") ?? "");
  const next = raw === "on" || raw === "true" || raw === "1";
  try {
    await updateChatPreferences(accountId, { read_receipts_enabled: next });
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_receipts_${next ? "on" : "off"}`);
}

/** Toggle typing indicator. 1:1 only in this release (groups deferred). */
export async function setTypingIndicatorAction(formData: FormData): Promise<never> {
  const { accountId } = await requireSession();
  const raw = String(formData.get("enabled") ?? "");
  const next = raw === "on" || raw === "true" || raw === "1";
  try {
    await updateChatPreferences(accountId, { typing_indicator_enabled: next });
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_typing_${next ? "on" : "off"}`);
}

/** Set last-seen visibility · everyone / contacts / nobody. */
export async function setLastSeenVisibilityAction(formData: FormData): Promise<never> {
  const { accountId } = await requireSession();
  const raw = String(formData.get("value") ?? "");
  const value = narrowVisibility(raw);
  try {
    await updateChatPreferences(accountId, { last_seen_visibility: value });
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_lastseen_${value}`);
}

/** Set online-status visibility · everyone / contacts / nobody. */
export async function setOnlineStatusVisibilityAction(formData: FormData): Promise<never> {
  const { accountId } = await requireSession();
  const raw = String(formData.get("value") ?? "");
  const value = narrowVisibility(raw);
  try {
    await updateChatPreferences(accountId, { online_status_visibility: value });
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_online_${value}`);
}

/** Reset Section 1 (visibility) to sealed defaults · receipts+typing ON,
 *  last-seen=nobody, online=nobody per DEFAULT_CHAT_PREFS. */
export async function resetVisibilitySectionAction(): Promise<never> {
  const { accountId } = await requireSession();
  try {
    await updateChatPreferences(accountId, {
      read_receipts_enabled: true,
      typing_indicator_enabled: true,
      last_seen_visibility: "nobody",
      online_status_visibility: "nobody",
    });
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "reset"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack("ok_reset_visibility");
}

function narrowVisibility(raw: string): VisibilityLevel {
  if (raw === "everyone" || raw === "contacts" || raw === "nobody") return raw;
  return "nobody";
}

/** Owner directive 2026-11-12 · global "Show my theme to contacts"
 *  switch (migration 340). OFF overrides all per-contact prefs but
 *  does NOT delete them · flipping back to ON restores the previous
 *  per-contact intent exactly. Fail-safe reports "schema not yet
 *  live" when mig 340 is unapplied so UI copy is honest. */
export async function setGlobalThemeSharingAction(
  formData: FormData,
): Promise<never> {
  const { accountId } = await requireSession();
  const raw = String(formData.get("enabled") ?? "");
  const next = raw === "on" || raw === "true" || raw === "1";
  const result = await setGlobalThemeSharingEnabled(accountId, next);
  if (!result.ok) {
    redirectBack(
      result.reason === "schema_missing"
        ? "err_global_theme_share_schema_missing"
        : "err_global_theme_share_db",
    );
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_global_theme_share_${next ? "on" : "off"}`);
}

/** Bubble-colour save result · owner directive 2026-11-13 · the
 *  appearance slider dragged through the server action's redirect()
 *  and the whole page remounted mid-drag, losing the slider state.
 *  Returning a plain result keeps the client state stable so drags
 *  stream cleanly. */
export type BubbleColoursSaveResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "schema_missing"
        | "invalid_hex"
        | "db_error"
        | "unauthorized";
    };

/** Owner directive 2026-11-12 · cross-device bubble colour write
 *  (migration 341). Accepts partial updates: pass `self_hex` and/or
 *  `peer_hex` fields on the FormData. Empty string clears the
 *  override (restores theme default).
 *
 *  Owner directive 2026-11-13 (hotfix) · returns a plain result object
 *  instead of redirecting. The Bubble Colours surface debounces slider
 *  changes · a redirect mid-drag remounted the page and dropped the
 *  drag state. The client now handles the result locally. */
export async function setBubbleColoursAction(
  formData: FormData,
): Promise<BubbleColoursSaveResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, reason: "unauthorized" };
  const accountId = session.account.id;
  const rawSelf = formData.has("self_hex")
    ? String(formData.get("self_hex") ?? "")
    : undefined;
  const rawPeer = formData.has("peer_hex")
    ? String(formData.get("peer_hex") ?? "")
    : undefined;
  const rawSelfApp = formData.has("self_appearance")
    ? String(formData.get("self_appearance") ?? "")
    : undefined;
  const rawPeerApp = formData.has("peer_appearance")
    ? String(formData.get("peer_appearance") ?? "")
    : undefined;
  const patch: {
    self?: string | null;
    peer?: string | null;
    selfAppearance?: number | null;
    peerAppearance?: number | null;
  } = {};
  if (rawSelf !== undefined) patch.self = rawSelf === "" ? null : rawSelf;
  if (rawPeer !== undefined) patch.peer = rawPeer === "" ? null : rawPeer;
  if (rawSelfApp !== undefined) {
    const n = Number(rawSelfApp);
    patch.selfAppearance = Number.isFinite(n) ? n : null;
  }
  if (rawPeerApp !== undefined) {
    const n = Number(rawPeerApp);
    patch.peerAppearance = Number.isFinite(n) ? n : null;
  }
  const result = await setBubbleColours(accountId, patch);
  if (!result.ok) return { ok: false, reason: result.reason };
  // Revalidate without redirecting · the chat-settings landing
  // picks up the fresh row on the next render.
  revalidatePath("/nex-native/settings/chat-settings");
  revalidatePath("/nex-native/settings/chat-settings/bubble-colours");
  return { ok: true };
}

/** Clear BOTH bubble colour overrides and restore theme defaults.
 *  Separate action so the UI can offer a single "Reset" button
 *  without juggling two hidden inputs. Returns a plain result so
 *  the Bubble Colours surface can stay mounted during the reset. */
export async function resetBubbleColoursAction(): Promise<BubbleColoursSaveResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, reason: "unauthorized" };
  const result = await setBubbleColours(session.account.id, {
    self: null,
    peer: null,
    selfAppearance: null,
    peerAppearance: null,
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  revalidatePath("/nex-native/settings/chat-settings");
  revalidatePath("/nex-native/settings/chat-settings/bubble-colours");
  return { ok: true };
}

