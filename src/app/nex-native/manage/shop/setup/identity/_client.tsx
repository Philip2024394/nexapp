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
      setStatus({ kind: "error", message: `Logo upload: ${result.error}` });
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
      setStatus({ kind: "error", message: result.error });
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
          <input
            id="shop-name"
            name="displayName"
            type="text"
            autoFocus
            maxLength={40}
            placeholder="e.g. Irish Pride · The Little Bakery · Grafton Studio"
            value={shopName}
            onChange={(e) => setShopName(e.currentTarget.value)}
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
