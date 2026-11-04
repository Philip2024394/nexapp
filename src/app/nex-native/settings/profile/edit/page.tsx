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
import { NexPageHeader } from "../../../_page-header";
import { saveProfileFieldsAction } from "./_actions";
import { InterestsDualSelect } from "./_interests-dual-select";
import { AvatarPicker } from "./_avatar-picker";
import { AboutMeField } from "./_about-me-field";
import { AddressWithLocation } from "./_address-with-location";
import { ProfessionPicker } from "./_profession-picker";
import { ProfileEditFormClient } from "./_profile-edit-form-client";
import { UnlockCreatorBanner } from "./_unlock-creator-banner";
import {
  InstagramIcon,
  TikTokIcon,
  FacebookIcon,
  XIcon,
  YouTubeIcon,
} from "./_social-icons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<{ from?: string; e?: string; m?: string }>;
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
  const savedBanner = sp.m === "saved";

  // Load existing values · UPSERT shape (profile row may not exist).
  const account = await getAccountById(session.account.id);
  const { data: profileRow } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .select(
      "avatar_url, profession, country_code, address, interests, instagram_handle, tiktok_handle, facebook_handle, x_handle, youtube_handle",
    )
    .eq("account_id", session.account.id)
    .maybeSingle();

  type ProfileRow = {
    avatar_url: string | null;
    profession: string | null;
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
    avatar_url: null,
    profession: null,
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

  // about_me · migration 274 DRAFT (not yet applied). Separate query
  // wrapped in try/catch so a missing column doesn't crash the page.
  // When 274 is applied, this will start returning the saved value.
  let defaultAboutMe = "";
  try {
    const { data: aboutRow } = await nexSupabaseAdmin
      .from("nex_account_profile")
      .select("about_me")
      .eq("account_id", session.account.id)
      .maybeSingle();
    const am = (aboutRow as { about_me: string | null } | null)?.about_me;
    if (typeof am === "string") defaultAboutMe = am;
  } catch {
    /* column missing until migration 274 applied · leave empty */
  }

  const displayInitial = account?.display_name?.trim()?.[0] ?? "N";
  const nexHandle = account?.nex_handle ?? null;

  // Country list · Ireland first for the Ireland product.
  const countries = [...COUNTRY_DIAL_CODES].sort((a, b) => {
    if (a.iso2 === "IE") return -1;
    if (b.iso2 === "IE") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <style>{`
        main[data-nex-profile-edit],
        main[data-nex-profile-edit] * { box-sizing: border-box; }
        main[data-nex-profile-edit] input,
        main[data-nex-profile-edit] select,
        main[data-nex-profile-edit] textarea {
          background: rgba(10,31,21,0.65) !important;
          color: ${IRELAND.textPrimary} !important;
          border: 1px solid ${IRELAND.borderSoft} !important;
          padding: 11px 13px !important;
          border-radius: 10px !important;
          font-size: 15px !important;
          font-family: inherit !important;
          outline: none !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        main[data-nex-profile-edit] textarea {
          resize: vertical;
          min-height: 44px;
          line-height: 1.45;
        }
        main[data-nex-profile-edit] input::placeholder,
        main[data-nex-profile-edit] textarea::placeholder { color: ${IRELAND.textMuted} !important; }

        /* Owner directive 2026-11-04 · required-field error state ·
           orange glow + pulse + red "Must be completed" line. The
           client wrapper (_profile-edit-form-client.tsx) toggles the
           data-nex-field-error attribute on each failing label. */
        label[data-nex-field-wrapper] [data-nex-field-error-msg] {
          display: none;
          color: #FF4D5E;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          margin-top: 2px;
        }
        label[data-nex-field-error="true"] [data-nex-field-error-msg] {
          display: block;
        }
        label[data-nex-field-error="true"] input:not([type="hidden"]),
        label[data-nex-field-error="true"] select,
        label[data-nex-field-error="true"] textarea {
          border-color: #FF7200 !important;
          box-shadow:
            0 0 0 3px rgba(255, 114, 0, 0.3),
            0 0 14px rgba(255, 114, 0, 0.35) !important;
          animation: nex-field-error-pulse 1200ms ease-out 2;
        }
        @keyframes nex-field-error-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 3px rgba(255, 114, 0, 0.3),
              0 0 14px rgba(255, 114, 0, 0.35);
          }
          50% {
            box-shadow:
              0 0 0 5px rgba(255, 114, 0, 0.5),
              0 0 22px rgba(255, 114, 0, 0.6);
          }
        }
      `}</style>
      <main
        data-nex-profile-edit
        style={{
          minHeight: "100dvh",
          background: IRELAND.drawerBg,
          color: IRELAND.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 60px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <NexPageHeader
            dataScope="profile-edit"
            hideSearch
            brandSlot={
              nexHandle ? (
                <span
                  data-nex-profile-edit-id
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: IRELAND.secondary,
                    letterSpacing: "-0.01em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                  aria-label={`Your NEX ID is ${nexHandle}`}
                >
                  {nexHandle.charAt(0).toUpperCase() + nexHandle.slice(1)}
                </span>
              ) : null
            }
          />

          <AvatarPicker currentUrl={p.avatar_url} displayInitial={displayInitial} />

          <header style={{ textAlign: "center", margin: "16px 0 20px" }}>
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

          {/* Owner directive 2026-11-04 · post-save confirmation. The
              edit page is the natural place to show "linked" because
              the user just completed the save action here. Copy makes
              clear WHERE the data now appears, not just that it was
              written to the DB. */}
          {savedBanner ? (
            <section
              role="status"
              data-nex-profile-saved-banner
              style={{
                margin: "0 0 18px",
                padding: "14px 16px",
                borderRadius: 12,
                background: `linear-gradient(135deg, ${IRELAND.success}14, ${IRELAND.secondary}18)`,
                border: `1px solid ${IRELAND.success}66`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: IRELAND.success,
                  color: IRELAND.drawerBg,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                ✓
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: IRELAND.textPrimary }}>
                  Profile saved · linked to your NEX account
                </span>
                <span style={{ fontSize: 11, color: IRELAND.primaryInk, opacity: 0.85, lineHeight: 1.45 }}>
                  Your new details are live across Chat, Contacts, Community, Live, Music and your public profile.
                </span>
              </span>
            </section>
          ) : null}

          <ProfileEditFormClient action={saveProfileFieldsAction} fromSignup={fromSignup}>

            {/* Chat name */}
            <Field label="Chat name" sub="This is the name people see in chat." fieldName="chat_name">
              <input
                type="text"
                name="chat_name"
                defaultValue={account?.display_name ?? ""}
                minLength={1}
                maxLength={60}
                placeholder="e.g. Padraig Murphy"
              />
            </Field>

            {/* Profession · cascading category → subcategory + Other · owner directive 2026-11-04 */}
            <Field label="Profession" sub="Pick a category then a profession." fieldName="profession">
              <ProfessionPicker defaultValue={p.profession ?? ""} />
            </Field>

            {/* Country */}
            <Field
              label="Country of residence"
              sub="Where you live today · Ireland + diaspora welcome."
              fieldName="country_code"
            >
              <select name="country_code" defaultValue={defaultCountry}>
                <option value="" style={{ color: "#000" }}>
                  Select a country
                </option>
                {countries.map((c) => (
                  <option key={c.iso2} value={c.iso2} style={{ color: "#000" }}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </Field>

            {/* Phone · prefix + number */}
            <Field label="Phone number" sub="Country prefix is for calls · the number stays private." fieldName="phone_national_number">
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

            {/* Address · multi-line + "Set my location" quick-fill ·
                owner directive 2026-11-04 · orange button → green with tick when set */}
            <Field label="Address" sub="Tap Set my location or type it yourself." fieldName="address">
              <AddressWithLocation defaultValue={p.address ?? ""} />
            </Field>

            {/* About me · 500-char hard cap · 7-line soft advisory · owner directive 2026-11-04 */}
            <Field label="About me" sub="Up to 7 lines · 500 characters max." fieldName="about_me">
              <AboutMeField defaultValue={defaultAboutMe} />
            </Field>

            {/* Interests · pick 2 · dual-slot dropdown picker · owner directive 2026-11-04 */}
            <Field label="Pick 2 main interests" sub="These show on your profile card." fieldName="interests">
              <InterestsDualSelect defaultValues={Array.from(defaultInterests)} />
            </Field>

            {/* Social links · bare handles · plain SVG icons · owner directive 2026-11-04 */}
            <SocialRow Icon={InstagramIcon} label="Instagram" name="instagram_handle" defaultValue={p.instagram_handle} placeholder="your-handle" />
            <SocialRow Icon={TikTokIcon}    label="TikTok"    name="tiktok_handle"    defaultValue={p.tiktok_handle}    placeholder="your-handle" />
            <SocialRow Icon={FacebookIcon}  label="Facebook"  name="facebook_handle"  defaultValue={p.facebook_handle}  placeholder="your-handle" />
            <SocialRow Icon={XIcon}         label="X"         name="x_handle"         defaultValue={p.x_handle}         placeholder="your-handle" />
            <SocialRow Icon={YouTubeIcon}   label="YouTube"   name="youtube_handle"   defaultValue={p.youtube_handle}   placeholder="your-channel" />

            {/* Phase U · Unlock Creator tools inline card · dismissable · routes
                to /creator/join · zero payment calls (owner directive 2026-11-04) */}
            <UnlockCreatorBanner />

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
          </ProfileEditFormClient>
        </div>
      </main>
    </>
  );
}

// ─── Field wrapper ──────────────────────────────────────────────
// When `fieldName` is set, the wrapper advertises itself to the
// client-side validator (`_profile-edit-form-client.tsx`). On a
// failed submit, the client sets `data-nex-field-error="true"` on
// the <label>, which the error CSS block in <style> picks up to
// glow the field orange + reveal the "Must be completed" line.
function Field({
  label,
  sub,
  fieldName,
  children,
}: {
  readonly label: string;
  readonly sub?: string;
  readonly fieldName?: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <label
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
      data-nex-field-wrapper={fieldName ?? undefined}
    >
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
      {fieldName ? (
        <span data-nex-field-error-msg>Must be completed</span>
      ) : null}
    </label>
  );
}

// ─── Social row · same shape for each platform · owner directive
// 2026-11-04 · plain high-quality inline SVG icon (no raster image,
// no bg panel) · icon inherits the gold accent via currentColor.
function SocialRow({
  Icon,
  label,
  name,
  defaultValue,
  placeholder,
}: {
  readonly Icon: (props: { readonly size?: number }) => React.ReactElement;
  readonly label: string;
  readonly name: string;
  readonly defaultValue: string | null;
  readonly placeholder: string;
}): React.ReactElement {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          display: "grid",
          placeItems: "center",
          color: IRELAND.secondary,
          flexShrink: 0,
        }}
      >
        <Icon size={24} />
      </span>
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
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


