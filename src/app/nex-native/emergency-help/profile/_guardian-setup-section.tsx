"use client";

// src/app/nex-native/emergency-help/profile/_guardian-setup-section.tsx
//
// Owner-authorised 2026-10-25 (Decision #1 · UI shell only).
//
// Dedicated guardian-setup section for the minor flow on the
// Emergency Profile surface. The adult who is setting up a child's
// profile is held to the SAME identity bar as any adult:
//   · live front-camera face photo
//   · full legal name, DOB, mobile
//   · government ID (driving licence · passport · national ID)
//   · explicit guardian-authorisation consent (separate from the
//     child-side consent on the main form)
//
// Honest-claim guard:
//   This section captures state locally. It does NOT upload face or
//   ID bytes. It does NOT verify guardian identity. It does NOT link
//   guardian ↔ child in any database. The child/guardian account
//   model + verification provider + encryption + storage policies
//   remain unapproved (Decisions #2-#8). The disclosure card at the
//   foot of the parent surface tells the user this directly.

import * as React from "react";
import { NexInput } from "@/lib/nex-native/nex-keyboard/nex-input";
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

export type GuardianIdType = "" | "driving" | "passport" | "social";

export interface GuardianState {
  readonly facePhoto: File | null;
  readonly fullName: string;
  readonly dob: string;
  readonly mobile: string;
  readonly idType: GuardianIdType;
  readonly idDoc: File | null;
  readonly consent: boolean;
}

export const INITIAL_GUARDIAN_STATE: GuardianState = {
  facePhoto: null,
  fullName: "",
  dob: "",
  mobile: "",
  idType: "",
  idDoc: null,
  consent: false,
};

export function isGuardianComplete(g: GuardianState): boolean {
  const age = computeAge(g.dob);
  return (
    !!g.facePhoto &&
    g.fullName.trim().length > 1 &&
    age !== null &&
    age >= 18 &&
    g.mobile.trim().length >= 7 &&
    g.idType !== "" &&
    !!g.idDoc &&
    g.consent
  );
}

export function GuardianSetupSection({
  value,
  onChange,
}: {
  readonly value: GuardianState;
  readonly onChange: (patch: Partial<GuardianState>) => void;
}): React.JSX.Element {
  const [facePreview, setFacePreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!value.facePhoto) {
      setFacePreview(null);
      return;
    }
    const url = URL.createObjectURL(value.facePhoto);
    setFacePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.facePhoto]);

  const age = computeAge(value.dob);
  const guardianAgeOk = age !== null && age >= 18;

  return (
    <Section title="Guardian setup (parent or legal guardian)" accent={NEX.gold}>
      <p style={styleHint}>
        You are the adult setting up this child&apos;s profile. We verify
        your identity to the same bar as any adult profile. Your
        details are held separately from the child&apos;s and are
        released only under the same emergency-disclosure rules.
      </p>

      <Field label="Your live face photo">
        <FacePhotoField
          file={value.facePhoto}
          previewUrl={facePreview}
          onFile={(f) => onChange({ facePhoto: f })}
          testId="nex-emergency-profile-guardian-face"
          label="Open camera · take your live photo"
        />
      </Field>

      <Field label="Your full legal name (as on your ID)">
        <NexInput
          value={value.fullName}
          onChange={(next) => onChange({ fullName: next })}
          placeholder="e.g. Budi Nurhayati"
          maxLength={120}
          forceKeypadActive={true}
          accentColor={NEX.gold}
          style={styleInput}
        />
      </Field>

      <Field
        label="Your date of birth"
        help="DD / MM / YYYY · the guardian must be 18 or older"
      >
        <NexInput
          value={value.dob}
          onChange={(next) => onChange({ dob: formatDobMask(next) })}
          placeholder="DD/MM/YYYY"
          maxLength={10}
          forceKeypadActive={true}
          accentColor={NEX.gold}
          planes={["numbers"]}
          style={styleInput}
        />
        {age !== null ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: guardianAgeOk ? NEX.textDim : NEX.red,
            }}
          >
            {guardianAgeOk
              ? `Age ${age}`
              : "A guardian must be 18 or older to authorise a child's profile."}
          </div>
        ) : null}
      </Field>

      <Field label="Your mobile number" help="Include country code, e.g. +62">
        <NexInput
          value={value.mobile}
          onChange={(next) => onChange({ mobile: next })}
          placeholder="+62 812 3456 7890"
          maxLength={24}
          forceKeypadActive={true}
          accentColor={NEX.gold}
          planes={["numbers", "symbols"]}
          inputMode="tel"
          style={styleInput}
        />
      </Field>

      <Field label="Your identity document">
        <select
          data-testid="nex-emergency-profile-guardian-id-type"
          value={value.idType}
          onChange={(e) =>
            onChange({ idType: e.target.value as GuardianIdType })
          }
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
          <option value="social">National / social ID</option>
        </select>
      </Field>

      <FileField
        label="Upload document photo"
        file={value.idDoc}
        onFile={(f) => onChange({ idDoc: f })}
        accept="image/*,application/pdf"
        capture="environment"
      />

      {/* Guardian authorisation consent · separate from the child-side
          consent on the main form. Two-sided consent is a precondition
          for any backend link between guardian ↔ child when that
          decision is approved. */}
      <label
        data-nex-emergency-profile-guardian-consent
        style={{
          ...styleFrostedCard,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 12,
          fontSize: 13,
          lineHeight: 1.5,
          cursor: "pointer",
          marginTop: 6,
        }}
      >
        <input
          type="checkbox"
          checked={value.consent}
          onChange={(e) => onChange({ consent: e.target.checked })}
          style={{
            marginTop: 3,
            width: 18,
            height: 18,
            accentColor: NEX.gold,
            cursor: "pointer",
          }}
        />
        <span style={{ color: NEX.text }}>
          I confirm I am the parent or legal guardian of this child and
          I authorise this emergency profile. I understand that my own
          identity will be verified separately before this profile is
          activated.
        </span>
      </label>
    </Section>
  );
}
