// Screen 12 · NEX Chat · property-aware when ?property=<id> is set.
"use client";

import type * as React from "react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageShell, TopBarBack, TopBarBrand } from "../_components/_page-shell";
import { BottomNav } from "../_components/_bottom-nav";
import { Icon } from "../_components/_icons";
import { NEX } from "../_components/_palette";
import { getPropertyById, USER_TRIPS } from "../_components/_fixtures";

export default function ChatPage(): React.ReactElement {
  return (
    <Suspense fallback={<PageShell><div style={{ padding: 24 }}>Loading…</div></PageShell>}>
      <ChatInner />
    </Suspense>
  );
}

function ChatInner(): React.ReactElement {
  const sp = useSearchParams();
  const propertyId = sp.get("property");

  if (propertyId) {
    const property = getPropertyById(propertyId);
    if (property) return <PropertyChat propertyId={propertyId} />;
  }

  // Chat INDEX view · list of threads
  return (
    <PageShell>
      <TopBarBrand
        rightSlot={
          <button type="button" aria-label="New chat" style={{ width: 36, height: 36, borderRadius: 999, border: `1px solid ${NEX.divider}`, background: NEX.surface, color: NEX.textMid, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="plus" size={18} />
          </button>
        }
      />
      <section style={{ padding: "16px 18px 6px" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NEX.text, letterSpacing: "-0.015em" }}>Your conversations</h1>
        <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMuted }}>
          Owner responses to your booking requests and questions.
        </div>
      </section>

      {USER_TRIPS.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: NEX.textMuted, fontSize: 13 }}>
          No conversations yet.
        </div>
      ) : (
        <section style={{ padding: "10px 18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {USER_TRIPS.map((t) => {
            const p = getPropertyById(t.propertyId);
            if (!p) return null;
            return (
              <Link
                key={t.id}
                href={`/nex-native/dev/hotel-flow/chat?property=${p.id}`}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: 10,
                  background: NEX.surface,
                  border: `1px solid ${NEX.divider}`,
                  borderRadius: 12,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", background: NEX.surfaceAlt, flex: "0 0 auto" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.hero[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text, lineHeight: 1.2 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: NEX.textMuted, marginTop: 2 }}>
                    {t.status === "request_sent" ? "Awaiting owner reply · booking request sent" : "Past stay"}
                  </div>
                </div>
                <span style={{ color: NEX.textMuted, display: "inline-flex", alignSelf: "center" }}>
                  <Icon name="chevronRight" size={18} />
                </span>
              </Link>
            );
          })}
        </section>
      )}
      <BottomNav active="chat" />
    </PageShell>
  );
}

// Property-specific chat
function PropertyChat({ propertyId }: { readonly propertyId: string }): React.ReactElement {
  const property = getPropertyById(propertyId)!;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<readonly { readonly from: "me" | "owner" | "system"; readonly text: string }[]>([
    {
      from: "system",
      text: `Context: ${property.name} · ${property.city}, ${property.region}`,
    },
  ]);

  function send(text: string): void {
    const t = text.trim();
    if (t.length === 0) return;
    setMessages((m) => [...m, { from: "me", text: t }]);
    setInput("");
  }

  const quickChips: readonly string[] = [
    "Can I walk to the beach?",
    "Is breakfast included?",
    "Are children welcome?",
    "Any extra fees on arrival?",
  ];

  return (
    <PageShell withBottomNavSpace={false}>
      <TopBarBack
        title={`Ask ${property.name}`}
        onBackHref={`/nex-native/dev/hotel-flow/detail/${property.id}`}
        rightSlot={
          <Link
            href={`/nex-native/dev/hotel-flow/detail/${property.id}`}
            aria-label="Property"
            style={{ width: 36, height: 36, borderRadius: 999, overflow: "hidden", background: NEX.surfaceAlt, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={property.hero[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </Link>
        }
      />

      <section style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.from === "me" ? "flex-end" : m.from === "system" ? "center" : "flex-start",
              maxWidth: "80%",
              padding: m.from === "system" ? "6px 12px" : "10px 14px",
              borderRadius: 14,
              background:
                m.from === "me"
                  ? NEX.accent
                  : m.from === "system"
                  ? NEX.surfaceAlt
                  : NEX.surface,
              color: m.from === "me" ? "#FFFFFF" : m.from === "system" ? NEX.textMuted : NEX.text,
              fontSize: m.from === "system" ? 11 : 14,
              border: m.from === "owner" ? `1px solid ${NEX.divider}` : "none",
              lineHeight: 1.4,
            }}
          >
            {m.text}
          </div>
        ))}
        {messages.length === 1 ? (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {quickChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => send(chip)}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: `1px solid ${NEX.divider}`,
                  background: NEX.surface,
                  fontSize: 14,
                  color: NEX.text,
                  cursor: "pointer",
                }}
              >
                {chip}
              </button>
            ))}
            <div style={{ marginTop: 6, fontSize: 11, color: NEX.textMuted, textAlign: "center" }}>
              Tap a question or type below. (Prototype · no messages are sent to a real owner.)
            </div>
          </div>
        ) : null}
      </section>

      <div style={{ height: 90 }} />

      {/* Composer */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div
          className="nex-mobile-shell"
          style={{
            pointerEvents: "auto",
            padding: "10px 14px 14px",
            background: `${NEX.bg}f0`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: `1px solid ${NEX.divider}`,
            display: "flex",
            gap: 8,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              padding: "4px 8px 4px 14px",
              borderRadius: 999,
              background: NEX.surface,
              border: `1px solid ${NEX.divider}`,
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
              placeholder="Message the owner…"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: 14,
                color: NEX.text,
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={input.trim().length === 0}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "none",
                background: input.trim().length > 0 ? NEX.accent : NEX.surfaceAlt,
                color: input.trim().length > 0 ? "#FFFFFF" : NEX.textMuted,
                fontSize: 12,
                fontWeight: 700,
                cursor: input.trim().length > 0 ? "pointer" : "not-allowed",
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
