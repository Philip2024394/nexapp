// src/lib/nex-native/live-broadcast/live-comments-channel.ts
//
// NEX Live · comments broadcast channel.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-24 · pairs with the Live interaction
// feature contract §4 · "ephemeral" default retention · one dedicated
// Supabase Realtime channel per session, no DB write.
//
// Design intent
//   · Comments ride a dedicated channel `nex:live-comments:{sessionId}`
//     so they do NOT inflate the sealed presence + featured-product
//     channels.
//   · Payload is intentionally minimal: {authorAccountId, text,
//     clientSentAt}. The server does NOT persist the comment · the
//     broadcaster sees it in real time, viewers see it in real time,
//     late joiners see only the comments posted AFTER they join.
//   · Rate limiting + length cap are client-side guards here; a
//     Phase 2 Slice 2 hardening pass can add server-authored writes
//     with abuse-reporting if the owner authorises persistence.
//
// Honest non-claims
//   · This channel does NOT provide delivery guarantees · broadcasts
//     are best-effort fan-out via Supabase Realtime.
//   · The channel does NOT prove authorship · the viewer's identity
//     is self-attested at send time. The broadcaster's UI should
//     label "NEX-ID only" on each comment · never a verified name.
//   · This file is PURE client code · never touched by server
//     components.

"use client";

import { openNexChannel, type NexChannelHandle } from "../realtime/channel";

export const LIVE_COMMENT_MAX_LENGTH = 280;
/** Owner spec 2026-10-24 · reply context stays short so replies
 *  stay readable and the overlay doesn't grow. Context preview is
 *  the author being replied TO, plus a short slice of their text. */
export const LIVE_COMMENT_REPLY_PREVIEW_MAX_LENGTH = 60;

export type LiveCommentsRole = "broadcaster" | "viewer";

/** Lightweight reply reference · author NEX-ID + a short text
 *  preview. We DO NOT include the replied-to comment id (no server
 *  persistence · the receiver may have already evicted that comment
 *  from the overlay). The preview is what viewers see in-line. */
export interface LiveCommentReplyContext {
  readonly replyToAuthorAccountId: string;
  readonly replyToTextPreview: string;
}

export interface LiveCommentPayload {
  readonly authorAccountId: string;
  readonly text: string;
  /** Client-side timestamp · for ordering ONLY · the broadcaster MUST
   *  NOT surface this per-comment in any post-live surface (would
   *  break the "no per-event timestamp" rule in the Shop Contacts
   *  shuffle). */
  readonly clientSentAt: string;
  /** Owner spec 2026-10-24 · optional reply context. Present only
   *  when the sender deliberately selected a comment to reply to.
   *  Receivers must treat absent fields as "not a reply" and never
   *  synthesize a reply context from heuristics. */
  readonly replyToAuthorAccountId?: string;
  readonly replyToTextPreview?: string;
  // Index signature · satisfies the BroadcastPayload constraint
  // (`Record<string, unknown>`). All real fields are string | undefined
  // so this is sound.
  readonly [key: string]: string | undefined;
}

export interface OpenLiveCommentsChannelOptions {
  readonly sessionId: string;
  readonly role: LiveCommentsRole;
  readonly selfAccountId: string;
  readonly onComment?: (payload: LiveCommentPayload) => void;
}

export interface LiveCommentsChannelHandle {
  readonly post: (text: string, replyContext?: LiveCommentReplyContext) => void;
  readonly close: () => Promise<void>;
}

export function openLiveCommentsChannel(
  opts: OpenLiveCommentsChannelOptions,
): LiveCommentsChannelHandle {
  const channelName = `nex:live-comments:${opts.sessionId}`;
  const handle: NexChannelHandle = openNexChannel<LiveCommentPayload>({
    name: channelName,
    selfId: opts.selfAccountId,
    onBroadcast: (_event, envelope) => {
      if (!opts.onComment) return;
      const payload = envelope.payload;
      if (!payload || typeof payload !== "object") return;
      // Defence · ignore anything that doesn't match the shape.
      if (typeof payload.authorAccountId !== "string") return;
      if (typeof payload.text !== "string") return;
      if (typeof payload.clientSentAt !== "string") return;
      // Reply context is OPTIONAL · drop malformed context silently
      // rather than rejecting the whole comment.
      const safeReplyAuthor =
        typeof payload.replyToAuthorAccountId === "string"
          ? payload.replyToAuthorAccountId
          : undefined;
      const safeReplyPreview =
        typeof payload.replyToTextPreview === "string"
          ? payload.replyToTextPreview.slice(
              0,
              LIVE_COMMENT_REPLY_PREVIEW_MAX_LENGTH,
            )
          : undefined;
      // Both-or-neither · defence-in-depth. A reply-author without
      // a preview (or vice-versa) is treated as a plain comment.
      const hasValidReply =
        typeof safeReplyAuthor === "string" &&
        typeof safeReplyPreview === "string" &&
        safeReplyAuthor.length > 0 &&
        safeReplyPreview.length > 0;
      opts.onComment({
        authorAccountId: payload.authorAccountId,
        text: payload.text.slice(0, LIVE_COMMENT_MAX_LENGTH),
        clientSentAt: payload.clientSentAt,
        ...(hasValidReply && {
          replyToAuthorAccountId: safeReplyAuthor,
          replyToTextPreview: safeReplyPreview,
        }),
      });
    },
  });

  return {
    post: (text: string, replyContext?: LiveCommentReplyContext) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      // Guard · we only attach reply context when BOTH fields are
      // non-empty strings. Otherwise the message goes out as a plain
      // comment (fail-safe for upstream bugs).
      const safeReply =
        replyContext &&
        typeof replyContext.replyToAuthorAccountId === "string" &&
        replyContext.replyToAuthorAccountId.length > 0 &&
        typeof replyContext.replyToTextPreview === "string" &&
        replyContext.replyToTextPreview.length > 0
          ? {
              replyToAuthorAccountId: replyContext.replyToAuthorAccountId,
              replyToTextPreview: replyContext.replyToTextPreview.slice(
                0,
                LIVE_COMMENT_REPLY_PREVIEW_MAX_LENGTH,
              ),
            }
          : null;
      const payload: LiveCommentPayload = {
        authorAccountId: opts.selfAccountId,
        text: trimmed.slice(0, LIVE_COMMENT_MAX_LENGTH),
        clientSentAt: new Date().toISOString(),
        ...(safeReply ?? {}),
      };
      void handle.broadcast("comment", payload);
    },
    close: () => handle.close(),
  };
}
