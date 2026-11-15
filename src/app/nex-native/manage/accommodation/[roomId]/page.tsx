// src/app/nex-native/manage/accommodation/[roomId]/page.tsx
//
// Phase A1 · Owner-only room editor.
// Owner-authorised 2026-10-21.
//
// Edit a single room. The caller is responsible for being the owner ·
// enforced server-side in updateRoomAction via `assertOwner` before
// any service call. RLS on nex_accommodation_unit is the DB-layer
// defence-in-depth.

import type * as React from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
// Stream B · 2026-11-16 · S7 · session-resolver unification.
// Seller-impersonable surface · the matching write action at
// ../_actions.ts uses resolveSessionWithDevOverride, so the PAGE must
// resolve the same way to avoid the 2026-11-12 upload-bounce-to-sign-in
// class of bug (owner-sealed: both PAGE and ACTION must use the same
// resolver on dev-impersonable seller surfaces).
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as businessService from "@/lib/nex-native/business-service";
import * as accommodationService from "@/lib/nex-native/accommodation-service";
import { updateRoomAction } from "../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ ok?: string; e?: string; m?: string }>;
}

export default async function EditRoomPage({
  params,
  searchParams,
}: PageProps) {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/accommodation");
  }

  const { roomId } = await params;
  const sp = await searchParams;

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  if (owned.length === 0) notFound();
  const business = owned[0]!;

  const room = await accommodationService.getRoomById(roomId);
  if (!room) notFound();
  if (room.business_id !== business.id) {
    // Owner-only · fail-closed · never leak that the room exists for
    // a different business.
    notFound();
  }

  const bg = "var(--nex-world-background-base, #020914)";
  const panel = "rgba(6, 15, 28, 0.72)";
  const border = "rgba(139, 169, 209, 0.14)";
  const cyan = "#00AFFF";
  const text = "#F4F7FC";
  const textDim = "#8BA9D1";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: bg,
        color: text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "20px 16px 60px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <nav style={{ marginBottom: 20 }}>
          <Link
            href="/nex-native/manage/accommodation"
            style={{ color: cyan, textDecoration: "none", fontSize: 13 }}
          >
            ← Your rooms
          </Link>
        </nav>

        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: cyan,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Edit room
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.012em",
            }}
          >
            {room.name}
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: textDim }}>
            Status: <strong style={{ color: text }}>{room.status}</strong>{" "}
            · Availability:{" "}
            <strong style={{ color: text }}>
              {room.is_available ? "available" : "paused"}
            </strong>
          </p>
        </header>

        {sp.ok === "1" && (
          <div
            data-nex-manage-accommodation-editor-banner="ok"
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              background: "rgba(22,214,107,0.10)",
              border: "1px solid rgba(22,214,107,0.35)",
              borderRadius: 10,
              color: "#16D66B",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Changes saved.
          </div>
        )}

        {sp.e && sp.m && (
          <div
            data-nex-manage-accommodation-editor-banner="error"
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              background: "rgba(255,77,94,0.10)",
              border: "1px solid rgba(255,77,94,0.35)",
              borderRadius: 10,
              color: "#FF4D5E",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {decodeURIComponent(sp.m)}
          </div>
        )}

        {/* Stream B · 2026-11-16 · S6 · owner-authorised stub replacement.
            The sealed 2026-11-10 "not wired" banner is removed · the
            server action at ../_actions.ts now persists to Supabase
            via the sealed accommodation-service.updateRoom helper. */}

        <form
          action={updateRoomAction.bind(null, business.id, room.id)}
          data-nex-manage-accommodation-editor-form={room.id}
          style={{
            padding: 20,
            background: panel,
            border: `1px solid ${border}`,
            borderRadius: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <Field label="Room name *" name="name" defaultValue={room.name} required maxLength={120} />
          <Field
            label="Description"
            name="description"
            defaultValue={room.description ?? ""}
            textarea
            maxLength={2000}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <Field label="Guests" name="capacity" type="number" defaultValue={String(room.capacity)} min={1} max={50} />
            <Field label="Bedrooms" name="bedrooms" type="number" defaultValue={String(room.bedrooms)} min={0} max={20} />
            <Field label="Bathrooms" name="bathrooms" type="number" defaultValue={String(room.bathrooms)} min={0} max={20} />
          </div>
          <Field
            label="Amenities (comma-separated)"
            name="amenities"
            defaultValue={room.amenities.join(", ")}
            maxLength={500}
          />
          <Field
            label="Price per night in pence (optional · display only · NEX never charges)"
            name="price_per_night_pence"
            type="number"
            defaultValue={room.price_per_night_pence !== null ? String(room.price_per_night_pence) : ""}
            min={0}
          />
          <Field
            label="Image URL (optional)"
            name="image_url"
            defaultValue={room.image_url ?? ""}
            maxLength={1024}
          />

          <button
            type="submit"
            data-nex-manage-accommodation-editor-save={room.id}
            style={{
              marginTop: 8,
              padding: "10px 18px",
              background: "#FF7200",
              color: "#1A0808",
              fontSize: 13,
              fontWeight: 700,
              border: "1px solid rgba(255,114,0,0.9)",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Save changes
          </button>
        </form>
      </div>
    </main>
  );
}

function Field(props: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  textarea?: boolean;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
}): React.ReactElement {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "rgba(6,15,28,0.9)",
    color: "#F4F7FC",
    fontSize: 13,
    border: "1px solid rgba(139,169,209,0.24)",
    borderRadius: 10,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          color: "#8BA9D1",
          marginBottom: 4,
          letterSpacing: "0.03em",
        }}
      >
        {props.label}
      </span>
      {props.textarea ? (
        <textarea
          name={props.name}
          defaultValue={props.defaultValue}
          required={props.required}
          maxLength={props.maxLength}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
        />
      ) : (
        <input
          name={props.name}
          type={props.type ?? "text"}
          defaultValue={props.defaultValue}
          required={props.required}
          maxLength={props.maxLength}
          min={props.min}
          max={props.max}
          style={inputStyle}
        />
      )}
    </label>
  );
}
