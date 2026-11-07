"use server";

// src/app/nex-native/settings/see-my-theme/_actions.ts
//
// NEX See My Theme · per-contact theme-share server actions.
// Owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// One action: toggle whether a specific contact sees your personal
// chat theme. Delegates to the sealed `setThemeVisibilityPreference`
// (grandfather-init semantics preserved · writes only the actor's
// side of the nex_account_relationship_prefs row).
//
// Safety:
//   · Session resolved server-side · the actor is always the caller,
//     never a value the client supplies.
//   · The `other` UUID is validated against the caller's accepted
//     friend set BEFORE the write, so an attacker cannot toggle a
//     preference on a non-friend relationship.
//   · Blocked contacts are excluded from the friend set at read time
//     (`listBlockedByMe` is referenced in the page's filter), so the
//     UI never presents a toggle for them · the defence-in-depth
//     friend check here would still reject if someone crafts a direct
//     form submission.
//   · Reads/writes NEVER touch the other party's own chat_theme
//     column · theme SELECTION and theme VISIBILITY are separate
//     concerns (owner directive 2026-10-16 sealed).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { listFriends } from "@/lib/nex-native/friend-service";
import { setThemeVisibilityPreference } from "@/lib/nex-native/relationship-service";

const RETURN_PATH = "/nex-native/settings/see-my-theme";

function isUuid(v: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(v);
}

function redirectBack(status: string): never {
  const qs = new URLSearchParams({ s: status });
  redirect(`${RETURN_PATH}?${qs.toString()}`);
}

export async function toggleThemeShareForContactAction(
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/see-my-theme");
  }
  const actor = session.account.id;

  const other = String(formData.get("contact_id") ?? "").trim();
  if (!isUuid(other)) {
    redirectBack("err_bad_id");
  }
  if (other === actor) {
    redirectBack("err_self");
  }

  // Validate the contact is in the actor's accepted friend set.
  // Defence in depth: the UI only renders toggles for accepted
  // non-blocked friends, but a crafted form submit could pass any
  // UUID. Rejecting non-friends keeps the privacy contract.
  let acceptedFriend = false;
  try {
    const friends = await listFriends(actor);
    acceptedFriend = friends.includes(other);
  } catch {
    redirectBack("err_resolver");
  }
  if (!acceptedFriend) {
    redirectBack("err_not_friend");
  }

  const raw = String(formData.get("enabled") ?? "");
  const on = raw === "on" || raw === "true" || raw === "1";

  try {
    await setThemeVisibilityPreference(actor, other, on);
  } catch (e) {
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }

  revalidatePath(RETURN_PATH);
  redirectBack(`ok_${on ? "on" : "off"}`);
}
