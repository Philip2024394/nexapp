"use client";

// src/app/nex-native/manage/shop/setup/contact/_client.tsx
//
// Shop Setup · Step 7 · Contact + socials client.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Six optional fields · instagram · facebook · tiktok · website · phone
// · email · all persisted via the sealed updateBusinessProfile which
// handles the strip-leading-@ normalisation + pattern validation. The
// About Us overlay footer already reads these columns (prior wire
// batch) so saved values light up the social buttons immediately.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  WizardShell,
  FIELD_STYLE,
  PRIMARY_CTA_STYLE,
  LABEL_STYLE,
  HINT_STYLE,
} from "../_wizard-shell";
import { saveShopContactAction } from "../_actions";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";

interface ContactInitial {
  instagramHandle: string;
  facebookHandle: string;
  tiktokHandle: string;
  websiteUrl: string;
  publicPhone: string;
  publicEmail: string;
}

interface SocialField {
  name: keyof ContactInitial;
  label: string;
  prefix: string;
  placeholder: string;
  hint: string;
  type?: "text" | "url" | "email" | "tel";
}

const FIELDS: ReadonlyArray<SocialField> = [
  {
    name: "instagramHandle",
    label: "Instagram",
    prefix: "@",
    placeholder: "irishpride.shop",
    hint: "Just the handle · no @ or URL.",
  },
  {
    name: "facebookHandle",
    label: "Facebook",
    prefix: "fb.com/",
    placeholder: "irishpride.shop",
    hint: "The page name, not the full URL.",
  },
  {
    name: "tiktokHandle",
    label: "TikTok",
    prefix: "@",
    placeholder: "irishpride",
    hint: "Just the handle.",
  },
  {
    name: "publicPhone",
    label: "WhatsApp / phone",
    prefix: "+",
    placeholder: "353 1 234 5678",
    hint: "Include the country code so WhatsApp links work.",
    type: "tel",
  },
  {
    name: "websiteUrl",
    label: "Website",
    prefix: "https://",
    placeholder: "www.irishpride.ie",
    hint: "Optional · leave blank if you only sell through NEX.",
    type: "url",
  },
  {
    name: "publicEmail",
    label: "Email",
    prefix: "✉",
    placeholder: "hello@irishpride.ie",
    hint: "For enquiries that need a reply by email.",
    type: "email",
  },
];

export function ContactStepClient({
  initial,
}: {
  initial: ContactInitial;
}): React.JSX.Element {
  const router = useRouter();
  const [values, setValues] = React.useState<ContactInitial>(initial);
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  function set(name: keyof ContactInitial, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "saving") return;
    setStatus({ kind: "saving" });
    const fd = new FormData();
    for (const field of FIELDS) {
      fd.set(field.name, values[field.name].trim());
    }
    const result = await saveShopContactAction(fd);
    if (result.ok) {
      router.push(result.nextHref);
    } else {
      setStatus({ kind: "error", message: result.error });
    }
  }

  async function onSkip() {
    router.push("/nex-native/manage/shop/setup/finish");
  }

  return (
    <WizardShell
      stepNumber={7}
      stepTitle="Where buyers can reach you"
      stepLead="All optional. Whatever you add lights up as a solid gold button on your About Us footer."
      backHref="/nex-native/manage/shop/setup/policies"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {FIELDS.map((field) => (
          <div key={field.name}>
            <label htmlFor={`shop-${field.name}`} style={LABEL_STYLE}>
              {field.label}
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid rgba(198, 161, 91, 0.55)",
                background: "rgba(5, 15, 28, 0.9)",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "grid",
                  placeItems: "center",
                  padding: "0 10px",
                  fontSize: 12,
                  fontWeight: 900,
                  color: GOLD,
                  background: "rgba(198, 161, 91, 0.12)",
                  minWidth: 50,
                  letterSpacing: "0.02em",
                }}
              >
                {field.prefix}
              </span>
              <input
                id={`shop-${field.name}`}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                value={values[field.name]}
                onChange={(e) => set(field.name, e.currentTarget.value)}
                style={{
                  ...FIELD_STYLE,
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  padding: "12px 12px",
                  borderRadius: 0,
                }}
              />
            </div>
            <span style={HINT_STYLE}>{field.hint}</span>
          </div>
        ))}

        {status.kind === "error" ? (
          <div
            style={{
              padding: 10,
              fontSize: 12,
              color: "#FF6B6B",
              background: "rgba(216, 42, 42, 0.08)",
              border: "1px solid rgba(216, 42, 42, 0.35)",
              borderRadius: 10,
            }}
          >
            {status.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={status.kind === "saving"}
          style={{
            ...PRIMARY_CTA_STYLE,
            opacity: status.kind === "saving" ? 0.6 : 1,
            cursor: status.kind === "saving" ? "wait" : "pointer",
          }}
        >
          {status.kind === "saving" ? "Saving…" : "Save & continue →"}
        </button>

        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            marginTop: 2,
            fontSize: 11,
            fontWeight: 700,
            color: INK_MUTED,
            textDecoration: "underline",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Skip, I&rsquo;ll add these later
        </button>
        <span
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 10,
            color: INK_DIM,
            marginTop: 2,
          }}
        >
          {INK.length > 0 ? "" : null}Handles are stored without the @.
          WhatsApp link uses the phone when present.
        </span>
      </form>
    </WizardShell>
  );
}
