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
  xHandle: string;
  websiteUrl: string;
  publicPhone: string;
  publicEmail: string;
}

type SocialKey =
  | "instagramHandle"
  | "facebookHandle"
  | "tiktokHandle"
  | "xHandle";

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
    // Owner directive 2026-11-12 · X added to the shop social set to
    // match the Chat profile (migration 339 added x_handle to
    // nex_account_profile). Shop column is x_handle on nex_business.
    name: "xHandle",
    label: "X",
    prefix: "@",
    placeholder: "irishpride",
    hint: "Just the handle.",
  },
  {
    name: "publicPhone",
    label: "Contact number",
    prefix: "+",
    placeholder: "353 1 234 5678",
    hint: "Include the country code.",
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
  copiedFromProfile,
  profileYoutubeHandle,
}: {
  initial: ContactInitial;
  // Owner directive 2026-11-12 · per-field flag indicating whether the
  // value shown was copied from the Chat profile (shop field was empty)
  // vs. already set on the shop. Used to paint a small "from your
  // profile" badge so the seller knows the source · the badge clears
  // the moment the seller types a new value.
  copiedFromProfile?: Readonly<Record<SocialKey, boolean>>;
  // YouTube is on the Chat profile but not yet a shop column · we
  // show a passive "Also on YouTube · not yet on NEX shops" note if
  // the chat profile has one so the seller knows we see it.
  profileYoutubeHandle?: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [values, setValues] = React.useState<ContactInitial>(initial);
  // Local "dirty" tracking · once the seller types into a pre-filled
  // field the badge clears so they know their edit is now persisted.
  const [touched, setTouched] = React.useState<Set<string>>(new Set());
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  function set(name: keyof ContactInitial, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
    setTouched((t) => {
      if (t.has(name)) return t;
      const next = new Set(t);
      next.add(name);
      return next;
    });
  }

  function showCopiedBadge(name: keyof ContactInitial): boolean {
    if (touched.has(name)) return false;
    if (!copiedFromProfile) return false;
    // Only the 4 social keys carry the pre-fill signal; everything
    // else (phone, email, website) is shop-specific and never
    // pre-filled from the profile.
    if (
      name !== "instagramHandle" &&
      name !== "facebookHandle" &&
      name !== "tiktokHandle" &&
      name !== "xHandle"
    ) {
      return false;
    }
    return copiedFromProfile[name] === true;
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
        {FIELDS.map((field) => {
          const copied = showCopiedBadge(field.name);
          return (
            <div key={field.name}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <label htmlFor={`shop-${field.name}`} style={LABEL_STYLE}>
                  {field.label}
                </label>
                {copied ? (
                  <span
                    data-nex-contact-copied-from-profile
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#1A120A",
                      background: "#FFD600",
                      border: "1px solid #E6B800",
                      borderRadius: 999,
                      padding: "2px 8px",
                      marginBottom: 6,
                    }}
                  >
                    From your profile
                  </span>
                ) : null}
              </div>
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
              <span style={HINT_STYLE}>
                {field.hint}
                {copied
                  ? " · copied from your profile · edit to make it shop-specific."
                  : ""}
              </span>
            </div>
          );
        })}

        {/* YouTube passive note · shown when the chat profile has a
            handle but the shop schema doesn't yet support one. */}
        {profileYoutubeHandle ? (
          <div
            data-nex-contact-youtube-note
            style={{
              padding: "8px 10px",
              fontSize: 10.5,
              color: INK_MUTED,
              background: "rgba(5, 15, 28, 0.6)",
              border: "1px dashed rgba(198, 161, 91, 0.3)",
              borderRadius: 8,
              lineHeight: 1.5,
            }}
          >
            Your profile also has <strong>YouTube · @{profileYoutubeHandle}</strong>.
            NEX shops don&rsquo;t surface YouTube yet · we&rsquo;ll light it up when
            the shop schema catches up.
          </div>
        ) : null}

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
          Handles are stored without the @.
        </span>
      </form>
    </WizardShell>
  );
}
