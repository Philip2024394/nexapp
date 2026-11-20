"use client";

// src/app/nex-native/manage/shop/setup/identity/_client.tsx
//
// Shop Setup · Step 1 · Identity client.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Captures the two identity fields:
//   · Shop name  → nex_business.display_name
//   · Logo URL   → nex_business.logo_url (upload via sealed
//                  uploadOnboardingLogo OR paste a URL)
//
// The chat name is shown as a non-editable reminder above the shop
// name field so the owner sees the intentional split ("chat as
// Philip · sell as Irish Pride").
// Save → autosave through saveShopIdentityAction · routes to step 2.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  WizardShell,
  FIELD_STYLE,
  PRIMARY_CTA_STYLE,
  LABEL_STYLE,
  HINT_STYLE,
  ERROR_STYLE,
  SURFACE_CARD_STYLE,
} from "../_wizard-shell";
import {
  saveShopIdentityAction,
  uploadShopIdentityLogoAction,
} from "../_actions";
import { NexInput } from "@/lib/nex-native/nex-keyboard";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";

export function IdentityStepClient({
  chatName,
  initialShopName,
  initialLogoUrl,
}: {
  chatName: string;
  initialShopName: string;
  initialLogoUrl: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [shopName, setShopName] = React.useState(initialShopName);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(initialLogoUrl);
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const trimmedName = shopName.trim();
  const nameError =
    trimmedName.length > 0 && (trimmedName.length < 2 || trimmedName.length > 40)
      ? "Shop name must be 2 to 40 characters."
      : null;
  const canSave =
    trimmedName.length >= 2 &&
    trimmedName.length <= 40 &&
    status.kind !== "saving";

  // Owner directive 2026-11-12 · live URL preview under the shop
  // name field. Client-side mirror of generateBusinessSlug in
  // business-service.ts (kept short + duplicated here so this
  // component doesn't need a server-import for a cosmetic preview).
  // The REAL slug is still generated server-side on save · this is
  // just a preview so the owner sees their public URL as they type.
  const slugPreview = React.useMemo(() => {
    const base = trimmedName
      .replace(/^@/, "")
      .replace(/^nex-/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return base.length > 0 ? base : "";
  }, [trimmedName]);
  const publicHost = React.useMemo(() => {
    if (typeof window === "undefined") return "nexapp.app";
    return window.location.host;
  }, []);
  const [copied, setCopied] = React.useState(false);
  async function copyPreviewUrl() {
    if (!slugPreview) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${slugPreview}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard denied · ignore silently */
    }
  }

  async function onFilePicked(file: File) {
    setUploading(true);
    setStatus({ kind: "idle" });
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadShopIdentityLogoAction(fd);
    setUploading(false);
    if (result.ok) {
      setLogoUrl(result.url);
    } else {
      setStatus({ kind: "error", message: `Logo upload: ${errorCopy(result.error)}` });
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;
    setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("displayName", trimmedName);
    if (logoUrl) fd.set("logoUrl", logoUrl);
    const result = await saveShopIdentityAction(fd);
    if (result.ok) {
      router.push(result.nextHref);
    } else {
      setStatus({ kind: "error", message: errorCopy(result.error) });
    }
  }

  return (
    <WizardShell
      stepNumber={1}
      stepTitle="Name your shop"
      stepLead="This is the brand customers see. It can be the same as your chat name, or completely different — your call."
      backHref="/nex-native/manage/shop/start"
      skipHref={undefined}
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {/* Identity reminder · shows the chat name so the owner sees
            the intentional split before they type. */}
        <div style={SURFACE_CARD_STYLE}>
          <span style={LABEL_STYLE}>You chat as</span>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: CREAM,
              letterSpacing: "-0.005em",
            }}
          >
            {chatName}
          </div>
          <span style={HINT_STYLE}>
            Your chat name stays yours. The shop name below is a separate
            brand badge that lives on your shop surface + next to your
            name in chat (⚡ Shop badge).
          </span>
        </div>

        {/* Shop name input. */}
        <div>
          <label htmlFor="shop-name" style={LABEL_STYLE}>
            Shop name
          </label>
          <NexInput
            id="shop-name"
            name="displayName"
            type="text"
            autoFocus
            maxLength={40}
            placeholder="e.g. Irish Pride · The Little Bakery · Grafton Studio"
            value={shopName}
            onChange={(next) => setShopName(next)}
            style={{
              ...FIELD_STYLE,
              borderColor: nameError
                ? "#FF6B6B"
                : "rgba(198, 161, 91, 0.55)",
            }}
          />
          {nameError ? (
            <span style={ERROR_STYLE}>{nameError}</span>
          ) : (
            <span style={HINT_STYLE}>
              {trimmedName.length} / 40 characters · you can rename later.
            </span>
          )}

          {/* Owner directive 2026-11-12 · live URL preview under the
              shop name. Auto-updates as the owner types · shows the
              full public share URL + a one-tap copy button. Appears
              only once the name is at least 2 chars so it doesn't
              flash in on first keystroke. */}
          {slugPreview && trimmedName.length >= 2 ? (
            <div
              data-nex-shop-url-preview
              style={{
                marginTop: 10,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: "rgba(198, 161, 91, 0.08)",
                border: "1px solid rgba(198, 161, 91, 0.45)",
                borderRadius: 10,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: GOLD,
                    marginBottom: 3,
                  }}
                >
                  Your share link
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: CREAM,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  }}
                >
                  {publicHost}/<span style={{ color: GOLD }}>{slugPreview}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={copyPreviewUrl}
                aria-label="Copy share link"
                style={{
                  flexShrink: 0,
                  padding: "6px 12px",
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: copied ? "#1A120A" : GOLD,
                  background: copied ? "#FFD600" : "transparent",
                  border: `1px solid ${copied ? "#E6B800" : GOLD}`,
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          ) : null}
        </div>

        {/* Logo picker · optional. */}
        <div>
          <span style={LABEL_STYLE}>Shop logo</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px",
              background: "rgba(5, 15, 28, 0.9)",
              border: "1px solid rgba(198, 161, 91, 0.35)",
              borderRadius: 10,
            }}
          >
            <div
              aria-hidden
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundImage: logoUrl ? `url(${logoUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                background: logoUrl
                  ? undefined
                  : "linear-gradient(135deg, rgba(198,161,91,0.25), rgba(198,161,91,0.08))",
                border: "1px solid rgba(198, 161, 91, 0.55)",
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                fontSize: 22,
              }}
            >
              {logoUrl ? "" : "🖼"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  padding: "8px 14px",
                  fontSize: 11.5,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: GOLD,
                  background: "transparent",
                  border: `1px solid ${GOLD}`,
                  borderRadius: 999,
                  cursor: uploading ? "wait" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {uploading
                  ? "Uploading…"
                  : logoUrl
                    ? "Change logo"
                    : "Upload logo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) void onFilePicked(f);
                  e.currentTarget.value = "";
                }}
              />
              {logoUrl ? (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  style={{
                    marginLeft: 8,
                    padding: "6px 10px",
                    fontSize: 10.5,
                    color: INK_MUTED,
                    background: "transparent",
                    border: "1px solid rgba(198, 161, 91, 0.25)",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Remove
                </button>
              ) : null}
              <div style={{ ...HINT_STYLE, marginTop: 6 }}>
                PNG · JPG · WebP · up to 8 MB · optional.
              </div>
            </div>
          </div>
        </div>

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
          disabled={!canSave}
          style={{
            ...PRIMARY_CTA_STYLE,
            opacity: canSave ? 1 : 0.5,
            cursor: canSave ? "pointer" : "not-allowed",
            marginTop: 4,
          }}
        >
          {status.kind === "saving" ? "Saving…" : "Save & continue →"}
        </button>
        <span
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 10.5,
            color: INK_DIM,
          }}
        >
          Saved to your shop · you can edit any field later.
        </span>
      </form>
    </WizardShell>
  );
}

// Lane C · prompt-7 round 18 · 2026-11-19 · safe-error mapper.
// Mirrors `errorCopy` in ../business-details/_client.tsx so the legacy
// 8-step identity surface never leaks raw server/driver strings. Known
// wire codes map to specific copy; unknown codes log the raw code
// (diagnostic breadcrumb) and show a stable generic banner.
function errorCopy(code: string): string {
  switch (code) {
    case "shop-name-length":
      return "Shop name must be 2 to 40 characters.";
    case "not-authenticated":
      return "You've been signed out · please sign in again.";
    case "owner-mismatch":
    case "owner-scope-denied":
      return "You can only edit a shop you own · please sign in again.";
    default:
      if (code && typeof code === "string") {
        console.warn("[nex] shop-setup · unmapped server error code", code);
      }
      return "We couldn't save that just now · please try again in a moment.";
  }
}
