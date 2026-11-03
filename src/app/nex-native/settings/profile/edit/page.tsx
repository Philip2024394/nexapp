// src/app/nex-native/settings/profile/edit/page.tsx
//
// NEX Ireland · profile edit (also post-signup first-fill).
// Owner-authorised 2026-11-04 ("C" path).
// --------------------------------------------------------
// Fields (sealed order):
//   1. Chat name (nex_account.display_name)
//   2. Country of residence (ISO2 dropdown · default IE)
//   3. Phone (country prefix dropdown + national number · reuses the
//      sealed phone shape)
//   4. Address (optional · diaspora-friendly)
//   5. Pick-2 interests (24-option grid · IE culture + universal)
//   6. Instagram · TikTok · Facebook · X · YouTube (bare handles)
//
// Audience framing (owner-sealed 2026-11-04):
//   "From Wexford to Boston to Sydney · tell us about you."
//   NEX Ireland is for Irish residents + diaspora + anyone connected
//   to Ireland. The country field defaults to IE but accepts any
//   ISO2 the user picks.
//
// Flow:
//   · signup → bubble-customize save → ?from=signup lands here
//   · drawer "Profile" → /profile/me → "Edit profile" CTA lands here
//   · save → ?from=signup redirects to /free-chat (new user into app)
//            otherwise redirects to /profile/me (edit flow returns)

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { getAccountById } from "@/lib/nex-native/account-service";
import { COUNTRY_DIAL_CODES } from "@/lib/countryDialCodes";
import { NEX_INTERESTS } from "@/lib/nex-native/profile/interests-registry";
import { NexPageHeader } from "../../../_page-header";
import { saveProfileFieldsAction } from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<{ from?: string; e?: string }>;
}

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  danger: "#FF4D5E",
  success: "#16D66B",
};

export default async function ProfileEditPage({ searchParams }: PageProps) {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const fromSignup = sp.from === "signup";
  const errCode = sp.e;

  // Load existing values · UPSERT shape (profile row may not exist).
  const account = await getAccountById(session.account.id);
  const { data: profileRow } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .select(
      "country_code, address, interests, instagram_handle, tiktok_handle, facebook_handle, x_handle, youtube_handle",
    )
    .eq("account_id", session.account.id)
    .maybeSingle();

  type ProfileRow = {
    country_code: string | null;
    address: string | null;
    interests: string[] | null;
    instagram_handle: string | null;
    tiktok_handle: string | null;
    facebook_handle: string | null;
    x_handle: string | null;
    youtube_handle: string | null;
  };
  const p = (profileRow as ProfileRow | null) ?? {
    country_code: null,
    address: null,
    interests: [],
    instagram_handle: null,
    tiktok_handle: null,
    facebook_handle: null,
    x_handle: null,
    youtube_handle: null,
  };
  const defaultCountry = p.country_code ?? "IE";
  const defaultInterests = new Set(p.interests ?? []);

  // Country list · Ireland first for the Ireland product.
  const countries = [...COUNTRY_DIAL_CODES].sort((a, b) => {
    if (a.iso2 === "IE") return -1;
    if (b.iso2 === "IE") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <style>{`
        @media (max-width: 499.98px) {
          main[data-nex-profile-edit] { background: ${IRELAND.drawerBg} !important; }
        }
        main[data-nex-profile-edit] input,
        main[data-nex-profile-edit] select {
          background: rgba(10,31,21,0.65) !important;
          color: ${IRELAND.textPrimary} !important;
          border: 1px solid ${IRELAND.borderSoft} !important;
          padding: 11px 13px !important;
          border-radius: 10px !important;
          font-size: 15px !important;
          font-family: inherit !important;
          outline: none !important;
          width: 100% !important;
        }
        main[data-nex-profile-edit] input::placeholder { color: ${IRELAND.textMuted} !important; }
      `}</style>
      <main
        data-nex-profile-edit
        style={{
          minHeight: "100dvh",
          color: IRELAND.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 60px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <NexPageHeader dataScope="profile-edit" />

          <header style={{ textAlign: "center", margin: "28px 0 20px" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em" }}>
              {fromSignup ? "One more step" : "Edit your profile"}
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 440,
                fontSize: 13,
                color: IRELAND.primaryInk,
                lineHeight: 1.55,
                opacity: 0.9,
              }}
            >
              From Wexford to Boston to Sydney · tell us about you so
              your community can find you.
            </p>
          </header>

          {errCode ? (
            <p
              role="alert"
              style={{
                margin: "0 0 16px",
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(255,77,94,0.14)",
                border: `1px solid ${IRELAND.danger}66`,
                color: "#FDA4AF",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              Save failed · {errCode.replace(/_/g, " ")}
            </p>
          ) : null}

          <form action={saveProfileFieldsAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {fromSignup ? <input type="hidden" name="from" value="signup" /> : null}

            {/* Chat name */}
            <Field label="Chat name" sub="This is the name people see in chat.">
              <input
                type="text"
                name="chat_name"
                defaultValue={account?.display_name ?? ""}
                required
                minLength={1}
                maxLength={60}
                placeholder="e.g. Padraig Murphy"
              />
            </Field>

            {/* Country */}
            <Field
              label="Country of residence"
              sub="Where you live today · Ireland + diaspora welcome."
            >
              <select name="country_code" defaultValue={defaultCountry}>
                {countries.map((c) => (
                  <option key={c.iso2} value={c.iso2} style={{ color: "#000" }}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </Field>

            {/* Phone · prefix + number */}
            <Field label="Phone number" sub="Country prefix is for calls · the number stays private.">
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  name="phone_country_code"
                  defaultValue={account?.phone_country_code ?? "+353"}
                  style={{ flex: "0 0 128px" } as React.CSSProperties}
                >
                  {countries.map((c) => (
                    <option key={c.iso2 + c.dial} value={c.dial} style={{ color: "#000" }}>
                      {c.flag} {c.dial}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  name="phone_national_number"
                  defaultValue={account?.phone_national_number ?? ""}
                  inputMode="numeric"
                  pattern="[0-9]{5,15}"
                  maxLength={15}
                  placeholder="e.g. 87 1234567"
                  style={{ flex: 1 } as React.CSSProperties}
                />
              </div>
            </Field>

            {/* Address · optional */}
            <Field label="Address" sub="Optional · leave blank if you'd rather not share it.">
              <input
                type="text"
                name="address"
                defaultValue={p.address ?? ""}
                maxLength={200}
                placeholder="e.g. Lacken, New Ross, Co Wexford"
              />
            </Field>

            {/* Interests · pick 2 */}
            <Field label="Pick 2 main interests" sub="These show on your profile card.">
              <InterestsGrid defaultChecked={defaultInterests} />
            </Field>

            {/* Social links · bare handles */}
            <SocialRow icon="📷" label="Instagram" name="instagram_handle" defaultValue={p.instagram_handle} placeholder="your-handle" />
            <SocialRow icon="🎵" label="TikTok"    name="tiktok_handle"    defaultValue={p.tiktok_handle}    placeholder="your-handle" />
            <SocialRow icon="📘" label="Facebook"  name="facebook_handle"  defaultValue={p.facebook_handle}  placeholder="your-handle" />
            <SocialRow icon="𝕏"  label="X"         name="x_handle"         defaultValue={p.x_handle}         placeholder="your-handle" />
            <SocialRow icon="▶️" label="YouTube"   name="youtube_handle"   defaultValue={p.youtube_handle}   placeholder="your-channel" />

            <button
              type="submit"
              style={{
                marginTop: 10,
                padding: "15px 20px",
                borderRadius: 999,
                background: IRELAND.secondary,
                color: IRELAND.drawerBg,
                border: "none",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(10,31,21,0.35)",
              }}
            >
              {fromSignup ? "Save & enter NEX" : "Save profile"}
            </button>

            {!fromSignup ? (
              <p style={{ marginTop: 6, fontSize: 11, color: IRELAND.textMuted, textAlign: "center" }}>
                <Link
                  href="/nex-native/profile/me"
                  style={{ color: IRELAND.secondary, textDecoration: "none", fontWeight: 700 }}
                >
                  ← Back to profile
                </Link>
              </p>
            ) : null}
          </form>
        </div>
      </main>
    </>
  );
}

// ─── Field wrapper ──────────────────────────────────────────────
function Field({
  label,
  sub,
  children,
}: {
  readonly label: string;
  readonly sub?: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: IRELAND.secondary,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
      {sub ? (
        <span style={{ fontSize: 11, color: IRELAND.textMuted, lineHeight: 1.4 }}>
          {sub}
        </span>
      ) : null}
    </label>
  );
}

// ─── Social row · same shape for each platform ─────────────────
function SocialRow({
  icon,
  label,
  name,
  defaultValue,
  placeholder,
}: {
  readonly icon: string;
  readonly label: string;
  readonly name: string;
  readonly defaultValue: string | null;
  readonly placeholder: string;
}): React.ReactElement {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: IRELAND.panel,
          border: `1px solid ${IRELAND.borderSoft}`,
          display: "grid",
          placeItems: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: IRELAND.secondary, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
        <input
          type="text"
          name={name}
          defaultValue={defaultValue ?? ""}
          maxLength={50}
          placeholder={placeholder}
        />
      </span>
    </label>
  );
}

// ─── Interests grid · pick-2 ────────────────────────────────────
function InterestsGrid({
  defaultChecked,
}: {
  readonly defaultChecked: Set<string>;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
        gap: 8,
      }}
    >
      {NEX_INTERESTS.map((interest) => (
        <label
          key={interest.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 10px",
            borderRadius: 10,
            background: "rgba(10,31,21,0.55)",
            border: `1px solid ${IRELAND.borderSoft}`,
            fontSize: 13,
            fontWeight: 600,
            color: IRELAND.textPrimary,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            name="interests"
            value={interest.id}
            defaultChecked={defaultChecked.has(interest.id)}
            style={{
              width: 16,
              height: 16,
              margin: 0,
              accentColor: IRELAND.secondary as unknown as string,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 15 }} aria-hidden>
            {interest.emoji}
          </span>
          <span style={{ flex: 1 }}>{interest.label}</span>
        </label>
      ))}
    </div>
  );
}
