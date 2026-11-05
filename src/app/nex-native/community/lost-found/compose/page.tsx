// src/app/nex-native/community/lost-found/compose/page.tsx
//
// Create a Lost or Found card. Phase 2A: text + metadata only.
// Photo upload is a follow-up step after card creation (future).

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import {
  NEX_COMMUNITY_LOST_FOUND_SUBJECTS,
  NEX_COMMUNITY_LOST_FOUND_SUBJECT_LABEL,
} from "@/lib/nex-native/community/types";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
import { NexPageHeader } from "../../../_page-header";
import { createLostFoundAction } from "../_actions";
import { NEX } from "../../_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function LostFoundComposePage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const membership = await getMembershipForAccount(session.account.id);
  if (!membership) redirect("/nex-native/community/select");

  const [sp, zone] = await Promise.all([
    searchParams,
    getZoneById(membership.hyperlocal_zone_id),
  ]);
  const banner =
    sp.e === "rate_limited"
      ? { tone: "err" as const, msg: "Rate limit reached — try again later." }
      : sp.e
        ? { tone: "err" as const, msg: "Please fix the highlighted field." }
        : null;

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <NexPageHeader dataScope="lost-found-compose" />

          <header style={{ margin: "24px 0 16px" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              Post a Lost or Found card
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: NEX.textMuted }}>
              Community <strong style={{ color: NEX.cyan }}>({zone?.name ?? "your area"})</strong>
            </p>
          </header>

          {banner && (
            <div
              role="status"
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                marginBottom: 14,
                background: "rgba(255,77,94,0.1)",
                border: `1px solid ${NEX.danger}44`,
                color: NEX.danger,
                fontSize: 13,
              }}
            >
              {banner.msg}
            </div>
          )}

          <form
            action={createLostFoundAction}
            encType="multipart/form-data"
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <Field label="Lost or Found" required>
              <div style={{ display: "flex", gap: 10 }}>
                <label style={radioStyle}>
                  <input type="radio" name="lost_or_found" value="lost" defaultChecked required style={{ accentColor: NEX.accent }} />
                  Lost
                </label>
                <label style={radioStyle}>
                  <input type="radio" name="lost_or_found" value="found" style={{ accentColor: NEX.cyan }} />
                  Found
                </label>
              </div>
            </Field>

            <Field label="What is it?" required>
              <select name="subject_kind" required defaultValue="pet" style={inputStyle()}>
                {NEX_COMMUNITY_LOST_FOUND_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {NEX_COMMUNITY_LOST_FOUND_SUBJECT_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Title" required help="Short, factual · no personal names">
              <input
                type="text"
                name="title"
                required
                maxLength={120}
                placeholder="e.g. Lost cat · black fur · white paws"
                style={inputStyle()}
              />
            </Field>

            <Field label="Details (optional)" help="Up to 2000 characters">
              <textarea
                name="body"
                rows={5}
                maxLength={2000}
                placeholder="Describe distinguishing features, approximate time, any helpful context."
                style={textareaStyle()}
              />
            </Field>

            <Field
              label="Approximate area (optional)"
              help="Street or block · no specific home address"
            >
              <input
                type="text"
                name="approximate_area_text"
                maxLength={200}
                placeholder="e.g. Jalan Malioboro near the market"
                style={inputStyle()}
              />
            </Field>

            <Field
              label="Photo (optional)"
              help="One image · max 2 MB · JPEG, PNG or WebP · GPS data is removed before upload"
            >
              <input
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                style={{
                  ...inputStyle(),
                  padding: "10px 14px",
                  color: NEX.textMuted,
                  cursor: "pointer",
                }}
              />
            </Field>

            <p style={{ fontSize: 11.5, color: NEX.textMuted, lineHeight: 1.6 }}>
              Lost & Found cards expire after 60 days. You can mark them resolved
              earlier. If you attach a photo, NEX strips GPS and camera metadata
              before publishing. Finders and owners can message privately through
              NEX — no phone numbers are shared automatically.
            </p>

            <button
              type="submit"
              style={{
                marginTop: 6,
                padding: "14px 20px",
                borderRadius: 999,
                background: NEX.accent,
                color: "#0a0608",
                fontSize: 15,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Post card
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

const radioStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 10,
  background: NEX.panelSolid,
  border: `1px solid ${NEX.borderSoft}`,
  color: NEX.textPrimary,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  flex: 1,
};

function Field({
  label,
  children,
  required,
  help,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  help?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: NEX.textMuted,
          fontWeight: 700,
        }}
      >
        {label}{required && <span style={{ color: NEX.accent, marginLeft: 4 }}>*</span>}
      </span>
      {children}
      {help && <span style={{ fontSize: 11.5, color: NEX.textSoft }}>{help}</span>}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    background: NEX.panelSolid,
    border: `1px solid ${NEX.borderSoft}`,
    color: NEX.textPrimary,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  };
}
function textareaStyle(): React.CSSProperties {
  return { ...inputStyle(), resize: "vertical", minHeight: 90 };
}
