// src/app/nex-native/create-account/pick-cover/page.tsx
//
// NEX · S1 · post-signup Face Cover picker (Shop intent only).
// Owner-authorised 2026-10-18 · Q1b · D1 · D2.
// -----------------------------------------------------------------------------
// Only users who tapped the "Chat Themes Shop" card on the welcome
// page (nex_welcome_intent === "shop") see this surface. Everyone
// else continues the existing create-account chain without a cover
// pick · the Themes and Personalised intents don't need one.
//
// What this surface IS:
//   · A grid of the 10 sealed cover layouts rendered via the sealed
//     MiniPhoneFrame primitive (reused from `/cover-themes-library`).
//   · One form per tile · submitting posts to the sealed
//     `pickCoverAction` which validates server-side and writes the
//     httpOnly `nex_pending_cover_layout` cookie (S0).
//
// What this surface is NOT:
//   · Not a business creator · no nex_business row is written here.
//   · Not a redesign of the cover gallery · reuses sealed primitives
//     verbatim.
//
// Shop-intent gate:
//   · intent === "shop"              → render picker
//   · intent === "themes" | "personalised" → redirect to the
//     existing add-to-home-screen landing (same as pick-theme does
//     today)
//   · intent missing / invalid       → redirect to the same safe
//     fallback · we never show the picker to a user who didn't opt in

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  COVER_LAYOUT_IDS,
  COVER_LAYOUT_LABELS,
} from "../../cover/layout-ids";
import { MiniPhoneFrame } from "../../cover-themes-library/_mini-phone-frame";
import {
  WELCOME_INTENT_COOKIE,
  isWelcomeIntent,
} from "../../welcome/_welcome-intent";
import { readPendingCoverLayoutId } from "@/lib/nex-native/pending-cover-cookie";
import { pickCoverAction } from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The sealed non-Shop intents land on the existing Add-to-Home
 *  screen (Bridge 42). Picker is skipped for them. */
const NON_SHOP_FALLBACK = "/nex-native/create-account/welcome";
const SIGN_IN_HREF =
  "/nex-native/sign-in?next=/nex-native/create-account/pick-cover";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#7D9BC0",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  border: "rgba(139, 169, 209, 0.14)",
  panel: "rgba(6, 15, 28, 0.72)",
};

export default async function PickCoverPage({
  searchParams,
}: {
  searchParams?: Promise<{ e?: string }>;
}) {
  // Session gate · signed-out visitors go to sign-in with a `next`
  // param so a successful sign-in lands them back on the picker.
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect(SIGN_IN_HREF);

  // Intent gate · ONLY the Shop intent should see the Face Cover
  // picker. Everyone else continues straight to the existing
  // post-signup add-to-home landing.
  const store = await cookies();
  const intentRaw = store.get(WELCOME_INTENT_COOKIE)?.value ?? null;
  if (!isWelcomeIntent(intentRaw) || intentRaw !== "shop") {
    redirect(NON_SHOP_FALLBACK);
  }

  // Read any existing pending pick so we can highlight it as the
  // user's current selection · pre-selection prevents a lost pick
  // from forcing the user to re-choose if they came back here.
  const existingPick = await readPendingCoverLayoutId();

  const sp = (await searchParams) ?? {};
  const errorCode = sp.e ?? null;
  const errorCopy =
    errorCode === "missing"
      ? "No layout was picked. Tap one of the covers below to continue."
      : errorCode === "invalid"
        ? "That layout isn't valid. Please pick one of the covers below."
        : null;

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-pick-cover
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px 20px 48px",
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <header style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Step 2 of 2
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              Pick your NEX Face
            </h1>
            <p
              style={{
                marginTop: 8,
                color: NEX.textDim,
                fontSize: 13,
                lineHeight: 1.55,
                maxWidth: 640,
              }}
            >
              Your Face Cover is your shareable NEX page · pick one of
              the 10 sealed layouts. You can change it any time from
              your shop settings.
            </p>
            {errorCopy && (
              <div
                role="alert"
                data-nex-pick-cover-error
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255, 114, 0, 0.55)",
                  background: "rgba(255, 114, 0, 0.08)",
                  color: NEX.orange,
                  fontSize: 12,
                  fontWeight: 600,
                  maxWidth: 640,
                }}
              >
                {errorCopy}
              </div>
            )}
          </header>

          <div
            data-nex-pick-cover-grid
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 20,
              justifyItems: "center",
            }}
          >
            {COVER_LAYOUT_IDS.map((id, i) => {
              const num = String(i + 1).padStart(2, "0");
              const label = COVER_LAYOUT_LABELS[id];
              const isCurrent = existingPick === id;
              const previewHref = `/nex-native/cover/preview/${id}?embed=1`;
              return (
                <form
                  key={id}
                  action={pickCoverAction}
                  data-nex-pick-cover-card
                  data-nex-pick-cover-layout={id}
                  data-nex-pick-cover-current={isCurrent ? "1" : "0"}
                  style={{ margin: 0, padding: 0 }}
                >
                  <input type="hidden" name="layout_id" value={id} />
                  <button
                    type="submit"
                    aria-label={`Pick ${label}`}
                    style={{
                      display: "block",
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      color: "inherit",
                      width: 200,
                      position: "relative",
                    }}
                  >
                    <MiniPhoneFrame
                      previewHref={previewHref}
                      frameWidth={190}
                      label={`${label} preview`}
                    />
                    {/* Template number · bottom-left corner badge */}
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        padding: "3px 7px",
                        borderRadius: 999,
                        background: "rgba(2, 9, 20, 0.75)",
                        border: isCurrent
                          ? `1px solid ${NEX.cyan}`
                          : `1px solid ${NEX.cyanSoft}`,
                        color: NEX.cyan,
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {num}
                      {isCurrent ? " ✓" : ""}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        color: NEX.text,
                      }}
                    >
                      {label}
                    </div>
                  </button>
                </form>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 28,
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px dashed ${NEX.border}`,
              fontSize: 11,
              color: NEX.textDim,
              lineHeight: 1.5,
              maxWidth: 820,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <strong style={{ color: NEX.text }}>Pending selection.</strong>{" "}
            Your pick is remembered for 24 hours. It only becomes your
            live Face Cover when you activate your shop.
          </div>
        </div>
      </main>
    </>
  );
}
