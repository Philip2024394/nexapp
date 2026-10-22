"use server";

// src/app/nex-native/create-account/business-welcome/_remember-business-welcome-action.ts
//
// NEX · Business Welcome · persist business type + location + continue to signup.
// Owner-authorised 2026-10-21.
// -----------------------------------------------------------------------------
// Called from the client form on /nex-native/create-account/business-welcome.
// Writes two cookies and redirects to signup:
//
//   1. `nex_welcome_vertical`  (sealed cookie · defined in welcome/_welcome-intent.ts)
//      Carries the (category, subtype) choice through to pick-theme + create.
//      Only Accommodation is reachable in Phase A1 · subtypes limited to the
//      sealed vertical-presets enum.
//
//   2. `nex_welcome_business_location`  (new · owner-authorised 2026-10-21)
//      Short-lived, additive. Carries the user's declared city/area so the
//      downstream signup flow can seed a NEX Directory evidence row via
//      `source_type = 'owner_upload'` when business creation runs. The
//      Directory Spine still gates publication via IntelligenceResult<T>
//      (sealed 2026-10-07) so "set a location" ≠ "listed in directory" ·
//      see the honest UI copy at the client form.
//
// Phase A1 hold:
//   · The 4 vertical options rendered to the user are Accommodation (ready)
//     + Food & Drink / Products / Services (not ready · "Coming soon").
//     Only an Accommodation subtype passes the validator below.
//   · Non-Accommodation submissions are rejected with a banner error ·
//     NO cookie written · NO redirect fired.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  WELCOME_INTENT_COOKIE,
  WELCOME_VERTICAL_COOKIE,
  serializeVerticalIntent,
  welcomeVerticalCookieOptions,
} from "@/app/nex-native/welcome/_welcome-intent";
import {
  isVerticalCategory,
  isVerticalSubtype,
} from "@/lib/nex-native/vertical-presets";
import {
  WELCOME_BUSINESS_LOCATION_COOKIE,
  WELCOME_BUSINESS_LOCATION_MAX_AGE_SECONDS,
  WELCOME_BUSINESS_LOCATION_MAX_LENGTH,
  WELCOME_BUSINESS_SHOP_NAME_COOKIE,
  WELCOME_BUSINESS_SHOP_NAME_MAX_AGE_SECONDS,
  WELCOME_BUSINESS_SHOP_NAME_MAX_LENGTH,
  WELCOME_BUSINESS_HOURS_COOKIE,
  WELCOME_BUSINESS_HOURS_MAX_AGE_SECONDS,
  WELCOME_BUSINESS_FACILITIES_COOKIE,
  WELCOME_BUSINESS_FACILITIES_MAX_AGE_SECONDS,
  WELCOME_BUSINESS_FACILITIES_MAX_COUNT,
  WELCOME_BUSINESS_ROOMS_COOKIE,
  WELCOME_BUSINESS_ROOMS_MAX_AGE_SECONDS,
  WELCOME_BUSINESS_ROOMS_MAX,
  WELCOME_BUSINESS_ROOMS_MIN,
  WELCOME_BUSINESS_DESCRIPTION_COOKIE,
  WELCOME_BUSINESS_DESCRIPTION_MAX_AGE_SECONDS,
  WELCOME_BUSINESS_DESCRIPTION_MAX_LENGTH,
  WELCOME_BUSINESS_SOCIAL_LINKS_COOKIE,
  WELCOME_BUSINESS_SOCIAL_LINKS_MAX_AGE_SECONDS,
  isValidFacilityToken,
  isValidOptionalUrl,
  isValidRoomCount,
  isValidTimeString,
  serializeBusinessHours,
  serializeSocialLinks,
  shopNameToSlug,
} from "./_business-welcome-cookies";

export interface RememberBusinessWelcomeResult {
  readonly ok: boolean;
  readonly error?: string;
}

export async function rememberBusinessWelcomeAction(
  formData: FormData,
): Promise<RememberBusinessWelcomeResult | never> {
  const rawCategory = String(formData.get("category") ?? "").trim();
  const rawSubtype = String(formData.get("subtype") ?? "").trim();
  const rawShopName = String(formData.get("shop_name") ?? "").trim();
  const rawLocation = String(formData.get("location") ?? "").trim();
  const rawOpenTime = String(formData.get("open_time") ?? "").trim();
  const rawCloseTime = String(formData.get("close_time") ?? "").trim();
  const rawFacilities = formData
    .getAll("facilities")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const rawRooms = String(formData.get("rooms") ?? "").trim();
  const rawDescription = String(formData.get("description") ?? "").trim();
  const rawInstagram = String(formData.get("social_instagram") ?? "").trim();
  const rawFacebook = String(formData.get("social_facebook") ?? "").trim();
  const rawTiktok = String(formData.get("social_tiktok") ?? "").trim();
  const rawWebsite = String(formData.get("social_website") ?? "").trim();

  if (!rawCategory) {
    return { ok: false, error: "Please pick your business type." };
  }
  if (!isVerticalCategory(rawCategory)) {
    return { ok: false, error: "Unknown business type." };
  }
  // Phase A1 hold · only accommodation is reachable from this surface.
  // Food/products/services tiles render as "Coming soon" in the UI, so
  // a non-accommodation submission would be a tamper attempt. Reject.
  if (rawCategory !== "accommodation") {
    return {
      ok: false,
      error:
        "This business type is coming soon. We'll notify you when it opens.",
    };
  }
  if (!rawSubtype) {
    return { ok: false, error: "Please pick a sub-type (Villa, Homestay, Kost)." };
  }
  if (!isVerticalSubtype(rawSubtype)) {
    return { ok: false, error: "Unknown sub-type." };
  }
  if (rawShopName.length === 0) {
    return {
      ok: false,
      error: "Please enter a shop name · it becomes your public NEX bio link.",
    };
  }
  if (rawShopName.length > WELCOME_BUSINESS_SHOP_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Shop name is too long (max ${WELCOME_BUSINESS_SHOP_NAME_MAX_LENGTH} chars).`,
    };
  }
  // Defence in depth · the client already slugifies for preview, but
  // the server re-slugs to ensure the stored name produces a non-empty
  // handle. A shop name that slugs to "" (e.g. only emojis) is rejected.
  if (shopNameToSlug(rawShopName).length === 0) {
    return {
      ok: false,
      error:
        "Shop name must include at least one letter or digit · try adding your business name.",
    };
  }
  if (rawLocation.length === 0) {
    return {
      ok: false,
      error: "Please tell us your city or area so customers can find you.",
    };
  }
  if (rawLocation.length > WELCOME_BUSINESS_LOCATION_MAX_LENGTH) {
    return {
      ok: false,
      error: `Location is too long (max ${WELCOME_BUSINESS_LOCATION_MAX_LENGTH} chars).`,
    };
  }
  if (!isValidTimeString(rawOpenTime) || !isValidTimeString(rawCloseTime)) {
    return {
      ok: false,
      error: "Please set both opening and closing times (HH:MM).",
    };
  }
  if (rawOpenTime === rawCloseTime) {
    return {
      ok: false,
      error: "Opening and closing time cannot be the same.",
    };
  }
  // Facilities · optional (0 picks allowed) · cap at MAX_COUNT · each
  // token must be in the sealed catalogue. Duplicates are dropped
  // server-side so the stored array is a clean set.
  if (rawFacilities.length > WELCOME_BUSINESS_FACILITIES_MAX_COUNT) {
    return {
      ok: false,
      error: `Please pick up to ${WELCOME_BUSINESS_FACILITIES_MAX_COUNT} facilities.`,
    };
  }
  for (const f of rawFacilities) {
    if (!isValidFacilityToken(f)) {
      return { ok: false, error: `Unknown facility: ${f.slice(0, 32)}` };
    }
  }
  const cleanFacilities = Array.from(new Set(rawFacilities));

  // Rooms · optional · when provided must be a valid integer in range.
  let cleanRooms: number | null = null;
  if (rawRooms.length > 0) {
    const parsed = Number(rawRooms);
    if (!isValidRoomCount(parsed)) {
      return {
        ok: false,
        error: `Number of rooms must be ${WELCOME_BUSINESS_ROOMS_MIN}–${WELCOME_BUSINESS_ROOMS_MAX}.`,
      };
    }
    cleanRooms = parsed;
  }

  // Description · optional · max length guarded.
  if (rawDescription.length > WELCOME_BUSINESS_DESCRIPTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `Description is too long (max ${WELCOME_BUSINESS_DESCRIPTION_MAX_LENGTH} chars).`,
    };
  }

  // Social links · each optional · liberal URL/handle check.
  for (const [field, value] of [
    ["Instagram", rawInstagram],
    ["Facebook", rawFacebook],
    ["TikTok", rawTiktok],
    ["Website", rawWebsite],
  ] as const) {
    if (!isValidOptionalUrl(value)) {
      return { ok: false, error: `${field} link isn't a valid URL.` };
    }
  }

  const jar = await cookies();

  // 1. Write the sealed welcome-intent cookie (shop journey). This is
  //    the same cookie the three welcome cards set · writing it here
  //    means a user who deep-links to /business-welcome still enters
  //    the shop journey correctly on signup.
  jar.set({
    name: WELCOME_INTENT_COOKIE,
    value: "shop",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
    secure: process.env.NODE_ENV === "production",
  });

  // 2. Write the sealed vertical cookie.
  jar.set({
    name: WELCOME_VERTICAL_COOKIE,
    value: serializeVerticalIntent({
      category: rawCategory,
      subtype: rawSubtype,
    }),
    ...welcomeVerticalCookieOptions(),
  });

  // 3. Write the shop name cookie. Plain string.
  jar.set({
    name: WELCOME_BUSINESS_SHOP_NAME_COOKIE,
    value: rawShopName,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WELCOME_BUSINESS_SHOP_NAME_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });

  // 4. Write the location cookie. Not JSON · plain string.
  jar.set({
    name: WELCOME_BUSINESS_LOCATION_COOKIE,
    value: rawLocation,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WELCOME_BUSINESS_LOCATION_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });

  // 5. Write business hours cookie · JSON { open, close }.
  jar.set({
    name: WELCOME_BUSINESS_HOURS_COOKIE,
    value: serializeBusinessHours(rawOpenTime, rawCloseTime),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WELCOME_BUSINESS_HOURS_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });

  // 6. Write facilities cookie · JSON string array (may be empty).
  jar.set({
    name: WELCOME_BUSINESS_FACILITIES_COOKIE,
    value: JSON.stringify(cleanFacilities),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WELCOME_BUSINESS_FACILITIES_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });

  // 7. Write rooms cookie · may be absent (0 chars means owner didn't fill it).
  if (cleanRooms !== null) {
    jar.set({
      name: WELCOME_BUSINESS_ROOMS_COOKIE,
      value: String(cleanRooms),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: WELCOME_BUSINESS_ROOMS_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  }

  // 8. Write description cookie · may be empty.
  if (rawDescription.length > 0) {
    jar.set({
      name: WELCOME_BUSINESS_DESCRIPTION_COOKIE,
      value: rawDescription,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: WELCOME_BUSINESS_DESCRIPTION_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  }

  // 9. Write social links cookie · JSON { instagram, facebook, tiktok, website }.
  //    Only persist if at least one field is filled.
  if (
    rawInstagram.length > 0 ||
    rawFacebook.length > 0 ||
    rawTiktok.length > 0 ||
    rawWebsite.length > 0
  ) {
    jar.set({
      name: WELCOME_BUSINESS_SOCIAL_LINKS_COOKIE,
      value: serializeSocialLinks({
        instagram: rawInstagram,
        facebook: rawFacebook,
        tiktok: rawTiktok,
        website: rawWebsite,
      }),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: WELCOME_BUSINESS_SOCIAL_LINKS_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  }

  // Continue to signup with the shop intent carried through. The
  // sealed /create-account page already handles the intent query.
  redirect("/nex-native/create-account?intent=shop");
}
