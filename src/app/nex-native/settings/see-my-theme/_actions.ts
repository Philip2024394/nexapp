// src/app/nex-native/settings/see-my-theme/_actions.ts
//
// See My Theme · server actions · sealed 2026-10-16.
//
// Scoped action for the See My Theme page. Isolated from the top-level
// `src/app/nex-native/_actions.ts` (same discipline as the other Stage
// 3-6 scoped action files). The legacy `setThemeShareAction` in the
// top-level file is unchanged · it continues to serve the pre-feature
// `/nex-native/contacts` surface under its original semantics.
//
// Doctrine:
//   · Target account_id is always `session.account.id` · never form data.
//     The form carries only the OTHER party's id (plus the share-flag
//     the user tapped).
//   · Only accepted friends can be targets · a non-friend write is
//     rejected before the service layer runs. This matches the sealed
//     See My Theme scope decision 2026-10-16 ("accepted friends only").
//   · The service uses grandfather-init semantics · when a prefs row
//     does not yet exist, the OTHER side's share-flag is initialised to
//     TRUE so the actor's first toggle preserves the pre-feature
//     visibility baseline. See
//     `src/lib/nex-native/relationship-service.ts :: setThemeVisibilityPreference`.
//   · This action NEVER modifies the actor's own `chat_theme` column.
//     Owner directive: "OFF must not delete, reset, or modify either
//     person's selected theme."

"use server";

import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as relationshipService from "@/lib/nex-native/relationship-service";
import * as friendService from "@/lib/nex-native/friend-service";

export type UpdateThemeVisibilityResult =
  | {
      ok: true;
      prefs: relationshipService.ActorPrefsView;
      mutually_visible: boolean;
    }
  | {
      ok: false;
      reason:
        | "unauthorized"
        | "invalid_request"
        | "not_a_friend"
        | "service_error";
      message?: string;
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBoolean(raw: FormDataEntryValue | null): boolean | null {
  if (typeof raw !== "string") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

export async function updateThemeVisibilityAction(
  formData: FormData,
): Promise<UpdateThemeVisibilityResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "unauthorized" };

  const otherId = String(formData.get("other_account_id") ?? "").trim();
  const on = parseBoolean(formData.get("on"));
  if (!UUID_RE.test(otherId) || on === null) {
    return { ok: false, reason: "invalid_request" };
  }
  if (otherId === session.account.id) {
    return { ok: false, reason: "invalid_request" };
  }

  // Scope gate · only accepted friends are in scope for this surface.
  // The friend-service already enforces canonical pair semantics; we
  // simply confirm membership before touching the prefs table.
  let friendIds: readonly string[];
  try {
    friendIds = await friendService.listFriends(session.account.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "service_error", message };
  }
  if (!friendIds.includes(otherId)) {
    return { ok: false, reason: "not_a_friend" };
  }

  try {
    const prefs = await relationshipService.setThemeVisibilityPreference(
      session.account.id,
      otherId,
      on,
    );
    const mutually = prefs.actor_shares_theme && prefs.other_shares_theme;
    revalidatePath("/nex-native/settings/see-my-theme");
    return { ok: true, prefs, mutually_visible: mutually };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "service_error", message };
  }
}
