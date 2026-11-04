// src/app/nex-native/free-chat/call/page.tsx
//
// NEX Ireland · Voice-call surface · LIVE WIRING · Phase 1.
// Owner-authorised 2026-11-04 later-same-day · the surface is now
// sign-in-gated and loads a real peer from the DB via the sealed
// peer-conversation-service. The Ireland UI I built earlier is
// preserved · a thin client component mounts the sealed PeerCall
// 1:1 WebRTC engine inside it.
// -----------------------------------------------------------------------------
// Entry:
//   /nex-native/free-chat/call?peer=<nex-handle | account-uuid>
//
// Flow:
//   1. resolveNexAppSessionFromContext() + resolveSessionWithDevOverride()
//      resolve the signed-in viewer (dev-impersonation respected).
//   2. If guest → redirect to /sign-in?next=<this page>.
//   3. ?peer= is parsed. Handle form (nex-99912) or UUID form.
//      · Not provided → render a soft empty state with a CTA back to
//        /nex-native/calls (contact picker).
//      · Not found    → 404.
//      · Not a friend → still render (the engine will enforce its
//        own participant checks) but we show the peer as-is.
//   4. getOrCreatePeerConversation(viewer, peer) returns conversationId.
//   5. We pass {viewer, peer, conversationId} to <LiveCallClient>
//      which mounts the sealed PeerCall engine inside the Ireland UI.
//
// Scope (Phase 1):
//   · Caller-side wiring only. Callee (incoming-call) UI is a Phase 2
//     concern — the sealed peer-chat inbox handles incoming today.
//   · Record stays UI-only — no storage/retention wired (legal gate).
//   · Speaker is best-effort via setSinkId where the browser supports it.
//   · Mute · End · Add are wired to real engine methods / server action.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as accountService from "@/lib/nex-native/account-service";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as friendService from "@/lib/nex-native/friend-service";
import { LiveCallClient } from "./_live-call-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IRELAND = {
  bgBase: "var(--nex-world-background-base, #06130C)",
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  secondarySoft:
    "color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 35%, transparent)",
  secondaryFaint:
    "color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 18%, transparent)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  heatRim: "var(--nex-kp-accent, #FF7200)",
  heatRimSoft: "rgba(255, 114, 0, 0.42)",
  heatRimFaint: "rgba(255, 114, 0, 0.18)",
  text: "#F2F5F8",
  textDim: "#CFDCD3",
  textMute: "rgba(175, 197, 181, 0.72)",
  panel:
    "color-mix(in srgb, var(--nex-world-drawer-bg, #123D2B) 85%, transparent)",
  panelBorder: "rgba(198, 161, 91, 0.3)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface PageProps {
  readonly searchParams: Promise<{ peer?: string }>;
}

// Resolve a peer by handle (nex-99912) OR UUID. Handles are the owner-
// facing identifier · UUIDs are acceptable from internal callers. Both
// paths go through the same accountService.
async function resolvePeerArg(arg: string) {
  const trimmed = arg.trim();
  if (trimmed.length === 0) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (isUuid) {
    return accountService.getAccountById(trimmed);
  }
  return accountService.getAccountByNexHandle(trimmed);
}

export default async function FreeChatCallPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const sp = await searchParams;
  const peerArg = sp.peer ?? "";

  // Resolve viewer · dev impersonation wins when set, otherwise the
  // production session resolver runs. Guests redirect to /sign-in.
  const devSession = await resolveSessionWithDevOverride();
  const prodSession = devSession ? null : await resolveNexAppSessionFromContext();
  const session = devSession ?? prodSession;

  if (!session) {
    const next = `/nex-native/free-chat/call${peerArg ? `?peer=${encodeURIComponent(peerArg)}` : ""}`;
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(next)}`);
  }

  // No peer specified · render the inline friend picker so the user
  // never lands on a dead screen. Resolves the viewer's accepted
  // friends via the sealed friend-service, hydrates each with name +
  // location, and renders a tile grid where each card routes to
  // /free-chat/call?peer=<handle>.
  if (peerArg.length === 0) {
    const friendIds = await friendService.listFriends(session.account.id);
    const friends = await Promise.all(
      friendIds.map(async (id) => {
        const acc = await accountService.getAccountById(id).catch(() => null);
        if (!acc) return null;
        const prof = await accountProfileService
          .getProfileByAccountId(id)
          .catch(() => null);
        return {
          accountId: id,
          handle: acc.nex_handle ?? null,
          displayName: acc.display_name ?? "NEX friend",
          initials: computeInitials(acc.display_name ?? ""),
          location: prof?.location_label ?? null,
          profession: prof?.profession ?? null,
        };
      }),
    );
    const resolved = friends.filter(
      (f): f is NonNullable<typeof f> => f !== null && f.handle !== null,
    );
    return <FriendPickerShell friends={resolved} />;
  }

  const peer = await resolvePeerArg(peerArg);
  if (!peer) {
    return (
      <EmptyPeerShell
        note={`Couldn't find ${peerArg}. They may have left NEX.`}
        ctaHref="/nex-native/free-chat/call"
        ctaLabel="Pick a different contact"
      />
    );
  }

  // Can't call yourself.
  if (peer.id === session.account.id) {
    return (
      <EmptyPeerShell
        note="You can't call yourself."
        ctaHref="/nex-native/free-chat/call"
        ctaLabel="Pick a different contact"
      />
    );
  }

  // Peer profile for the hero (location, initials, chat_theme).
  const profile = await accountProfileService.getProfileByAccountId(peer.id);

  // Get/create the 1:1 conversation · this is the same service peer-
  // chat uses, so the conversationId returned is the one the signalling
  // channel (nex:signal:{conversationId}) will key on.
  const conversation =
    await peerConversationService.getOrCreatePeerConversation(
      session.account.id,
      peer.id,
    );

  const peerDisplayName = peer.display_name ?? "NEX friend";
  const peerInitials = computeInitials(peerDisplayName);

  // Owner directive 2026-11-04 later-same-day · the Add-to-call modal
  // uses the viewer's REAL friend graph · resolved here server-side so
  // the client component doesn't need to round-trip a server action for
  // the modal content. The current peer is filtered out (they're
  // already on the call).
  const friendIds = await friendService.listFriends(session.account.id);
  const addableFriendsResolved = await Promise.all(
    friendIds
      .filter((id) => id !== peer.id)
      .map(async (id) => {
        const acc = await accountService.getAccountById(id).catch(() => null);
        if (!acc) return null;
        const prof = await accountProfileService
          .getProfileByAccountId(id)
          .catch(() => null);
        return {
          accountId: id,
          handle: acc.nex_handle ?? "",
          name: acc.display_name ?? "NEX friend",
          initials: computeInitials(acc.display_name ?? ""),
          profession: prof?.profession ?? null,
          location: prof?.location_label ?? null,
        };
      }),
  );
  const addableFriends = addableFriendsResolved
    .filter((f): f is NonNullable<typeof f> => f !== null && f.handle.length > 0);

  return (
    <>
      <style>{`
        /* Scroll-lock only · NEVER override html/body background ·
           the sealed Ireland desktop backdrop must flow through on
           viewports ≥500px (nex-native.css:156-187). */
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
          overscroll-behavior: none;
        }
        @keyframes nex-ie-call-ring-slow {
          0%   { transform: scale(1);    opacity: 0.6; }
          100% { transform: scale(1.28); opacity: 0;   }
        }
        @keyframes nex-ie-call-rim-breathe {
          0%, 100% { box-shadow: 0 0 20px ${IRELAND.heatRimSoft}, inset 0 0 10px ${IRELAND.heatRimFaint}; }
          50%      { box-shadow: 0 0 36px ${IRELAND.heatRim}, inset 0 0 14px ${IRELAND.heatRimSoft}; }
        }
        [data-nex-ie-call-rim] {
          animation: nex-ie-call-rim-breathe 2200ms ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-ie-call-rim],
          [data-nex-ie-call-ring] {
            animation: none !important;
          }
        }
      `}</style>

      <LiveCallClient
        viewer={{
          accountId: session.account.id,
          displayName: (session.account as { display_name?: string | null }).display_name ?? "You",
        }}
        peer={{
          accountId: peer.id,
          displayName: peerDisplayName,
          initials: peerInitials,
          location: profile?.location_label ?? null,
          handle: peer.nex_handle ?? null,
        }}
        conversationId={conversation.id}
        addableFriends={addableFriends}
      />
    </>
  );
}

// ─── Friend picker (no peer specified) ────────────────────────────

interface PickerFriend {
  accountId: string;
  handle: string | null;
  displayName: string;
  initials: string;
  location: string | null;
  profession: string | null;
}

function FriendPickerShell({ friends }: { friends: PickerFriend[] }): React.ReactElement {
  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; overscroll-behavior: none; }
        [data-nex-ireland-pick-friend]:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 26px -10px ${IRELAND.heatRimSoft};
          border-color: ${IRELAND.secondary};
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-ireland-pick-friend]:hover { transform: none; }
        }
      `}</style>
      <main
        data-nex-ireland-call-picker
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(900px 600px at 50% -10%, ${IRELAND.secondaryFaint}, transparent 55%),
            radial-gradient(800px 600px at 50% 110%, ${IRELAND.heatRimFaint}, transparent 55%),
            ${IRELAND.drawerBg}
          `,
          color: IRELAND.text,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px calc(env(safe-area-inset-bottom, 0px) + 20px)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <Link
            href="/nex-native/call-centre"
            aria-label="Back to Call Centre"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(2, 9, 20, 0.35)",
              border: `1px solid ${IRELAND.panelBorder}`,
              color: IRELAND.secondary,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              lineHeight: 1,
            }}
          >
            <span aria-hidden>←</span>
            <span>Back</span>
          </Link>
          <div
            aria-hidden
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: IRELAND.secondary,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            Voice call
          </div>
          <span aria-hidden style={{ fontSize: 22, lineHeight: 1, color: IRELAND.secondary, opacity: 0.9 }}>
            ☘
          </span>
        </header>

        <div style={{ textAlign: "center", marginTop: 6, marginBottom: 14 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: IRELAND.text,
              letterSpacing: "-0.01em",
            }}
          >
            Call a friend
          </h1>
          <p
            style={{
              margin: "6px auto 0",
              maxWidth: 380,
              fontSize: 13,
              color: IRELAND.primaryInk,
              lineHeight: 1.5,
              opacity: 0.92,
            }}
          >
            Pick anyone from your contacts.
          </p>
        </div>

        {friends.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              padding: "0 24px",
              textAlign: "center",
            }}
          >
            <div aria-hidden style={{ fontSize: 48, color: IRELAND.secondary, opacity: 0.85 }}>
              ☘
            </div>
            <p style={{ margin: 0, fontSize: 14, color: IRELAND.primaryInk, maxWidth: 320, lineHeight: 1.5 }}>
              You don't have any contacts yet. Add a friend and they'll show up here.
            </p>
            <Link
              href="/nex-native/contacts"
              style={{
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 20px",
                borderRadius: 999,
                background: `radial-gradient(circle at 32% 28%, ${IRELAND.heatRim} 0%, color-mix(in srgb, ${IRELAND.heatRim} 68%, #1A0808) 100%)`,
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
                letterSpacing: "0.02em",
                boxShadow: `0 10px 24px -10px ${IRELAND.heatRimSoft}`,
              }}
            >
              Open contacts
            </Link>
          </div>
        ) : (
          <ul
            role="list"
            aria-label="Pick a contact to call"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {friends.map((f) => (
              <li key={f.accountId}>
                <Link
                  href={`/nex-native/free-chat/call?peer=${encodeURIComponent(f.handle ?? f.accountId)}`}
                  aria-label={`Call ${f.displayName}`}
                  data-nex-ireland-pick-friend={f.handle ?? f.accountId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: IRELAND.panel,
                    border: `1.5px solid ${IRELAND.panelBorder}`,
                    borderRadius: 16,
                    color: IRELAND.text,
                    textDecoration: "none",
                    minHeight: 76,
                    transition:
                      "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                    WebkitTapHighlightColor: "transparent",
                    boxShadow:
                      "0 4px 12px -8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 48,
                      height: 48,
                      flexShrink: 0,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: `radial-gradient(circle at 32% 28%, ${IRELAND.primary} 0%, #0A2A1C 85%)`,
                      color: IRELAND.secondary,
                      fontSize: 16,
                      fontWeight: 800,
                      letterSpacing: "-0.01em",
                      border: `1.5px solid ${IRELAND.secondary}`,
                    }}
                  >
                    {f.initials}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: IRELAND.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {f.displayName}
                    </span>
                    {(f.profession || f.location) && (
                      <span
                        style={{
                          fontSize: 11,
                          color: IRELAND.textMute,
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {[f.profession, f.location].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      width: 42,
                      height: 42,
                      flexShrink: 0,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: `radial-gradient(circle at 32% 28%, ${IRELAND.heatRim} 0%, color-mix(in srgb, ${IRELAND.heatRim} 68%, #1A0808) 100%)`,
                      color: "#FFFFFF",
                      boxShadow: `0 6px 14px -6px ${IRELAND.heatRimSoft}, inset 0 2px 4px rgba(255, 255, 255, 0.25)`,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.15 15.15 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .24-1.02A11.7 11.7 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
                    </svg>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

// ─── Empty / error shell (peer not found · self-call) ─────────────

function EmptyPeerShell({
  note,
  ctaHref,
  ctaLabel = "Pick a contact",
}: {
  note: string;
  ctaHref: string;
  ctaLabel?: string;
}): React.ReactElement {
  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; overscroll-behavior: none; }
      `}</style>
      <main
        data-nex-ireland-call-empty
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(900px 600px at 50% -10%, ${IRELAND.secondaryFaint}, transparent 55%),
            ${IRELAND.drawerBg}
          `,
          color: IRELAND.text,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 32px",
          textAlign: "center",
          gap: 14,
        }}
      >
        <div
          aria-hidden
          style={{
            fontSize: 64,
            lineHeight: 1,
            color: IRELAND.secondary,
            opacity: 0.85,
          }}
        >
          ☘
        </div>
        <p style={{ margin: 0, fontSize: 15, color: IRELAND.primaryInk, maxWidth: 360, lineHeight: 1.5 }}>
          {note}
        </p>
        <Link
          href={ctaHref}
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            borderRadius: 999,
            background: `radial-gradient(circle at 32% 28%, ${IRELAND.heatRim} 0%, color-mix(in srgb, ${IRELAND.heatRim} 68%, #1A0808) 100%)`,
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 800,
            textDecoration: "none",
            letterSpacing: "0.02em",
            boxShadow: `0 10px 24px -10px ${IRELAND.heatRimSoft}`,
          }}
        >
          {ctaLabel}
        </Link>
      </main>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function computeInitials(displayName: string | null | undefined): string {
  if (!displayName) return "·";
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
