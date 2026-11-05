// src/app/nex-native/manage/live/shop-contacts/[sessionId]/page.tsx
//
// NEX Live · Shop Contacts shuffle · broadcaster surface.
// -----------------------------------------------------------------------------
// Phase 2 · Live interaction UI build 2026-10-24.
//
// Server component. Loads the participation ledger for the session,
// applies the dedup rules against the Contacts system
// (shop-contacts-dedup.ts), and renders NEX-ID-only cards in a
// deterministic shuffle order.
//
// Auth: signed-in broadcaster only. The service-layer check
// `dedupShopContactsCohort` runs with the broadcaster's account id;
// cards are only materialised for sessions owned by this user.
//
// Honest states
//   · migrations 221 unapplied → `listShopContactsCards` fail-opens
//     to `[]` → the surface shows the "no participants" empty state.
//   · dedup suppresses accepted edges, pending invites and active
//     cooldowns · the broadcaster never sees a card that would
//     collide with the existing Contacts flow.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  listShopContactsCards,
  shuffleCards,
} from "@/lib/nex-native/live-broadcast/participation-ledger-service";
import { dedupShopContactsCohort } from "@/lib/nex-native/shop-contacts/dedup";
import { getActiveSessionForBroadcaster } from "@/lib/nex-native/live-broadcast/live-session-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { ShopContactsCard } from "./_shop-contacts-card";

export const metadata = {
  title: "NEX · Shop Contacts",
  description: "Participants from your recent live stream.",
};

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  cyan: "#00AFFF",
  border: "rgba(255,255,255,0.08)",
} as const;

async function requireSignedInAccountId(pathname: string): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
  }
  return session.account.id;
}

async function getParticipantNexHandle(
  accountId: string,
): Promise<string | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select("nex_handle")
      .eq("id", accountId)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { nex_handle: string | null }).nex_handle ?? null;
  } catch {
    return null;
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<React.JSX.Element> {
  const { sessionId } = await params;
  const broadcasterAccountId = await requireSignedInAccountId(
    `/nex-native/manage/live/shop-contacts/${sessionId}`,
  );

  // Shape guard · a malformed session id short-circuits to the empty
  // state (never a 500).
  if (!UUID_SHAPE.test(sessionId)) {
    return <EmptyState reason="invalid-session" />;
  }

  // Load the participation cards for the session · fail-open on error.
  const rawCards = await listShopContactsCards(sessionId);

  // Owner-check: the broadcaster must own this session's business.
  // The service-role bypasses RLS so we re-check here · we only
  // surface cards from a session the caller actually broadcast.
  // Plan v4 · AC-1 · request-scoped nowMs.
  const nowMs = Date.now();
  const activeSession = await getActiveSessionForBroadcaster(
    broadcasterAccountId,
    nowMs,
  );
  const ownsSession =
    rawCards.length === 0
      ? true // nothing to leak · empty state is safe for any caller
      : activeSession?.id === sessionId
        || (await verifyBroadcasterOwnsSession(sessionId, broadcasterAccountId));
  if (!ownsSession) {
    return <EmptyState reason="not-your-session" />;
  }

  // Dedup against the Contacts system · accepted edges / pending
  // invites / active cooldowns suppress the card.
  const dedup = await dedupShopContactsCohort({
    broadcasterAccountId,
    participantAccountIds: rawCards.map((c) => c.participantAccountId),
  });
  const eligible = rawCards.filter(
    (c) => dedup.get(c.participantAccountId)?.suppress !== true,
  );

  // Deterministic shuffle · same seed on refresh keeps order stable.
  const shuffled = eligible.length > 0
    ? shuffleCards(eligible, eligible[0]!.shuffleSeedHex)
    : eligible;

  // Resolve each participant's NEX-ID handle for display · same
  // identity-privacy rule as pending-invite cards (NEX-ID only · no
  // display name, avatar, city until acceptance).
  const cardViewModels = await Promise.all(
    shuffled.map(async (c) => ({
      participantAccountId: c.participantAccountId,
      nexHandle: await getParticipantNexHandle(c.participantAccountId),
    })),
  );

  return (
    <main
      data-nex-shop-contacts-page
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "calc(env(safe-area-inset-top, 0px) + 16px) 16px 24px",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 800,
          color: NEX.text,
        }}
      >
        Participants from your Live
      </h1>
      <p
        style={{
          margin: "6px 0 20px",
          fontSize: 13,
          color: NEX.textDim,
          lineHeight: 1.5,
        }}
      >
        These NEX accounts engaged with your stream. Order is random ·
        we do not reveal who did what. Tap Send Invite to add them to
        your Shop Contacts · they decide.
      </p>

      {cardViewModels.length === 0 ? (
        <EmptyState reason="no-participants" />
      ) : (
        <ul
          data-nex-shop-contacts-list
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {cardViewModels.map((card) => (
            <li key={card.participantAccountId}>
              <ShopContactsCard
                participantAccountId={card.participantAccountId}
                nexHandle={card.nexHandle}
                sessionId={sessionId}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

// Fallback used when the active-session check misses · reads the
// session row directly via service-role. Fail-closed · returns false
// on any error so the broadcaster never sees someone else's cards.
async function verifyBroadcasterOwnsSession(
  sessionId: string,
  broadcasterAccountId: string,
): Promise<boolean> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_live_session")
      .select("broadcaster_account_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (error || !data) return false;
    return (data as { broadcaster_account_id: string | null })
      .broadcaster_account_id === broadcasterAccountId;
  } catch {
    return false;
  }
}

function EmptyState({
  reason,
}: {
  readonly reason: "invalid-session" | "no-participants" | "not-your-session";
}): React.JSX.Element {
  const copy = (() => {
    switch (reason) {
      case "invalid-session":
        return "This session link is malformed.";
      case "not-your-session":
        return "You don't broadcast this session.";
      case "no-participants":
        return "No participants yet. Cards appear here after you end a Live stream.";
    }
  })();
  return (
    <div
      data-nex-shop-contacts-empty
      data-nex-shop-contacts-empty-reason={reason}
      style={{
        marginTop: 24,
        padding: "22px 18px",
        background: "#0E1526",
        border: `1px solid ${NEX.border}`,
        borderRadius: 14,
        color: NEX.textDim,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      {copy}
    </div>
  );
}
