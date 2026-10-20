// src/app/nex-native/manage/accommodation/page.tsx
//
// Phase A1 · Owner-only accommodation management list.
// Owner-authorised 2026-10-21.
//
// Shows the authenticated owner's rooms for their first/only business.
// Reuses the sealed /manage/services page structure as closely as
// possible so visual + a11y conventions stay consistent across
// management surfaces.
//
// Scope boundary:
//   · Only accessible to the authenticated owner · redirects to
//     /sign-in when no session · redirects to /manage when the
//     owner has no business.
//   · Does NOT render accommodation listings to guests · that is
//     the customer-facing /[businessSlug]/page.tsx branch, which
//     this cycle wires separately.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as accommodationService from "@/lib/nex-native/accommodation-service";
import {
  createRoomAction,
  changeRoomStatusAction,
  toggleRoomAvailableAction,
} from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  amber: "#F5B544",
  danger: "#FF4D5E",
};

interface PageProps {
  searchParams: Promise<{
    ok?: string;
    e?: string;
    m?: string;
  }>;
}

export default async function ManageAccommodationPage({
  searchParams,
}: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=/nex-native/manage/accommodation");

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  if (owned.length === 0) {
    // Honest redirect · they need to create a business first.
    redirect("/nex-native/manage?e=no_business&m=Create%20your%20business%20first");
  }
  const business = owned[0]!; // first business for this account

  // Scope boundary: the sealed accommodation subtype check happens via
  // the business profile. If the business isn't accommodation-vertical,
  // this page is still reachable but will show the honest empty state.
  const subtype =
    (business.profile as { primary?: { subtype?: string } } | null)
      ?.primary?.subtype ?? null;
  const isAccommodationSubtype =
    subtype === "villa" ||
    subtype === "homestay" ||
    subtype === "kost";

  const rooms = await accommodationService
    .listRoomsByBusiness(business.id)
    .catch(() => []);

  const sp = await searchParams;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "20px 16px 60px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <nav style={{ marginBottom: 20 }}>
          <Link
            href="/nex-native/manage"
            style={{ color: NEX.cyan, textDecoration: "none", fontSize: 13 }}
          >
            ← Manage
          </Link>
        </nav>

        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Phase A1 · Accommodation
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.012em",
            }}
          >
            Your rooms
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13,
              color: NEX.textDim,
            }}
          >
            Add, edit, pause or archive the rooms you offer at{" "}
            <strong style={{ color: NEX.text }}>{business.display_name}</strong>.
            Customers see only rooms that are both live AND available. NEX
            doesn&apos;t process bookings or payments · each enquiry opens a
            chat with the customer.
          </p>
          {!isAccommodationSubtype && (
            <div
              data-nex-manage-accommodation-wrong-subtype
              style={{
                marginTop: 16,
                padding: "12px 14px",
                background: "rgba(245,181,68,0.12)",
                border: `1px solid rgba(245,181,68,0.35)`,
                borderRadius: 10,
                fontSize: 12,
                color: NEX.amber,
              }}
            >
              This business is not an accommodation subtype (villa, homestay,
              kost). Rooms will stay saved but won&apos;t render on your public
              shop page until the business subtype is accommodation.
            </div>
          )}
        </header>

        {sp.ok === "1" && sp.m && (
          <div
            data-nex-manage-accommodation-banner="ok"
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              background: "rgba(22,214,107,0.10)",
              border: `1px solid rgba(22,214,107,0.35)`,
              borderRadius: 10,
              color: NEX.green,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {humanizeOkCode(sp.m)}
          </div>
        )}

        {sp.e && sp.m && (
          <div
            data-nex-manage-accommodation-banner="error"
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              background: "rgba(255,77,94,0.10)",
              border: `1px solid rgba(255,77,94,0.35)`,
              borderRadius: 10,
              color: NEX.danger,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {decodeURIComponent(sp.m)}
          </div>
        )}

        {/* Create form · minimal fields to get a first room saved */}
        <section
          style={{
            marginBottom: 32,
            padding: 20,
            background: NEX.panelSoft,
            border: `1px solid ${NEX.border}`,
            borderRadius: 16,
          }}
        >
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Add a room
          </h2>
          <form
            action={createRoomAction.bind(null, business.id)}
            data-nex-manage-accommodation-create-form
            style={{ display: "grid", gap: 10 }}
          >
            <LabelInput
              name="name"
              label="Room name"
              placeholder="e.g. Garden Villa · Deluxe Suite · Room 1"
              required
              maxLength={120}
            />
            <LabelInput
              name="description"
              label="Description (optional)"
              placeholder="A short description customers will see"
              textarea
              maxLength={2000}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <LabelInput
                name="capacity"
                label="Guests"
                type="number"
                defaultValue="2"
                min={1}
                max={50}
                required
              />
              <LabelInput
                name="bedrooms"
                label="Bedrooms"
                type="number"
                defaultValue="1"
                min={0}
                max={20}
              />
              <LabelInput
                name="bathrooms"
                label="Bathrooms"
                type="number"
                defaultValue="1"
                min={0}
                max={20}
              />
            </div>
            <LabelInput
              name="amenities"
              label="Amenities (comma-separated)"
              placeholder="wi-fi, kitchen, pool, parking"
              maxLength={500}
            />
            <LabelInput
              name="price_per_night_pence"
              label="Price per night in pence (optional · display only · NEX never charges)"
              type="number"
              placeholder="850000 for Rp 8,500 · leave blank to negotiate in chat"
              min={0}
            />
            <LabelInput
              name="image_url"
              label="Image URL (optional)"
              placeholder="https://..."
              maxLength={1024}
            />
            <button
              type="submit"
              data-nex-manage-accommodation-create-submit
              style={{
                marginTop: 6,
                padding: "10px 18px",
                background: NEX.orange,
                color: "#1A0808",
                fontSize: 13,
                fontWeight: 700,
                border: `1px solid ${NEX.orangeSoft}`,
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              + Add room (saves as draft)
            </button>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: NEX.textMute,
                lineHeight: 1.4,
              }}
            >
              Rooms start as a draft so you can polish before customers see
              them. Publish from the room list below.
            </p>
          </form>
        </section>

        {/* Room list */}
        {rooms.length === 0 ? (
          <section
            data-nex-manage-accommodation-empty
            style={{
              padding: 24,
              textAlign: "center",
              color: NEX.textDim,
              fontSize: 13,
              background: NEX.panelSoft,
              border: `1px dashed ${NEX.border}`,
              borderRadius: 16,
            }}
          >
            No rooms yet. Add your first room above · it saves as a draft
            until you publish it.
          </section>
        ) : (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rooms.map((r) => (
              <article
                key={r.id}
                data-nex-manage-accommodation-row={r.id}
                data-nex-manage-accommodation-row-status={r.status}
                data-nex-manage-accommodation-row-available={r.is_available ? "true" : "false"}
                style={{
                  padding: "14px 16px",
                  background: NEX.panel,
                  border: `1px solid ${NEX.border}`,
                  borderRadius: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <header
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.name}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: NEX.textDim,
                      }}
                    >
                      {r.capacity} guest{r.capacity !== 1 ? "s" : ""} ·{" "}
                      {r.bedrooms} bed{r.bedrooms !== 1 ? "s" : ""} ·{" "}
                      {r.bathrooms} bath
                      {r.bathrooms !== 1 ? "s" : ""}
                      {r.price_per_night_pence !== null && (
                        <>
                          {" · "}
                          <span style={{ color: NEX.cyan }}>
                            {r.currency} {r.price_per_night_pence.toLocaleString()} /night
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <StatusChip status={r.status} isAvailable={r.is_available} />
                </header>

                {r.description && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: NEX.textDim,
                      lineHeight: 1.5,
                    }}
                  >
                    {r.description}
                  </p>
                )}

                {r.amenities.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {r.amenities.map((a) => (
                      <span
                        key={a}
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "rgba(0,175,255,0.08)",
                          color: NEX.textDim,
                          border: `1px solid ${NEX.border}`,
                        }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                <footer
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <Link
                    href={`/nex-native/manage/accommodation/${r.id}`}
                    data-nex-manage-accommodation-edit={r.id}
                    style={buttonStyle("cyan")}
                  >
                    Edit
                  </Link>

                  {r.status === "draft" && (
                    <form
                      action={changeRoomStatusAction.bind(
                        null,
                        business.id,
                        r.id,
                        "live",
                      )}
                      style={{ display: "contents" }}
                    >
                      <button
                        type="submit"
                        data-nex-manage-accommodation-publish={r.id}
                        style={buttonStyle("orange")}
                      >
                        Publish
                      </button>
                    </form>
                  )}

                  {r.status === "live" && (
                    <form
                      action={toggleRoomAvailableAction.bind(
                        null,
                        business.id,
                        r.id,
                        !r.is_available,
                      )}
                      style={{ display: "contents" }}
                    >
                      <button
                        type="submit"
                        data-nex-manage-accommodation-toggle-available={r.id}
                        style={buttonStyle(r.is_available ? "amber" : "green")}
                      >
                        {r.is_available ? "Pause" : "Mark available"}
                      </button>
                    </form>
                  )}

                  {r.status !== "archived" && (
                    <form
                      action={changeRoomStatusAction.bind(
                        null,
                        business.id,
                        r.id,
                        "archived",
                      )}
                      style={{ display: "contents" }}
                    >
                      <button
                        type="submit"
                        data-nex-manage-accommodation-archive={r.id}
                        style={buttonStyle("danger")}
                      >
                        Archive
                      </button>
                    </form>
                  )}

                  {r.status === "archived" && (
                    <form
                      action={changeRoomStatusAction.bind(
                        null,
                        business.id,
                        r.id,
                        "live",
                      )}
                      style={{ display: "contents" }}
                    >
                      <button
                        type="submit"
                        data-nex-manage-accommodation-unarchive={r.id}
                        style={buttonStyle("green")}
                      >
                        Restore
                      </button>
                    </form>
                  )}
                </footer>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

// ─── UI helpers ─────────────────────────────────────────────────

function LabelInput(props: {
  name: string;
  label: string;
  placeholder?: string;
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
    border: `1px solid rgba(139,169,209,0.24)`,
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
        {props.required && " *"}
      </span>
      {props.textarea ? (
        <textarea
          name={props.name}
          placeholder={props.placeholder}
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
          placeholder={props.placeholder}
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

function StatusChip({
  status,
  isAvailable,
}: {
  status: "draft" | "live" | "archived";
  isAvailable: boolean;
}): React.ReactElement {
  const chipPalette: Record<"draft" | "live" | "archived", { bg: string; fg: string; label: string }> = {
    draft: {
      bg: "rgba(245,181,68,0.14)",
      fg: "#F5B544",
      label: "Draft",
    },
    live: isAvailable
      ? {
          bg: "rgba(22,214,107,0.14)",
          fg: "#16D66B",
          label: "Live · available",
        }
      : {
          bg: "rgba(245,181,68,0.14)",
          fg: "#F5B544",
          label: "Live · unavailable",
        },
    archived: {
      bg: "rgba(139,169,209,0.14)",
      fg: "#8BA9D1",
      label: "Archived",
    },
  };
  const palette = chipPalette[status];
  return (
    <span
      data-nex-manage-accommodation-status-chip={status}
      style={{
        padding: "4px 10px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: palette.bg,
        color: palette.fg,
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {palette.label}
    </span>
  );
}

function buttonStyle(tone: "cyan" | "orange" | "green" | "amber" | "danger"): React.CSSProperties {
  const tones = {
    cyan: { bg: "transparent", fg: "#00AFFF", border: "rgba(0,175,255,0.5)" },
    orange: { bg: "#FF7200", fg: "#1A0808", border: "rgba(255,114,0,0.6)" },
    green: { bg: "transparent", fg: "#16D66B", border: "rgba(22,214,107,0.5)" },
    amber: { bg: "transparent", fg: "#F5B544", border: "rgba(245,181,68,0.5)" },
    danger: { bg: "transparent", fg: "#FF4D5E", border: "rgba(255,77,94,0.5)" },
  };
  const t = tones[tone];
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: "inherit",
  };
}

function humanizeOkCode(raw: string): string {
  const code = decodeURIComponent(raw);
  switch (code) {
    case "room_created":
      return "Room added. Publish it when you're ready.";
    case "room_saved":
      return "Room saved.";
    case "room_published":
      return "Room published. Customers can see it now.";
    case "room_archived":
      return "Room archived. Past enquiries keep their reference.";
    case "room_drafted":
      return "Room back to draft.";
    case "room_marked_available":
      return "Room marked available again.";
    case "room_marked_unavailable":
      return "Room paused for now. It stays live but customers see 'unavailable'.";
    default:
      return "Saved.";
  }
}
