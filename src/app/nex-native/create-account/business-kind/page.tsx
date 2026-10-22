// src/app/nex-native/create-account/business-kind/page.tsx
//
// NEX · post-signup · "What's your business?" vertical-picker step.
// Owner-authorised 2026-10-20 · Phase A1 Accommodation.
// -----------------------------------------------------------------------------
// Reached only from /create-account/pick-theme when the user signed
// up with `nex_welcome_intent === "shop"` AND has not yet declared a
// vertical in `nex_welcome_vertical`.
//
// After the user picks Villa / Homestay / Kost, the server action
// `rememberVerticalAction` writes the `nex_welcome_vertical` cookie
// and the client redirects back to /create-account/pick-theme, which
// now sees the vertical and sorts the free themes by preset.
//
// Guard-rails:
//   · Session required · unauthenticated viewers go to /sign-in.
//   · Shop intent required · non-shop viewers fall straight through
//     to /create-account/pick-theme (which has its own routing).
//   · Skip link routes to /pick-theme without writing the cookie ·
//     the sealed pick-theme flow continues untouched for anyone who
//     doesn't want to classify.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPageHeader } from "../../_page-header";
import {
  WELCOME_INTENT_COOKIE,
  isWelcomeIntent,
  readVerticalIntent,
} from "../../welcome/_welcome-intent";
import { VerticalPicker } from "../../welcome/_vertical-picker";
import { skipVerticalPickerAction } from "./_skip-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
};

const PICK_THEME_HREF = "/nex-native/create-account/pick-theme";
const SIGN_IN_HREF = "/nex-native/sign-in";

export default async function BusinessKindStepPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect(SIGN_IN_HREF);

  const cookieJar = await cookies();
  const rawIntent = cookieJar.get(WELCOME_INTENT_COOKIE)?.value ?? null;
  const intent = isWelcomeIntent(rawIntent) ? rawIntent : null;

  // Non-shop intents never reach this step through routing · if a user
  // navigates here directly without shop intent, send them to the
  // sealed pick-theme page which handles non-shop paths natively.
  if (intent !== "shop") redirect(PICK_THEME_HREF);

  // If a vertical is ALREADY recorded (user came back here manually)
  // we don't block them · pick-theme will see the vertical and sort.
  // We still render the picker so they can change their mind.
  const existing = await readVerticalIntent();

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        data-nex-business-kind-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 20px) 20px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="create-account-business-kind" />

          <header style={{ margin: "20px 0 18px", textAlign: "center" }}>
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: "0.24em",
                color: NEX.orange,
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Step · 1 of 3
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.015em",
                lineHeight: 1.2,
              }}
            >
              What&apos;s your business?
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                fontSize: 13,
                color: NEX.textSecondary,
                lineHeight: 1.5,
                maxWidth: 400,
              }}
            >
              Phase A1 ships Accommodation (Villa · Homestay · Kost).
              Pick one and we&apos;ll tune your chat theme + shop cover
              around it. The other categories arrive soon.
            </p>
            {existing && (
              <p
                data-nex-business-kind-existing
                data-nex-business-kind-existing-category={existing.category}
                data-nex-business-kind-existing-subtype={existing.subtype}
                style={{
                  margin: "8px auto 0",
                  fontSize: 11.5,
                  color: NEX.cyan,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Current pick · {existing.category} · {existing.subtype}
              </p>
            )}
          </header>

          <VerticalPicker />

          {/* R1 fix (owner-authorised 2026-10-20) · Skip must POST to
              the server action so the short-lived decline sentinel is
              written BEFORE the redirect to /pick-theme. A plain
              <Link> would just route the user to pick-theme, which
              would immediately detect "shop intent + no vertical"
              and send them straight back here · infinite loop. */}
          <form
            action={skipVerticalPickerAction}
            data-nex-business-kind-skip-form
            style={{ textAlign: "center", marginTop: 14, margin: 0 }}
          >
            <button
              type="submit"
              data-nex-business-kind-skip
              style={{
                background: "transparent",
                border: "none",
                padding: "8px 10px",
                color: NEX.textMuted,
                fontSize: 12.5,
                textDecoration: "underline",
                cursor: "pointer",
                fontFamily: "inherit",
                marginTop: 14,
              }}
            >
              Skip for now · pick a theme
            </button>
          </form>

          <div
            style={{
              marginTop: 24,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(2,9,20,0.5)",
              border: `1px solid ${NEX.cyanSoft}`,
              fontSize: 11,
              color: NEX.textMuted,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            You can change this any time from your business settings.
            Nothing is created yet · we save your choice to tune the
            next two steps.
          </div>
        </div>
      </main>
    </>
  );
}
