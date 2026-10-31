// src/app/nex-native/home/_first-contact-panel.tsx
//
// First-contact panel · Phase 2 implementation · 2026-10-14.
//
// Owner-approved product direction (sealed 2026-10-14):
//   · Option C · inline on NEX home for eligible new users.
//   · Even though the auto-created NEX1 welcome conversation
//     exists, this panel must still render for genuinely new users.
//   · Completion is derived from existing conversation/message
//     state via `_first-contact-predicate.ts` · fails closed on any
//     read error.
//   · Preserves the sealed `shouldShowFirstVisitInvitation` gate
//     and the sealed `/u/{handle}` discoverability default.
//
// This file exposes:
//   · `resolveFirstContactSignals(viewerAccountId)` · server-side
//     resolver that calls only sealed services. All reads are
//     try/caught and mapped to the signal shape's `*_unknown`
//     branches so the pure predicate can fail closed.
//   · `<FirstContactPanel />` · RSC panel. Renders the identity
//     card (handle + share button) + three action cards (Meet NEX1,
//     NEX Community, Chat Themes). The themes card is a
//     complementary nudge to the sealed `FirstVisitInvitation`
//     tile; owners who want to hide one when the other shows can
//     add a gate in `home/page.tsx` later.
//
// Doctrinal boundaries this module MUST NEVER cross:
//   · No new DB column, no new flag, no new cookie, no server
//     action, no RPC. Reads only. Writes nothing.
//   · No `is_discoverable` default change · the caller passes the
//     already-resolved `profile.is_discoverable` value.
//   · No sealed-component edits · reuses `<Link>`, server-rendered.
//   · No handle-resolution bypass · the handle argument is read
//     from `session.account.nex_handle` upstream.
//   · No composer here · owner forbade a home-page composer in
//     this pass.

import "server-only";

import type * as React from "react";
import Link from "next/link";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import { NEX_OFFICIAL_ACCOUNT_ID, NEX_OFFICIAL_CHAT_HREF } from "@/lib/nex-native/nex-official";
import type { NexUuid } from "@/lib/nex-native/types";
import type { FirstContactSignals } from "./_first-contact-predicate";
import { FirstContactShareHandle } from "./_first-contact-share-handle";

/**
 * Resolve the two first-contact signals using only sealed-service
 * reads. Fails closed on any error · returns `*_unknown` so the
 * pure predicate hides the panel rather than showing a stale state.
 *
 * Sequential by necessity: the second read needs the NEX1
 * conversation id discovered in the first read.
 */
export async function resolveFirstContactSignals(
  viewerAccountId: NexUuid,
): Promise<FirstContactSignals> {
  let peerConvs: Awaited<
    ReturnType<typeof peerConversationService.listPeerConversationsForAccount>
  >;
  try {
    peerConvs = await peerConversationService.listPeerConversationsForAccount(
      viewerAccountId,
    );
  } catch {
    return { kind: "convs_unknown" };
  }

  const nex1Conv = peerConvs.find(
    (c) =>
      c.participant_a_id === NEX_OFFICIAL_ACCOUNT_ID ||
      c.participant_b_id === NEX_OFFICIAL_ACCOUNT_ID,
  );
  const nonNex1ConversationCount = peerConvs.filter(
    (c) =>
      c.participant_a_id !== NEX_OFFICIAL_ACCOUNT_ID &&
      c.participant_b_id !== NEX_OFFICIAL_ACCOUNT_ID,
  ).length;

  // Edge · the Bridge 62 inline welcome at _actions.ts:169-209 is
  // best-effort (comment at line 173: "any failure here doesn't
  // block signup"). When it fails silently, the user has no NEX1
  // conversation at all. That's STILL a new user · we treat
  // nex1LastMessageSender as null and let the predicate decide.
  if (!nex1Conv) {
    return {
      kind: "ok",
      nonNex1ConversationCount,
      nex1LastMessageSender: null,
    };
  }

  let lastMsg: Awaited<
    ReturnType<typeof peerMessageService.getLastPeerMessageInConversation>
  >;
  try {
    lastMsg = await peerMessageService.getLastPeerMessageInConversation(
      nex1Conv.id,
    );
  } catch {
    return { kind: "nex1_message_unknown" };
  }

  // `lastMsg === null` is a legitimate state · the NEX1 conv row
  // exists but has no messages (Bridge 62 race: conversation
  // insert succeeded, message insert failed). Still treat as "user
  // has not acted."
  const nex1LastMessageSender = lastMsg?.sender_account_id ?? null;

  return {
    kind: "ok",
    nonNex1ConversationCount,
    nex1LastMessageSender,
  };
}

/* ─── Palette · matches home/page.tsx token set ─────────────────── */
const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  orange: "#FF7200",
  violet: "#9B6DFF",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

export interface FirstContactPanelProps {
  /** The viewer's NEX handle. Required · home/page.tsx guards
   *  rendering so this is only called when the handle is non-null. */
  readonly handle: string;
  /** Viewer's first name for the greeting. Falls back to "there". */
  readonly firstName: string;
  /** Caller passes `profile.is_discoverable === true` after reading
   *  the sealed profile row. The share widget decides URL inclusion
   *  from this flag · never re-reads the profile. */
  readonly canShareProfileUrl: boolean;
  /** Theme accent · defaults to NEX cyan. Home passes `themeAccent`. */
  readonly accentHex?: string;
}

export function FirstContactPanel(
  props: FirstContactPanelProps,
): React.ReactElement {
  const { handle, firstName, canShareProfileUrl, accentHex = NEX.cyan } = props;
  const safeFirstName = firstName && firstName.trim().length > 0 ? firstName : "there";

  return (
    <section
      aria-label="Your first look at NEX"
      data-nex-home-first-contact-panel
      style={{
        marginTop: 20,
        padding: "18px 18px 16px",
        borderRadius: 16,
        background: NEX.panelSoft,
        border: `1px solid ${accentHex}44`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent band · subtle hue line at the top */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accentHex}cc 0%, transparent 90%)`,
        }}
      />

      {/* Identity card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "14px 14px 16px",
          borderRadius: 12,
          background: "rgba(2, 9, 20, 0.5)",
          border: `1px solid ${NEX.borderSoft}`,
        }}
        data-nex-first-contact-identity-card
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: accentHex,
            fontWeight: 700,
          }}
        >
          Your NEX identity
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: NEX.textPrimary,
            fontFamily: "ui-monospace, 'JetBrains Mono', 'SF Mono', monospace",
            letterSpacing: "0.02em",
          }}
          data-nex-first-contact-handle
        >
          {handle}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: NEX.textMuted,
            lineHeight: 1.5,
          }}
        >
          Hi {safeFirstName} · this is you on NEX. Share your handle so
          friends can find you.
          {!canShareProfileUrl && (
            <>
              {" "}
              <Link
                href="/nex-native/settings/profile?tab=personal"
                style={{ color: accentHex, fontWeight: 600, textDecoration: "none" }}
                data-nex-first-contact-make-discoverable-link
              >
                Make my profile shareable →
              </Link>
            </>
          )}
        </p>
        <FirstContactShareHandle
          handle={handle}
          canShareProfileUrl={canShareProfileUrl}
          accentHex={accentHex}
        />
      </div>

      {/* Action cards · Meet NEX1 · NEX Community · Explore Chat Themes.
          The themes card routes to the sealed three-destination
          first-visit landing (/nex-native/chat/first-visit) which is
          hidden from fresh signups by the sealed invitation predicate
          (conversationCount === 1 for a brand-new account because of
          the auto-NEX1 welcome). Adding the route here does NOT change
          the sealed predicate · it just gives first-contact users a
          deliberate entry into the themes experience they'd otherwise
          miss. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <ActionCard
          href={NEX_OFFICIAL_CHAT_HREF}
          dataKey="meet-nex1"
          eyebrow="Say hello"
          title="Meet NEX1"
          tagline="Your first conversation. Reply to NEX1 any time you have a question."
          accent={accentHex}
        />
        <ActionCard
          href="/nex-native/community"
          dataKey="community"
          eyebrow="Explore"
          title="NEX Community"
          tagline="Discover what's happening in your area."
          accent={NEX.orange}
        />
        <ActionCard
          href="/nex-native/chat/first-visit"
          dataKey="themes"
          eyebrow="Make it yours"
          title="Explore Chat Themes"
          tagline="Browse themes, see the shop preview, and personalise how NEX looks."
          accent={NEX.violet}
        />
      </div>
    </section>
  );
}

function ActionCard({
  href,
  dataKey,
  eyebrow,
  title,
  tagline,
  accent,
}: {
  href: string;
  dataKey: string;
  eyebrow: string;
  title: string;
  tagline: string;
  accent: string;
}): React.ReactElement {
  return (
    <Link
      href={href}
      aria-label={`${title} · ${tagline}`}
      data-nex-first-contact-action-card={dataKey}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(2, 9, 20, 0.5)",
        border: `1px solid ${accent}33`,
        textDecoration: "none",
        color: NEX.textPrimary,
        position: "relative",
        overflow: "hidden",
        minHeight: 72,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${accent}cc 0%, ${accent}33 60%, transparent 100%)`,
          border: `1px solid ${accent}66`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: accent,
            fontWeight: 700,
            marginBottom: 3,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: NEX.textPrimary,
            fontFamily: "'Cormorant Garamond', 'EB Garamond', Georgia, serif",
            letterSpacing: "-0.005em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 12,
            color: NEX.textSecondary,
            lineHeight: 1.4,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {tagline}
        </p>
      </div>
      <span
        aria-hidden
        style={{
          color: accent,
          fontSize: 18,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        →
      </span>
    </Link>
  );
}
