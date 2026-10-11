// src/app/nex-native/community/compose/page.tsx
//
// Create a new Community Noticeboard notice. Phase 1 category whitelist only.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import {
  NEX_COMMUNITY_NOTICE_CATEGORIES,
  NEX_COMMUNITY_NOTICE_CATEGORY_LABEL,
} from "@/lib/nex-native/community/types";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
import { NexPageHeader } from "../../_page-header";
import { createNoticeAction } from "../_actions";
import { NEX } from "../_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function ComposePage({ searchParams }: PageProps) {
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
      ? { tone: "err" as const, msg: sp.m ?? "Rate limit reached — try again later." }
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
          <NexPageHeader dataScope="community-compose" />

          <header style={{ margin: "24px 0 16px" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              Share a notice
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: NEX.textMuted }}>
              Posting to <strong style={{ color: NEX.cyan }}>{zone?.name ?? "your area"}</strong>
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
            action={createNoticeAction}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <Field label="Category" required>
              <select
                name="category"
                required
                defaultValue="power_outage"
                style={selectStyle()}
              >
                {NEX_COMMUNITY_NOTICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {NEX_COMMUNITY_NOTICE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Urgency" required help="Mark 'urgent' only for genuine hazards">
              <select
                name="urgency_level"
                required
                defaultValue="moderate"
                style={selectStyle()}
              >
                <option value="low">Low — informational</option>
                <option value="moderate">Moderate — standard outage/hazard</option>
                <option value="urgent">Urgent — immediate attention</option>
              </select>
            </Field>

            <Field label="Title" required help="Short, factual, no names of people">
              <input
                type="text"
                name="title"
                required
                maxLength={120}
                placeholder="e.g. Power out across RW 05 since 14:00"
                style={inputStyle()}
              />
            </Field>

            <Field label="Details (optional)" help="Up to 2000 characters">
              <textarea
                name="body"
                rows={5}
                maxLength={2000}
                placeholder="Add context — approximate scale, timing, any confirmed updates."
                style={textareaStyle()}
              />
            </Field>

            <Field
              label="Affected area (optional)"
              help="Street or block only — never a specific home address"
            >
              <input
                type="text"
                name="affected_area_text"
                maxLength={200}
                placeholder="e.g. Jalan Malioboro, Blok C"
                style={inputStyle()}
              />
            </Field>

            <p style={{ fontSize: 11.5, color: NEX.textMuted, lineHeight: 1.6 }}>
              Phase 1 of Community Noticeboard supports utility outages, road hazards
              and weather warnings only. Do not post photos, personal names, or
              accusations about individuals. Reports are moderated. For
              emergencies in Indonesia dial 112 — do not rely on this feed.
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
              Post notice
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

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

function selectStyle(): React.CSSProperties {
  return { ...inputStyle(), appearance: "none" };
}
