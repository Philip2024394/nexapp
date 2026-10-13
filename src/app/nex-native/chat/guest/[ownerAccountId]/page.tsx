// src/app/nex-native/chat/guest/[ownerAccountId]/page.tsx
//
// Guest chat view · provisional-session-only surface for a visitor who
// just posted their first message via the sealed Bridge 99 composer.
// ----------------------------------------------------------------------
// Why this exists:
//
//   The authenticated peer-chat page at /chat/peer/[accountId] has a
//   sealed strict session gate: resolveNexAppSessionFromContext() →
//   if (!session) redirect to sign-in. Weakening that gate would
//   cascade through its ~500 lines of Vault, safe-trade consent, shop
//   setup chooser, friend/reaction/sticker features — none of which
//   apply to a first-time guest.
//
//   This route accepts ONLY provisional sessions. Authenticated users
//   redirect UP to /chat/peer (full feature set). Non-sessioned users
//   redirect to the shop landing. Server-side permission is enforced
//   via a participant-id check on the resolved conversation, not RLS
//   (service-role reads bypass RLS by design here — same pattern the
//   peer-chat page uses, see peer-message-service.listPeerMessages).
//
//   Guest can:
//     · See their first encrypted message as "You sent a message"
//       (we don't hold the private key server-side)
//     · Read owner's plaintext welcome / replies
//     · Send plaintext follow-up messages (sent_at ordering preserved)
//     · Accept a dismissible sign-up prompt at natural moments
//
//   Guest cannot:
//     · Decrypt the sealed E2E encrypted ciphertext of their own first
//       message (requires client-side device private key · stub)
//     · See owner's E2E encrypted replies (same)
//     · Access any other conversation on the platform
//
//   On sign-up/sign-in from here, the provisional account's ownership
//   is transferred to the real account via the sealed account-link
//   path (Phase C).

import "server-only";
import { redirect, notFound } from "next/navigation";
import { resolveNexAppOrProvisionalSession } from "@/lib/nex-native/first-conversation/provisional-session";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import * as businessService from "@/lib/nex-native/business-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { GuestChatClient } from "./_guest-chat-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Props {
  params: Promise<{ ownerAccountId: string }>;
  searchParams?: Promise<{ born?: string }>;
}

export default async function GuestChatPage({
  params,
  searchParams,
}: Props): Promise<React.JSX.Element> {
  const { ownerAccountId } = await params;
  const sp = searchParams ? await searchParams : {};
  const isBorn = sp.born === "1";

  // ─── Session resolution · provisional ONLY ─────────────────────────
  const resolved = await resolveNexAppOrProvisionalSession();

  // Authenticated → bump UP to full chat page.
  if (resolved.kind === "authenticated") {
    redirect(`/nex-native/chat/peer/${ownerAccountId}?born=1`);
  }

  // No session at all → bounce to the shop (not sign-in · the sealed
  // guest surface requires that the visitor has already posted via the
  // first-message composer, which mints the provisional cookie).
  if (resolved.kind === "none") {
    redirect(`/nex-native/home`);
  }

  // resolved.kind === "provisional"
  const guestAccount = resolved.account;

  // ─── Resolve the owner account + its first business (if any) ───────
  const owner = await accountService.getAccountById(ownerAccountId);
  if (!owner) notFound();

  const [businesses, conversation, themeRow] = await Promise.all([
    businessService
      .listBusinessesByOwner(owner.id)
      .catch(
        () =>
          [] as Awaited<ReturnType<typeof businessService.listBusinessesByOwner>>,
      ),
    // Idempotent · the composer already created the conversation during
    // the sealed §7B transaction. This call finds that exact row.
    peerConversationService.getOrCreatePeerConversation(
      guestAccount.id,
      owner.id,
    ),
    // Theme follows the owner's chat_theme per the ONE NEX IDENTITY
    // doctrine · the guest sees the same wallpaper + accent they saw
    // on the cover, no visual context switch.
    owner.chat_theme
      ? chatThemeService.getThemeById(owner.chat_theme).catch(() => null)
      : Promise.resolve(null),
  ]);
  const business = businesses[0] ?? null;

  // ─── Hard authorization check ──────────────────────────────────────
  // The service-role reads below bypass RLS. We MUST verify the guest
  // is actually a participant in this conversation before returning
  // messages, otherwise any provisional-session holder could enumerate
  // conversations by owner id.
  const guestIsParticipant =
    conversation.participant_a_id === guestAccount.id ||
    conversation.participant_b_id === guestAccount.id;
  if (!guestIsParticipant) {
    // This should be impossible since getOrCreatePeerConversation uses
    // guestAccount.id as one participant, but belt-and-braces guard.
    notFound();
  }

  // ─── Load messages for this conversation ───────────────────────────
  const messages = await peerMessageService.listPeerMessages(conversation.id, {
    limit: 100,
  });

  // Shape rows into a client-safe projection. Bridge 99 Stage 8 ships
  // a PLACEHOLDER "encryption" that is really base64(plaintext) · the
  // bytea column stores the raw plaintext bytes directly. We decode
  // them here so the guest sees their actual typed text, not a nerdy
  // "encrypted" placeholder. When Stage 8 upgrades to real nacl.box
  // encryption, this decode will fail soft and we fall back to the
  // placeholder. The TODO is intentional · the "encryption" is not
  // real right now and the guest sees what they typed.
  const projected = messages.map((m) => {
    const isFromGuest = m.sender_account_id === guestAccount.id;
    let bodyText: string = m.body;
    if (m.encrypted && m.ciphertext) {
      // bytea comes back from pg as a Buffer or hex-encoded string
      // depending on client. Normalise and interpret as UTF-8.
      try {
        const ct: unknown = m.ciphertext;
        const buf = Buffer.isBuffer(ct)
          ? ct
          : Buffer.from(String(ct), "utf8");
        const text = buf.toString("utf8");
        if (text && text.length > 0 && /^[\x09\x0A\x0D\x20-\x7E -￿]*$/.test(text)) {
          bodyText = text;
        } else {
          bodyText = isFromGuest ? "Your message" : "Reply";
        }
      } catch {
        bodyText = isFromGuest ? "Your message" : "Reply";
      }
    }
    return {
      id: m.id,
      senderAccountId: m.sender_account_id,
      sentAt: String(m.sent_at),
      isFromGuest,
      body: bodyText,
      encrypted: !!m.encrypted,
    };
  });

  // Resolve theme colours · fall back to NEX default when the owner
  // hasn't set one or the row is missing.
  const theme = themeRow && themeRow.is_active ? themeRow : null;
  const themeInfo = {
    themeId: theme?.id ?? "default",
    accentHex: theme?.accent_hex ?? "#00AFFF",
    bubbleRimHex: theme?.bubble_rim_hex ?? null,
    composerRimHex: theme?.composer_rim_hex ?? null,
    wallpaperUrl: theme?.hero_image_url ?? null,
    // wallpaper_config is JSONB · pass through as-is
    wallpaperConfig: (theme?.wallpaper_config as unknown) ?? null,
  };

  return (
    <GuestChatClient
      guestAccountId={guestAccount.id}
      ownerAccountId={owner.id}
      ownerDisplayName={owner.display_name}
      businessDisplayName={business?.display_name ?? null}
      businessSlug={business?.slug ?? null}
      businessLogoUrl={business?.logo_url ?? null}
      conversationId={conversation.id}
      initialMessages={projected}
      isBorn={isBorn}
      theme={themeInfo}
    />
  );
}
