// Screen 11 · Booking Request.
"use client";

import type * as React from "react";
import { useState, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell, TopBarBack } from "../../_components/_page-shell";
import { Icon } from "../../_components/_icons";
import { NEX } from "../../_components/_palette";
import { getPropertyById, COPY } from "../../_components/_fixtures";

export default function BookingPage({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  return (
    <Suspense fallback={<PageShell><div style={{ padding: 24 }}>Loading…</div></PageShell>}>
      <BookingInner params={params} />
    </Suspense>
  );
}

function BookingInner({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  const { id } = use(params);
  const property = getPropertyById(id);
  const sp = useSearchParams();
  const preselectedRoom = sp.get("room") ?? (property?.rooms[0]?.id ?? "");
  const router = useRouter();

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomId, setRoomId] = useState(preselectedRoom);
  const [notes, setNotes] = useState("");

  if (!property) return <PageShell><div style={{ padding: 24 }}>Not found.</div></PageShell>;

  const selectedRoom = property.rooms.find((r) => r.id === roomId) ?? property.rooms[0];

  function sendRequest(): void {
    const q = new URLSearchParams({
      property: property!.id,
      room: roomId,
      checkIn,
      checkOut,
      adults: String(adults),
      children: String(children),
    });
    router.push(`/nex-native/dev/hotel-flow/confirmation?${q.toString()}`);
  }

  const canSend = checkIn.length > 0 && checkOut.length > 0;

  return (
    <PageShell>
      <TopBarBack title="Request booking" onBackHref={`/nex-native/dev/hotel-flow/detail/${property.id}`} />

      {/* Summary of what the owner receives */}
      <section style={{ padding: "16px 18px 10px" }}>
        <div
          style={{
            padding: 14,
            background: NEX.accentMuted,
            border: `1px solid ${NEX.accentSoft}`,
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 11, color: NEX.accent, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>
            Owner will receive
          </div>
          <div style={{ fontSize: 14, color: NEX.text, fontWeight: 700 }}>{property.name}</div>
          <div style={{ fontSize: 12, color: NEX.textMid, marginTop: 2 }}>
            {property.city}, {property.region}
          </div>
        </div>
      </section>

      {/* Dates */}
      <Section title="Dates">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <DateField label="Check-in" value={checkIn} onChange={setCheckIn} />
          <DateField label="Check-out" value={checkOut} onChange={setCheckOut} />
        </div>
      </Section>

      {/* Guests */}
      <Section title="Guests">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <StepperRow label="Adults" sub="12+" value={adults} min={1} onChange={setAdults} />
          <StepperRow label="Children" sub="0-11" value={children} min={0} onChange={setChildren} />
        </div>
      </Section>

      {/* Rooms */}
      <Section title="Room">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {property.rooms.map((r) => {
            const active = r.id === roomId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoomId(r.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  background: NEX.surface,
                  border: `2px solid ${active ? NEX.accent : NEX.divider}`,
                  borderRadius: 12,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ width: 60, height: 50, borderRadius: 8, overflow: "hidden", background: NEX.surfaceAlt, flex: "0 0 auto" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: NEX.textMuted }}>{r.bedConfig}</div>
                </div>
                <div style={{ fontSize: 11, color: NEX.textMuted, fontStyle: "italic" }}>Price on request</div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Special requests */}
      <Section title="Anything the owner should know?">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Arrival time · dietary needs · accessibility · etc."
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${NEX.divider}`,
            background: NEX.surface,
            fontSize: 14,
            color: NEX.text,
            resize: "vertical",
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </Section>

      <section style={{ padding: "0 18px 10px", fontSize: 12, color: NEX.textMid, lineHeight: 1.6 }}>
        {COPY.requestSentNote}
      </section>

      <div style={{ height: 100 }} />

      {/* Sticky bottom */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 90,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          className="nex-mobile-shell"
          style={{
            pointerEvents: "auto",
            padding: "12px 16px 14px",
            background: `${NEX.bg}f0`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: `1px solid ${NEX.divider}`,
            boxShadow: "0 -4px 20px rgba(26,43,74,0.06)",
          }}
        >
          <button
            type="button"
            onClick={sendRequest}
            disabled={!canSend}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "none",
              background: canSend ? NEX.accent : NEX.surfaceAlt,
              color: canSend ? "#FFFFFF" : NEX.textMuted,
              fontSize: 15,
              fontWeight: 700,
              cursor: canSend ? "pointer" : "not-allowed",
              boxShadow: canSend ? `0 4px 14px ${NEX.accent}44` : "none",
            }}
          >
            Send booking request
          </button>
        </div>
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section style={{ padding: "6px 18px 12px" }}>
      <div style={{ fontSize: 11, color: NEX.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): React.ReactElement {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, color: NEX.textMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${NEX.divider}`,
          background: NEX.surface,
          fontSize: 14,
          color: NEX.text,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </label>
  );
}

function StepperRow({ label, sub, value, min, onChange }: { label: string; sub: string; value: number; min: number; onChange: (v: number) => void }): React.ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: NEX.surface, border: `1px solid ${NEX.divider}`, borderRadius: 10 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: NEX.text }}>{label}</div>
        <div style={{ fontSize: 11, color: NEX.textMuted }}>{sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))} style={stepperBtn(value > min)}>
          <Icon name="minus" size={14} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: NEX.text, minWidth: 20, textAlign: "center" }}>{value}</span>
        <button type="button" aria-label="Increase" onClick={() => onChange(value + 1)} style={stepperBtn(true)}>
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
}

function stepperBtn(active: boolean): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: `1px solid ${NEX.divider}`,
    background: active ? NEX.surface : NEX.surfaceAlt,
    color: active ? NEX.text : NEX.textSoft,
    cursor: active ? "pointer" : "not-allowed",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
