// src/app/nex-native/[businessSlug]/opengraph-image.tsx
//
// Dynamic Open Graph image per shop · SEO B4.
// Owner-authorised 2026-11-11.
// -----------------------------------------------------------------------------
// Next.js builds the OG card at request time via ImageResponse (jsx-in-SVG
// renderer). Pulls the business display_name, category and logo URL from
// nex_business. No fabricated ratings/reviews/prices · if the display_name
// is missing we render the fallback card.

import { ImageResponse } from "next/og";
import * as businessService from "@/lib/nex-native/business-service";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";
export const alt = "NEX shop";

const BG = "#F5EDD3"; // Pale Ivory
const INK = "#1A1512";
const INK_MUTE = "#5A4F42";
const ORANGE = "#FF7200";

export default async function OpenGraphImage({
  params,
}: {
  params: { businessSlug: string };
}): Promise<ImageResponse> {
  const business = await businessService
    .getBusinessBySlug(params.businessSlug)
    .catch(() => null);

  const displayName = business?.display_name?.trim() || "NEX Shop";
  const description =
    business?.description?.trim() ||
    "Online shop and business profile on NEX.";
  const logoUrl = business?.logo_url?.trim();

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
        {/* Header · NEX wordmark */}
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
            Shop
          </div>
        </div>

        {/* Body · logo + name + description */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
            marginTop: 8,
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              width={180}
              height={180}
              style={{
                width: 180,
                height: 180,
                borderRadius: 24,
                objectFit: "cover",
                border: `3px solid ${ORANGE}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 180,
                height: 180,
                borderRadius: 24,
                background: ORANGE,
                color: "#FFFFFF",
                fontSize: 80,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {displayName.charAt(0).toUpperCase()}
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
            <div
              style={{
                fontSize: 26,
                lineHeight: 1.35,
                color: INK_MUTE,
                maxHeight: 108,
                overflow: "hidden",
              }}
            >
              {description}
            </div>
          </div>
        </div>

        {/* Footer · canonical URL hint */}
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
