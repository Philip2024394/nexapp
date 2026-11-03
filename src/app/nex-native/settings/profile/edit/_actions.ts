"use server";

// src/app/nex-native/settings/profile/edit/_actions.ts
//
// NEX Ireland · profile edit · server action.
// Owner-authorised 2026-11-04 ("C" path).
// --------------------------------------------------------
// Saves the 10 fields of the redesigned profile editor:
//   · nex_account.display_name                 (chat name)
//   · nex_account.phone_country_code           (phone prefix)
//   · nex_account.phone_national_number        (phone body)
//   · nex_account_profile.country_code         (country of residence · ISO2)
//   · nex_account_profile.address              (street address · optional)
//   · nex_account_profile.interests            (2-slot pick-list)
//   · nex_account_profile.instagram_handle     (social links · bare handle)
//   · nex_account_profile.tiktok_handle
//   · nex_account_profile.facebook_handle
//   · nex_account_profile.x_handle
//   · nex_account_profile.youtube_handle
//
// Save strategy · one UPDATE on nex_account for the chat name + phone,
// one UPSERT on nex_account_profile for the Ireland fields (so a user
// without a profile row yet still ends up with one). All text fields
// trim · empty → null · leading @ / URL stripped from socials server-
// side so the DB CHECK stays clean.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { isKnownInterestId } from "@/lib/nex-native/profile/interests-registry";

/** Strip leading @ / # / https:// / http:// so DB CHECK passes.
 *  Returns null when the trimmed value is empty. */
function cleanHandle(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  let v = raw.trim();
  if (!v) return null;
  v = v.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "");
  v = v.replace(/^(?:instagram\.com\/|tiktok\.com\/@?|facebook\.com\/|x\.com\/|twitter\.com\/|youtube\.com\/@?)/i, "");
  v = v.replace(/^[@#]+/, "");
  v = v.split("/")[0] ?? "";
  v = v.split("?")[0] ?? "";
  v = v.trim();
  if (!v) return null;
  if (v.length > 50) v = v.slice(0, 50);
  return v;
}

function textOrNull(raw: FormDataEntryValue | null, max: number): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export async function saveProfileFieldsAction(formData: FormData): Promise<void> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const accountId = session.account.id;

  // ─── Chat name + phone (nex_account) ─────────────────────────
  const chatName = textOrNull(formData.get("chat_name"), 60);
  const phoneCountryCode = textOrNull(formData.get("phone_country_code"), 6);
  const phoneNationalNumber = textOrNull(formData.get("phone_national_number"), 20);

  const accountPatch: Record<string, string | null> = {};
  if (chatName) accountPatch.display_name = chatName;
  if (phoneCountryCode !== null) accountPatch.phone_country_code = phoneCountryCode;
  if (phoneNationalNumber !== null) accountPatch.phone_national_number = phoneNationalNumber;

  if (Object.keys(accountPatch).length > 0) {
    const { error } = await nexSupabaseAdmin
      .from("nex_account")
      .update(accountPatch)
      .eq("id", accountId);
    if (error) {
      console.error("[profile-edit] nex_account update failed", error);
      redirect("/nex-native/settings/profile/edit?e=account_update_failed");
    }
  }

  // ─── Ireland fields (nex_account_profile) ────────────────────
  const countryRaw = textOrNull(formData.get("country_code"), 2);
  const countryCode = countryRaw && /^[A-Z]{2}$/.test(countryRaw.toUpperCase())
    ? countryRaw.toUpperCase()
    : null;
  const address = textOrNull(formData.get("address"), 200);

  // Interests · pick-2 · validated against the sealed registry.
  const rawInterests = formData.getAll("interests");
  const interests: string[] = [];
  for (const r of rawInterests) {
    if (typeof r !== "string") continue;
    const id = r.trim().toLowerCase();
    if (isKnownInterestId(id) && !interests.includes(id)) {
      interests.push(id);
      if (interests.length === 2) break;
    }
  }

  const instagram = cleanHandle(formData.get("instagram_handle"));
  const tiktok = cleanHandle(formData.get("tiktok_handle"));
  const facebook = cleanHandle(formData.get("facebook_handle"));
  const xHandle = cleanHandle(formData.get("x_handle"));
  const youtube = cleanHandle(formData.get("youtube_handle"));

  // Upsert so first-time users (no profile row yet) get one created.
  const { error: profileErr } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .upsert(
      {
        account_id: accountId,
        country_code: countryCode,
        address,
        interests,
        instagram_handle: instagram,
        tiktok_handle: tiktok,
        facebook_handle: facebook,
        x_handle: xHandle,
        youtube_handle: youtube,
      },
      { onConflict: "account_id" },
    );
  if (profileErr) {
    console.error("[profile-edit] nex_account_profile upsert failed", profileErr);
    redirect("/nex-native/settings/profile/edit?e=profile_upsert_failed");
  }

  revalidatePath("/nex-native/profile/me");
  revalidatePath("/nex-native/settings/profile/edit");

  // Post-signup flow lands on the chat home · edit-from-drawer lands
  // back on the profile view.
  const from = formData.get("from");
  if (typeof from === "string" && from === "signup") {
    redirect("/nex-native/free-chat");
  }
  redirect("/nex-native/profile/me?m=profile_saved");
}
