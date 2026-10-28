"use client";

// src/app/nex-native/emergency-help/profile/_profile-client.tsx
//
// Emergency Profile setup form. Owner-authorised 2026-10-25
// (Decision #1 · UI shell only). Everything in this file is UI
// state. Nothing persists. Nothing uploads. Nothing verifies.
//
// Approved for this slice:
//   · emergency Red Cross Shield background + dark gradient overlay
//     (same recipe as /activate and /alert)
//   · VerificationStatusCard at top · pinned to "not_started"
//   · "Save & Verify Identity" CTA label (aspirational — see honest
//     disclosure card at the foot)
//   · dedicated GuardianSetupSection for the minor flow (full
//     guardian identity + separate authorisation consent)
//   · data-handling disclosure card that strictly reflects what is
//     implemented today (nothing is stored, nothing is verified,
//     nothing is encrypted at rest, nothing is scoped-released)
//
// Not approved by this slice (Decisions #2-#8 remain open):
//   · backend wiring, server actions, DB schema, migrations
//   · verification-provider integration
//   · storage buckets / encryption / disclosure gate
//   · child/guardian account model, minimum age, expiry, rejection UX
//
// Honest-copy policy: no claims of verification, encryption, liveness
// detection, or emergency-only disclosure anywhere in this UI until
// the implementation exists AND has a passing test. The Save tap
// shows an inline "nothing has been submitted" line and leaves the
// VerificationStatusCard at "not_started". No fake transitions.
//
// All text inputs continue to use NexInput / NexTextarea with
// forceKeypadActive=true per the sealed universal NEX-keypad rule.

import * as React from "react";
import Link from "next/link";
import { NexInput } from "@/lib/nex-native/nex-keyboard/nex-input";
import { NexTextarea } from "@/lib/nex-native/nex-keyboard/nex-textarea";
import {
  NEX,
  Section,
  Field,
  FacePhotoField,
  FileField,
  styleHint,
  styleInput,
  styleFrostedCard,
  formatDobMask,
  computeAge,
} from "./_profile-primitives";
import { VerificationStatusCard } from "./_verification-status-card";
import {
  GuardianSetupSection,
  INITIAL_GUARDIAN_STATE,
  isGuardianComplete,
  type GuardianState,
} from "./_guardian-setup-section";

type Sex = "male" | "female";
type IdType = "driving" | "passport" | "social" | "birth";

// Owner directive 2026-10-25 · the four former-sections merge into
// one container · each inner block uses a white header at a sensible
// 15px size · soft gradient divider between blocks.
const styleSubHeader: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1.2,
  color: "#FFFFFF",
  letterSpacing: "0.01em",
};
const styleSubBlock: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};
const styleDivider: React.CSSProperties = {
  height: 1,
  margin: "14px 0 16px",
  background:
    "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
};

export function EmergencyProfileClient(): React.JSX.Element {
  // Face photo
  const [facePhoto, setFacePhoto] = React.useState<File | null>(null);
  const [facePreview, setFacePreview] = React.useState<string | null>(null);

  // Core identity
  const [fullName, setFullName] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [sex, setSex] = React.useState<Sex | "">("");

  // Contact
  const [address, setAddress] = React.useState("");
  const [mobile, setMobile] = React.useState("");

  // Identity document
  const [idType, setIdType] = React.useState<IdType | "">("");
  const [idDoc, setIdDoc] = React.useState<File | null>(null);

  // Guardian · minor flow (adult-identity verification + authorisation)
  const [guardian, setGuardian] = React.useState<GuardianState>(
    INITIAL_GUARDIAN_STATE,
  );
  const updateGuardian = React.useCallback(
    (patch: Partial<GuardianState>) =>
      setGuardian((prev) => ({ ...prev, ...patch })),
    [],
  );

  // Trusted contact (optional · adult flow only)
  const [trustedName, setTrustedName] = React.useState("");
  const [trustedRelation, setTrustedRelation] = React.useState("");
  const [trustedMobile, setTrustedMobile] = React.useState("");

  // Consent + submit flash
  const [consent, setConsent] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);

  // Face photo preview via createObjectURL · revoke on unmount or
  // when the file changes to avoid memory leaks.
  React.useEffect(() => {
    if (!facePhoto) {
      setFacePreview(null);
      return;
    }
    const url = URL.createObjectURL(facePhoto);
    setFacePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [facePhoto]);

  const age = computeAge(dob);
  const isMinor = age !== null && age < 18;
  const isTooYoung = age !== null && age < 4;

  const idTypeOk =
    idType !== "" &&
    (isMinor ? idType === "birth" : idType !== "birth");

  const guardianOk = isMinor ? isGuardianComplete(guardian) : true;

  const canSubmit =
    !!facePhoto &&
    fullName.trim().length > 1 &&
    age !== null &&
    !isTooYoung &&
    sex !== "" &&
    address.trim().length > 4 &&
    mobile.trim().length >= 7 &&
    idTypeOk &&
    !!idDoc &&
    guardianOk &&
    consent;

  const onSave = (): void => {
    setAttempted(true);
    // Honest-claim guard · owner directive 2026-10-25 (Decision #1).
    // DO NOT flip VerificationStatusCard to any state beyond
    // "not_started" from this handler. Nothing has been submitted.
    // The surface only acknowledges that the form passes local
    // validation when canSubmit === true. Real submission requires
    // backend wiring (Decisions #2-#8, unapproved).
  };

  return (
    <main
      data-nex-emergency-profile
      style={{
        // Owner directive 2026-10-25 · mobile-first screen size (fit
        // the .nex-native-frame on desktop · viewport on mobile).
        // Background image renders at full width + natural height
        // anchored to the top, with a soft fade from the image's
        // bottom edge into solid black beneath · if the content
        // scrolls longer than the image, the area below is black
        // rather than a stretched / blurred image.
        position: "relative",
        minHeight: "100%",
        width: "100%",
        backgroundColor: "#000",
        backgroundImage: [
          // Top layer · fade the bottom of the image into black so
          // the seam between image and black backdrop is invisible.
          "linear-gradient(180deg, transparent 0%, transparent 72%, #000 100%)",
          // Base layer · the Red Cross Shield at full width.
          "url(/nex-emergency/activate-background.png)",
        ].join(", "),
        backgroundSize: "100% auto, 100% auto",
        backgroundPosition: "top center, top center",
        backgroundRepeat: "no-repeat, no-repeat",
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding:
          "max(24px, env(safe-area-inset-top, 0px)) 20px calc(env(safe-area-inset-bottom, 0px) + 32px)",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Dark gradient overlay · softens the vivid red of the shield
          background + boosts legibility of the identity form on top.
          Owner directive 2026-10-25 · overlay now spans full page so
          content below the image sits on solid black. */}
      <div
        aria-hidden
        style={{
          // Owner directive 2026-10-25 · dark shade over the header
          // removed · the top of the overlay is now fully transparent
          // so the Red Cross Shield image reads clean behind the title.
          // Darkening builds up gradually below the hero.
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, transparent 0%, rgba(6, 16, 30, 0.20) 24%, rgba(6, 16, 30, 0.60) 60%, rgba(0, 0, 0, 0.90) 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 560,
          margin: "0 auto",
        }}
      >
        <nav style={{ marginBottom: 14 }}>
          <Link
            href="/nex-native/emergency-help/activate"
            style={{
              color: NEX.cyan,
              fontSize: 13,
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            ← Back
          </Link>
        </nav>

        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: NEX.red,
            marginBottom: 6,
          }}
        >
          NEX Emergency Profile
        </div>
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            textShadow: "0 2px 14px rgba(255, 51, 85, 0.5)",
          }}
        >
          Who are you?
        </h1>

        {/* Owner directive 2026-10-25 · VerificationStatusCard pinned
            to "not_started" at runtime. Design previews for the other
            four states live in the component; nothing in this file
            flips to them. See the component header for the guard. */}
        <VerificationStatusCard state="not_started" />

        <div
          data-nex-emergency-profile-intro
          style={{
            ...styleFrostedCard,
            padding: "12px 14px",
            borderRadius: 12,
            fontSize: 13,
            lineHeight: 1.55,
            color: NEX.text,
            marginBottom: 20,
          }}
        >
          In the event of a situation where police or a NEX representative
          needs to recognise you — any situation where vision is the only
          confirmed identity — we require the following information. Your
          details are secure and will never be presented unless the
          Emergency button has been activated.
        </div>

        {/* ── Your details · 4 sub-blocks merged into one container ──
            Owner directive 2026-10-25 · the four separate sections
            (Face / Who / Reach / ID) collapse into a single frosted
            container with white sub-headers · colored eyebrows retired. */}
        <div
          data-nex-emergency-profile-details
          style={{
            ...styleFrostedCard,
            marginBottom: 18,
            padding: "16px 16px 18px",
            borderRadius: 14,
          }}
        >
          {/* Face photo */}
          <div style={styleSubBlock}>
            <h2 style={styleSubHeader}>Live face photo</h2>
            <p style={styleHint}>
              Use your phone&apos;s front camera. Your current face · not a
              stored photo. A responder sees this on the alert.
            </p>
            <FacePhotoField
              file={facePhoto}
              previewUrl={facePreview}
              onFile={setFacePhoto}
              testId="nex-emergency-profile-face-capture"
            />
          </div>

          <div aria-hidden style={styleDivider} />

          {/* Who you are */}
          <div style={styleSubBlock}>
            <h2 style={styleSubHeader}>Who you are</h2>
            <Field label="Full legal name (as on your ID)">
              <NexInput
                value={fullName}
                onChange={setFullName}
                placeholder="e.g. Sari Nurhayati"
                maxLength={120}
                forceKeypadActive={true}
                accentColor={NEX.cyan}
                style={styleInput}
              />
            </Field>

            <Field
              label="Date of birth"
              help="DD / MM / YYYY · we compute your age from this"
            >
              <NexInput
                value={dob}
                onChange={(next) => setDob(formatDobMask(next))}
                placeholder="DD/MM/YYYY"
                maxLength={10}
                forceKeypadActive={true}
                accentColor={NEX.cyan}
                planes={["numbers"]}
                style={styleInput}
              />
              {age !== null ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: isTooYoung ? NEX.red : NEX.textDim,
                  }}
                >
                  {isTooYoung
                    ? "NEX Emergency Help is available from age 4."
                    : isMinor
                      ? `Age ${age} · a parent / guardian must complete the Guardian section below`
                      : `Age ${age}`}
                </div>
              ) : dob.length > 0 ? (
                <div style={{ marginTop: 6, fontSize: 12, color: NEX.gold }}>
                  Enter as DD/MM/YYYY
                </div>
              ) : null}
            </Field>

            <Field label="Sex (shown on the alert so a responder can identify you)">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 8,
                }}
              >
                {(
                  [
                    { v: "female", label: "Female" },
                    { v: "male", label: "Male" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setSex(opt.v)}
                    data-nex-sex-option={opt.v}
                    data-nex-sex-selected={sex === opt.v ? "true" : "false"}
                    style={{
                      padding: "10px 8px",
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      cursor: "pointer",
                      background:
                        sex === opt.v
                          ? "rgba(0, 175, 255, 0.18)"
                          : NEX.inputBg,
                      border:
                        sex === opt.v
                          ? `1.5px solid ${NEX.cyan}`
                          : `1px solid ${NEX.inputBorder}`,
                      color: sex === opt.v ? NEX.text : NEX.textDim,
                      fontFamily: "inherit",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div aria-hidden style={styleDivider} />

          {/* How to reach you */}
          <div style={styleSubBlock}>
            <h2 style={styleSubHeader}>How to reach you</h2>
            <Field
              label="Home address"
              help="Street, number, village/district, city, country"
            >
              <NexTextarea
                value={address}
                onChange={setAddress}
                placeholder="e.g. Jl. Malioboro No. 12, Yogyakarta, Indonesia"
                rows={3}
                maxLength={300}
                forceKeypadActive={true}
                accentColor={NEX.cyan}
                style={{ ...styleInput, minHeight: 76, resize: "vertical" }}
              />
            </Field>

            <Field label="Mobile number" help="Include country code, e.g. +62">
              <NexInput
                value={mobile}
                onChange={setMobile}
                placeholder="+62 812 3456 7890"
                maxLength={24}
                forceKeypadActive={true}
                accentColor={NEX.cyan}
                planes={["numbers", "symbols"]}
                inputMode="tel"
                style={styleInput}
              />
            </Field>
          </div>

          {!isTooYoung && age !== null && (
            <>
              <div aria-hidden style={styleDivider} />

              {/* Identity document */}
              <div style={styleSubBlock}>
                <h2 style={styleSubHeader}>Identity document</h2>
                <p style={styleHint}>
                  Pick one · a clear photo of the full document. The name
                  on the document must match the legal name above.
                </p>
                <Field label="Document type">
                  <select
                    data-testid="nex-emergency-profile-id-type"
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as IdType | "")}
                    style={{
                      ...styleInput,
                      appearance: "none",
                      WebkitAppearance: "none",
                      MozAppearance: "none",
                      backgroundImage:
                        "linear-gradient(45deg, transparent 50%, " +
                        NEX.textDim +
                        " 50%), linear-gradient(135deg, " +
                        NEX.textDim +
                        " 50%, transparent 50%)",
                      backgroundPosition:
                        "calc(100% - 18px) 50%, calc(100% - 12px) 50%",
                      backgroundSize: "6px 6px, 6px 6px",
                      backgroundRepeat: "no-repeat",
                      paddingRight: 32,
                    }}
                  >
                    <option value="" disabled>
                      Select ID type
                    </option>
                    <option value="driving">Driving licence</option>
                    <option value="passport">Passport</option>
                    <option value="social">Social ID</option>
                    <option value="birth">Birth certificate (minor)</option>
                  </select>
                  {idType !== "" && !idTypeOk ? (
                    <div
                      style={{ marginTop: 6, fontSize: 12, color: NEX.red }}
                    >
                      {isMinor
                        ? "Under 18 · select Birth certificate (minor)."
                        : "Birth certificate is only accepted for minors (under 18)."}
                    </div>
                  ) : null}
                </Field>
                <FileField
                  label="Upload document photo"
                  file={idDoc}
                  onFile={setIdDoc}
                  accept="image/*,application/pdf"
                  capture="environment"
                />

                <div
                  data-nex-profile-id-enforcement
                  style={{
                    marginTop: 8,
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "rgba(255, 51, 85, 0.08)",
                    border: `1px solid ${NEX.borderRed}`,
                    fontSize: 11.5,
                    lineHeight: 1.45,
                    color: "#FFD2DA",
                  }}
                >
                  <strong style={{ color: "#FFFFFF" }}>
                    ID upload is required.
                  </strong>{" "}
                  Accounts without a verified ID stay <em>unactivated</em>{" "}
                  for Emergency Help · the red button will not fire an
                  alert until this step is complete.
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Guardian setup ─────────────────────────────────────── */}
        {isMinor ? (
          <GuardianSetupSection value={guardian} onChange={updateGuardian} />
        ) : null}

        {/* ── Trusted contact (optional) · adult flow only ───────── */}
        {!isMinor && (
          <Section
            title="Trusted contact (optional)"
            accent={NEX.green}
            dim
          >
            <p style={styleHint}>
              One person who should always be told if you activate Emergency
              Help · typically next of kin.
            </p>
            <Field label="Name">
              <NexInput
                value={trustedName}
                onChange={setTrustedName}
                placeholder="e.g. Rina Nurhayati"
                maxLength={120}
                forceKeypadActive={true}
                accentColor={NEX.green}
                style={styleInput}
              />
            </Field>
            <Field label="Relation">
              <NexInput
                value={trustedRelation}
                onChange={setTrustedRelation}
                placeholder="e.g. Sister"
                maxLength={40}
                forceKeypadActive={true}
                accentColor={NEX.green}
                style={styleInput}
              />
            </Field>
            <Field label="Mobile">
              <NexInput
                value={trustedMobile}
                onChange={setTrustedMobile}
                placeholder="+62 812 3456 7890"
                maxLength={24}
                forceKeypadActive={true}
                accentColor={NEX.green}
                planes={["numbers", "symbols"]}
                inputMode="tel"
                style={styleInput}
              />
            </Field>
          </Section>
        )}

        {/* ── Consent ────────────────────────────────────────────── */}
        <label
          data-nex-profile-consent
          style={{
            ...styleFrostedCard,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 14px",
            borderRadius: 12,
            marginBottom: 16,
            fontSize: 13,
            lineHeight: 1.5,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{
              marginTop: 3,
              width: 18,
              height: 18,
              accentColor: NEX.cyan,
              cursor: "pointer",
            }}
          />
          <span style={{ color: NEX.text }}>
            I confirm the information above is current and true. I understand
            NEX may suspend my account and that false details could delay a
            real emergency response.
          </span>
        </label>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <button
          type="button"
          data-testid="nex-emergency-profile-save"
          onClick={onSave}
          disabled={!canSubmit}
          style={{
            // Owner directive 2026-10-25 · frosted-dark fill with
            // cyan rim + 3px cyan stripes on left AND right edges ·
            // same "sibling card" shape as the How To Help Close
            // button. Keeps the CTA visually tied to the frosted
            // containers above instead of standing out as a solid pill.
            width: "100%",
            padding: "14px 20px",
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.02em",
            cursor: canSubmit ? "pointer" : "not-allowed",
            color: "#FFFFFF",
            background: NEX.surface,
            border: `1px solid ${NEX.cyan}3A`,
            borderLeft: `3px solid ${NEX.cyan}`,
            borderRight: `3px solid ${NEX.cyan}`,
            boxShadow: canSubmit
              ? "0 10px 24px -14px rgba(0, 175, 255, 0.55)"
              : "none",
            opacity: canSubmit ? 1 : 0.55,
            fontFamily: "inherit",
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          Save &amp; Verify Identity
        </button>

        {/* Honest-save acknowledgement · appears ONLY after the user
            taps the CTA with a complete form. Deliberately does NOT
            claim submission or verification · the backend is not
            wired. VerificationStatusCard above stays at
            "not_started" regardless. */}
        {attempted ? (
          <div
            data-testid="nex-emergency-profile-save-ack"
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: canSubmit
                ? "rgba(0, 175, 255, 0.08)"
                : "rgba(255, 51, 85, 0.08)",
              border: `1px solid ${canSubmit ? NEX.border : NEX.borderRed}`,
              fontSize: 12,
              lineHeight: 1.5,
              color: NEX.textDim,
            }}
          >
            {canSubmit
              ? "Form is complete locally. Nothing has been submitted or verified · the backend for identity verification is not yet connected."
              : "Please complete every required field before tapping Save & Verify Identity."}
          </div>
        ) : null}

        {/* ── Data-handling disclosure · strictly honest ─────────── */}
        <section
          data-nex-emergency-profile-data-handling
          style={{
            ...styleFrostedCard,
            marginTop: 20,
            padding: "14px 16px",
            borderRadius: 14,
          }}
        >
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: NEX.textDim,
            }}
          >
            What happens with your details · today
          </h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12,
              lineHeight: 1.55,
              color: NEX.textDim,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <li>Nothing on this screen is sent to a server.</li>
            <li>Face photo and ID document stay in your browser only.</li>
            <li>
              Identity verification has not been connected. The
              &ldquo;Save &amp; Verify Identity&rdquo; button runs local
              checks only.
            </li>
            <li>
              Encryption at rest, liveness detection, and
              emergency-only disclosure are planned but not yet
              implemented. We will not claim they work until they do.
            </li>
            <li>
              When the backend lands, your details will be released
              only to responders who have accepted an active emergency
              you have triggered, under rules you will see on this
              page before anything is enabled.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
