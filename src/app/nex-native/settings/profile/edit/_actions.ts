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
// Owner directive 2026-11-12 · dev-override resolver so Nex-99901 and
// other dev-impersonated personas can save the profile from the local
// dev build. Falls back to the real resolver in production.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
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
  const session = await resolveSessionWithDevOverride();
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
  const address = textOrNull(formData.get("address"), 300);
  const profession = textOrNull(formData.get("profession"), 80);
  // about_me · owner directive 2026-11-04 · 500-char hard cap.
  // Column added by migration 274 (DRAFT at time of this change).
  // When 274 is not yet applied, the UPSERT below will error on the
  // unknown column and the user is redirected to ?e=profile_upsert_
  // failed. Apply migration 274 to activate the field end-to-end.
  const aboutMe = textOrNull(formData.get("about_me"), 500);

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
  // about_me is included only when migration 274 is applied. We try
  // the full upsert first; on "column not found" error we retry
  // without about_me so saves keep working until the migration lands.
  const basePatch = {
    account_id: accountId,
    country_code: countryCode,
    address,
    profession,
    interests,
    instagram_handle: instagram,
    tiktok_handle: tiktok,
    facebook_handle: facebook,
    x_handle: xHandle,
    youtube_handle: youtube,
  };
  let profileErr = (
    await nexSupabaseAdmin
      .from("nex_account_profile")
      .upsert({ ...basePatch, about_me: aboutMe }, { onConflict: "account_id" })
  ).error;
  // Owner directive 2026-11-12 · regex widened to catch both PostgREST
  // phrasings: "column.*about_me" (older driver) + "about_me.*column"
  // (current PGRST204 shape · "Could not find the 'about_me' column").
  // Prior regex missed the newer shape and every save dropped to the
  // profile_upsert_failed banner even though the retry path would work.
  if (profileErr && /about_me/i.test(profileErr.message)) {
    // Migration 274 not yet applied · retry without about_me so saves
    // succeed. About me silently drops until the migration lands. This
    // is a bridge · the long-term fix is to apply migration 274 to
    // the Supabase project the dev `.env.local` points at.
    profileErr = (
      await nexSupabaseAdmin
        .from("nex_account_profile")
        .upsert(basePatch, { onConflict: "account_id" })
    ).error;
  }
  if (profileErr) {
    console.error("[profile-edit] nex_account_profile upsert failed", profileErr);
    redirect("/nex-native/settings/profile/edit?e=profile_upsert_failed");
  }

  // Owner directive 2026-11-04 · propagate the save across every
  // surface that reads nex_account / nex_account_profile so the
  // user's new chat name / avatar / profession / socials show up
  // everywhere immediately, not after cache expiry.
  revalidatePath("/nex-native");
  revalidatePath("/nex-native/profile/me");
  revalidatePath("/nex-native/settings/profile/edit");
  revalidatePath("/nex-native/contacts");
  revalidatePath("/nex-native/free-chat");
  revalidatePath("/nex-native/nex-feed");
  revalidatePath("/nex-native/community/chat");
  revalidatePath("/nex-native/community/feed");
  revalidatePath("/nex-native/directory/landing");
  revalidatePath("/nex-native/chat-themes-library");
  revalidatePath("/nex-native/music");
  // Dynamic routes · revalidate the whole pattern so every [handle]
  // / [accountId] render refreshes.
  revalidatePath("/nex-native/profile/[handle]", "page");
  revalidatePath("/nex-native/chat/peer/[accountId]", "page");

  // Owner directive 2026-11-12 · post-save redirect retargeted (again).
  //   · signup flow → /welcome/shop-offer
  //       Interstitial with the sealed Golden Holiday Shopping backdrop
  //       pitching the €4.99/mo shop + Google-listed presence. Two
  //       buttons: "Yes I'm in" → /manage/shop/setup?from=signup, or
  //       "Skip for now" → /welcome/account-active.
  //   · edit flow   → /profile/me?m=saved
  //       Returning user who edited their profile goes back to the
  //       profile view they came from.
  const from = formData.get("from");
  if (typeof from === "string" && from === "signup") {
    redirect("/nex-native/welcome/shop-offer");
  }
  redirect("/nex-native/profile/me?m=saved");
}
