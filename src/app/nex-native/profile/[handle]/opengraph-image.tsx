// src/app/nex-native/profile/[handle]/opengraph-image.tsx
//
// Dynamic Open Graph image per discoverable profile · SEO B4.
// Owner-authorised 2026-11-11.
// -----------------------------------------------------------------------------
// Only renders a profile-specific card when the account's `is_discoverable`
// flag is true. For every other case (handle not found, non-discoverable,
// bad shape) we render a neutral NEX Profile card so the OG URL never 404s,
// but we never leak account details.

import { ImageResponse } from "next/og";
import * as accountService from "@/lib/nex-native/account-service";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";
export const alt = "NEX profile";

const BG = "#F5EDD3";
const INK = "#1A1512";
const INK_MUTE = "#5A4F42";
const ORANGE = "#FF7200";

export default async function OpenGraphImage({
  params,
}: {
  params: { handle: string };
}): Promise<ImageResponse> {
  const handle = (params.handle || "").toLowerCase().trim();
  let displayName = "NEX Profile";
  let bio = "A public profile on NEX.";
  let avatarUrl: string | null = null;
  let discoverable = false;

  if (/^[a-z0-9_.-]{2,32}$/.test(handle)) {
    const account = await accountService
      .getAccountByNexHandle(handle)
      .catch(() => null);
    if (account) {
      const profile = await accountProfileService
        .getProfileByAccountId(account.id)
        .catch(() => null);
      if (profile && profile.is_discoverable === true) {
        discoverable = true;
        displayName =
          account.display_name?.trim() || `@${handle}`;
        bio = profile.bio?.trim() || `${displayName} on NEX.`;
        avatarUrl = profile.avatar_url?.trim() || null;
      }
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: 72,
          fontFamily: "sans-serif",
          color: INK,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 40,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              color: INK,
            }}
          >
            <span>NE</span>
            <span style={{ color: ORANGE }}>X</span>
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: INK_MUTE,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            Profile
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
            marginTop: 8,
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              width={180}
              height={180}
              style={{
                width: 180,
                height: 180,
                borderRadius: 90,
                objectFit: "cover",
                border: `3px solid ${ORANGE}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 180,
                height: 180,
                borderRadius: 90,
                background: ORANGE,
                color: "#FFFFFF",
                fontSize: 80,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {displayName.charAt(discoverable ? 0 : 1).toUpperCase()}
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              flex: 1,
              maxWidth: 820,
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 900,
                lineHeight: 1.1,
                color: INK,
              }}
            >
              {displayName}
            </div>
            {discoverable ? (
              <div
                style={{
                  fontSize: 26,
                  lineHeight: 1.35,
                  color: INK_MUTE,
                  maxHeight: 108,
                  overflow: "hidden",
                }}
              >
                {bio}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 26,
                  lineHeight: 1.35,
                  color: INK_MUTE,
                }}
              >
                This profile is not publicly discoverable.
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontWeight: 600,
            color: INK_MUTE,
            letterSpacing: "0.02em",
          }}
        >
          nexapp · one platform for shops, link-in-bio, chat and discovery
        </div>
      </div>
    ),
    { ...size },
  );
}
