// src/app/nex-native/contacts/_pending-invites-mock.ts
//
// Mock-complete invite store · owner directive 2026-10-23 "build
// ship connect all four and make contacts page fully operational".
//
// Scope deliberately mock-only · no DB, no server actions, no
// cross-device sync. State persists in localStorage so a refresh
// doesn't lose the user's work.
//
// Supports BOTH directions:
//   · outbound · the viewer sent → recipient must Accept
//   · inbound  · the viewer received → viewer taps Accept or Pass
//
// Doctrine (sealed Socials invite architecture 2026-10-07):
//   · 24h expiry from invitation CREATION (not from recipient notice)
//   · Sender always sees "Invitation expired" on timeout OR decline
//     (never leak explicit decline vs timeout · "Pass" is the recipient
//     word, "Expired" is the sender word · they resolve to the same
//     terminal state on the sender's screen)
//   · Recipient identity (display name) stays null on the sender card
//     until mutual accept · only NEX-ID shows pre-accept
//
// This module stays pure (no React) · the UI section wires it up
// with React state + localStorage sync.

export type PendingInviteDirection = "outbound" | "inbound";

/** Pre-accept lifecycle · the sender never learns whether an invite
 *  timed out or was passed · both resolve to `expired` on the sender's
 *  side. The recipient's `passed`/`expired` rows disappear from their
 *  inbox entirely (they chose to decline / let it lapse). */
export type PendingInviteStatus = "pending" | "expired";

/** Owner directive 2026-10-23 · "add the real contacts card with
 *  name - same as the contacts card". Inbound invites now carry the
 *  SENDER's identity so the recipient can see who's inviting them
 *  before tapping Confirm. This does NOT violate the sealed Socials
 *  invite doctrine 2026-10-07: that rule protects the INVITEE's
 *  identity from the SENDER pre-accept · the SENDER's identity has
 *  always been visible to the recipient (otherwise the recipient
 *  can't make an informed decision). */
export interface InboundInviteSenderIdentity {
  readonly displayName: string;
  readonly initials: string;
  readonly profession: string | null;
  readonly city: string | null;
  readonly isVerified: boolean;
  readonly avatarUrl: string | null;
  /** Owner directive 2026-10-23 · "shop if they have icon" · when the
   *  sender runs a shop the inbound invite card shows the 🛒 marker
   *  in the right slot (same position + chrome as accepted contact
   *  rows). The shopHref lets the recipient preview the shop before
   *  tapping Confirm. */
  readonly hasShop?: boolean;
  readonly shopHref?: string | null;
}

export interface PendingInvite {
  readonly id: string;
  /** The OTHER party's NEX-ID · on an outbound invite this is the
   *  recipient the sender typed · on an inbound invite this is the
   *  sender's public NEX-ID. */
  readonly nexId: string;
  readonly createdAt: string;
  readonly status: PendingInviteStatus;
  readonly direction: PendingInviteDirection;
  /** Only populated for `inbound` invites · the sender's identity so
   *  the recipient can decide whether to Confirm. Omitted on outbound
   *  (where identity-privacy still applies in that direction). */
  readonly senderIdentity?: InboundInviteSenderIdentity | null;
  /** Owner directive 2026-10-24 · "Contact Connect · also add text
   *  message with emoji" · optional sender-authored intro note that
   *  renders inside the recipient's inbound invite card. Max 160
   *  chars. Falls back to a prefilled greeting if the sender leaves
   *  the field empty. Private pre-accept (same posture as the invite
   *  itself · only the recipient sees it · NEX moderation only reads
   *  it if the recipient flags). */
  readonly note?: string | null;
  /** Owner directive 2026-10-24 · optional NEX-curated sticker glyph
   *  attached to the intro note. Unicode-only · pulled from the
   *  CURATED_STICKERS set below so the sender can't smuggle NSFW /
   *  PII / arbitrary uploads into the pre-accept surface. */
  readonly sticker?: string | null;
}

/** Owner directive 2026-10-24 · curated sticker set for the Contact
 *  Connect intro note. Unicode-only · pre-vetted glyphs so the sender
 *  can't attach arbitrary uploads or GIFs on the pre-accept surface
 *  (phase 2 adds Giphy/Tenor + user uploads behind a moderation
 *  pipeline). Keeping it small + warm · meet-in-person-and-connect
 *  vibe (rose, flowers, coffee, wave, smile, cheers, handshake). */
export const CURATED_STICKERS: ReadonlyArray<string> = [
  "👋", "🌹", "💐", "☕", "😊", "🤝",
  "🎉", "💌", "✨", "🙂", "🌸", "🥂",
];

/** The default greeting when the sender leaves the note field blank
 *  (owner directive 2026-10-24 · "we have prefilled message if they
 *  dont enter text short and to the point"). Short, friendly,
 *  informative — reads as "hi, I'd like to add you on NEX" without
 *  pressuring the recipient. */
export const DEFAULT_INVITE_NOTE = "Hi, let's connect on NEX.";

/** Clamp a sender-provided note to the sealed max length + strip
 *  anything that would break storage (newlines → spaces, trim ends).
 *  Pure · callable from both the Connect form submit path and the
 *  hydrate path. */
export function sanitiseInviteNote(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const squashed = raw.replace(/\s+/g, " ").trim();
  if (squashed.length === 0) return null;
  return squashed.slice(0, 160);
}

/** Validate a sticker glyph against the curated set · returns null
 *  for anything not in the whitelist (defends against future-you
 *  trying to persist a user-uploaded sticker here). */
export function sanitiseInviteSticker(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;
  if (!CURATED_STICKERS.includes(raw)) return null;
  return raw;
}

// ─── Seeds ──────────────────────────────────────────────────────
//
// Static offsets (no new Date() at module scope) so SSR + client
// hydration generate byte-identical module state. The real
// `createdAt` ISO is derived on the client via `hydrateSeedToInvite()`
// once after mount.

export interface PendingInviteSeed {
  readonly id: string;
  readonly nexId: string;
  readonly hoursSinceCreation: number;
  readonly status: PendingInviteStatus;
  readonly direction: PendingInviteDirection;
  readonly senderIdentity?: InboundInviteSenderIdentity | null;
  readonly note?: string | null;
  readonly sticker?: string | null;
}

/** Outbound seeds · what the viewer SENT · 22h, 3h, and one that just
 *  expired (so the sender sees the "Invitation expired" chrome on
 *  first paint without having to wait a day). */
export const MOCK_PENDING_INVITE_SEEDS: ReadonlyArray<PendingInviteSeed> = [
  {
    id: "out-1",
    nexId: "nex-23451",
    hoursSinceCreation: 2,
    status: "pending",
    direction: "outbound",
  },
  {
    id: "out-2",
    nexId: "nex-77281",
    hoursSinceCreation: 21,
    status: "pending",
    direction: "outbound",
  },
  {
    id: "out-3",
    nexId: "nex-88104",
    hoursSinceCreation: 25, // past the 24h · will be flipped to "expired" post-hydrate
    status: "pending",
    direction: "outbound",
  },
  // Inbound seeds · what the viewer RECEIVED · each one carries the
  // sender's full identity (name + initials + profession + city +
  // verified) so the recipient can see who's inviting them before
  // tapping Confirm. Owner directive 2026-10-23 · "real contacts
  // card with name".
  {
    id: "in-1",
    nexId: "nex-91205",
    hoursSinceCreation: 1,
    status: "pending",
    direction: "inbound",
    senderIdentity: {
      displayName: "Olivia Reyes",
      initials: "OR",
      profession: "Architect",
      city: "Jakarta",
      isVerified: true,
      // Owner directive 2026-10-23 · "profile image · the person
      // sending the invitation must displaying full card info and
      // image for the user to confirm". pravatar.cc serves stable
      // placeholder avatars seeded by the `u=` param (same URL →
      // same face). When real nex_account_profile.avatar_url lands,
      // swap these for live account photos.
      avatarUrl: "https://i.pravatar.cc/96?u=nex-91205",
      hasShop: false,
      shopHref: null,
    },
    note: "👋 Hey! Nice meeting you at the UGM talk yesterday — let's keep in touch.",
    sticker: null,
  },
  {
    id: "in-2",
    nexId: "nex-40011",
    // Owner directive 2026-10-23 · urgency threshold tightened to
    // 1h · seed bumped 22h → 23.5h so Mike's invite has ~30m left
    // on first paint · demonstrates the pulsing dark-red heartbeat
    // + minutes-only countdown immediately.
    hoursSinceCreation: 23.5,
    status: "pending",
    direction: "inbound",
    senderIdentity: {
      displayName: "Mike's Delivery",
      initials: "MD",
      profession: "Logistics",
      city: "Jakarta",
      isVerified: false,
      avatarUrl: "https://i.pravatar.cc/96?u=nex-40011",
      // Mike's Delivery is a business account · shop marker renders
      // on the inbound card so the recipient can preview the shop
      // before tapping Confirm.
      hasShop: true,
      shopHref: "/nex-native/shop-share-demo/nex-40011",
    },
    note: "🤝 Delivery driver on your Jl Malioboro route — happy to help if you ever need rush delivery.",
    sticker: null,
  },
];

/** Owner directive 2026-10-23 · self-healing seed merge · if the
 *  persisted invite list was stored BEFORE a seed field was added
 *  (e.g. older localStorage missing `senderIdentity`), walk the list
 *  and backfill any missing identity data by matching the invite's
 *  id against `MOCK_PENDING_INVITE_SEEDS`. Prevents the "cards show
 *  only NEX-ID" symptom that happens when the stored shape lags
 *  the current seed shape. Pure · idempotent.
 */
export function reconcileWithSeeds(
  invites: ReadonlyArray<PendingInvite>,
): ReadonlyArray<PendingInvite> {
  let changed = false;
  const next = invites.map((inv) => {
    const seed = MOCK_PENDING_INVITE_SEEDS.find((s) => s.id === inv.id);
    if (!seed) return inv;
    const needsIdentity =
      inv.direction === "inbound" &&
      inv.senderIdentity == null &&
      seed.senderIdentity != null;
    const needsNote = inv.note == null && seed.note != null;
    const needsSticker = inv.sticker == null && seed.sticker != null;
    if (!needsIdentity && !needsNote && !needsSticker) return inv;
    changed = true;
    return {
      ...inv,
      senderIdentity: needsIdentity ? seed.senderIdentity : inv.senderIdentity,
      note: needsNote ? sanitiseInviteNote(seed.note) : inv.note,
      sticker: needsSticker ? sanitiseInviteSticker(seed.sticker) : inv.sticker,
    };
  });
  return changed ? next : invites;
}

/** Convert a seed to a live invite · called post-mount only so the
 *  resulting `createdAt` is deterministic for the current render tree. */
export function hydrateSeedToInvite(
  seed: PendingInviteSeed,
  now: Date,
): PendingInvite {
  const createdAt = new Date(
    now.getTime() - seed.hoursSinceCreation * 60 * 60 * 1000,
  );
  return {
    id: seed.id,
    nexId: seed.nexId,
    createdAt: createdAt.toISOString(),
    status: seed.status,
    direction: seed.direction,
    senderIdentity: seed.senderIdentity ?? null,
    note: sanitiseInviteNote(seed.note ?? null),
    sticker: sanitiseInviteSticker(seed.sticker ?? null),
  };
}

// ─── Helpers ────────────────────────────────────────────────────

const INVITE_WINDOW_HOURS = 24;

/** Owner directive 2026-10-23 · "when the invitation time expire it
 *  does not show notice card, it silently disappears from the contacts
 *  page and blocks the user from sending another invite for up to 72
 *  hours". Chosen variant: visible for 24h after expiry (one honest
 *  notice), then auto-vanish. 72h cooldown runs from the moment of
 *  expiry (NOT from auto-vanish). */
const EXPIRED_VISIBILITY_HOURS = 24;
const COOLDOWN_HOURS = 72;

export function invitationMsLeft(invite: PendingInvite, now: Date = new Date()): number {
  const created = new Date(invite.createdAt).getTime();
  const expiry = created + INVITE_WINDOW_HOURS * 60 * 60 * 1000;
  return Math.max(0, expiry - now.getTime());
}

export function formatInviteCountdown(invite: PendingInvite, now: Date = new Date()): string {
  const ms = invitationMsLeft(invite, now);
  if (ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }
  if (totalMinutes >= 1) return `${totalMinutes}m`;
  return "<1m";
}

export function isValidNexIdShape(raw: string): boolean {
  return /^nex-\d{2,}$/i.test(raw.trim());
}

export function invitationElapsedPercent(
  invite: PendingInvite,
  now: Date = new Date(),
): number {
  const created = new Date(invite.createdAt).getTime();
  const windowMs = INVITE_WINDOW_HOURS * 60 * 60 * 1000;
  const elapsed = now.getTime() - created;
  if (elapsed <= 0) return 0;
  if (elapsed >= windowMs) return 100;
  return (elapsed / windowMs) * 100;
}

export function formatCompactTimeRemaining(
  invite: PendingInvite,
  now: Date = new Date(),
): string {
  const ms = invitationMsLeft(invite, now);
  if (ms <= 0) return "0";
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes >= 60) return `${Math.floor(totalMinutes / 60)}h`;
  if (totalMinutes >= 1) return `${totalMinutes}m`;
  return "<1m";
}

export function normaliseNexId(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Walk the invite list and flip any `pending` row that's past its
 *  24h window to `expired`. Pure · caller supplies `now` + persists
 *  the result. Called on mount + every 60s tick. Also culls expired
 *  invites past the 72h cooldown ceiling · at that point they no
 *  longer block re-invites so there's no reason to keep them in
 *  storage. */
export function applyExpiry(
  invites: ReadonlyArray<PendingInvite>,
  now: Date = new Date(),
): ReadonlyArray<PendingInvite> {
  let changed = false;
  const next: PendingInvite[] = [];
  for (const inv of invites) {
    if (inv.status === "pending") {
      if (invitationMsLeft(inv, now) > 0) {
        next.push(inv);
      } else {
        changed = true;
        next.push({ ...inv, status: "expired" as const });
      }
      continue;
    }
    // Expired · drop once past the 72h cooldown ceiling.
    const totalLifespanMs =
      (INVITE_WINDOW_HOURS + COOLDOWN_HOURS) * 60 * 60 * 1000;
    const created = new Date(inv.createdAt).getTime();
    if (now.getTime() - created > totalLifespanMs) {
      changed = true;
      continue;
    }
    next.push(inv);
  }
  return changed ? next : invites;
}

/** Owner directive 2026-10-23 · expired outbound invites stay visible
 *  for 24h after expiry so the sender gets ONE honest "Invitation
 *  expired" notice · then they auto-vanish. Returns true while the
 *  invite should still render as an expired card. */
export function isExpiredCardVisible(
  invite: PendingInvite,
  now: Date = new Date(),
): boolean {
  if (invite.status !== "expired") return false;
  const created = new Date(invite.createdAt).getTime();
  const vanishAt =
    created +
    (INVITE_WINDOW_HOURS + EXPIRED_VISIBILITY_HOURS) * 60 * 60 * 1000;
  return now.getTime() < vanishAt;
}

/** Owner directive 2026-10-23 · "blocks the user from sending another
 *  invite for up to 72 hours". Returns the milliseconds remaining on
 *  the cooldown for THIS invite · 0 when the cooldown is over. Caller
 *  checks every outbound invite (any status) for the target NEX-ID
 *  and uses the longest-remaining cooldown. */
export function cooldownMsLeft(
  invite: PendingInvite,
  now: Date = new Date(),
): number {
  if (invite.status !== "expired") return 0;
  const created = new Date(invite.createdAt).getTime();
  const cooldownEndsAt =
    created +
    (INVITE_WINDOW_HOURS + COOLDOWN_HOURS) * 60 * 60 * 1000;
  return Math.max(0, cooldownEndsAt - now.getTime());
}

/** Human-readable cooldown remaining · "47h" / "12m" / "<1m". Used
 *  in the Connect-by-NEX-ID error line. */
export function formatCooldownRemaining(ms: number): string {
  if (ms <= 0) return "0";
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes >= 60) {
    const h = Math.ceil(totalMinutes / 60);
    return `${h}h`;
  }
  if (totalMinutes >= 1) return `${totalMinutes}m`;
  return "<1m";
}

// ─── localStorage persistence ───────────────────────────────────
//
// Owner directive 2026-10-23 · "fully operational" build · mock state
// must survive page refresh. Keyed to a schema version so a future
// shape change can bump the version + ignore stale rows safely.

// v2 · 2026-10-23 · silent-expiry policy (expired cards never render
// on sender side). Bumping the key force-clears any stale v1 state
// that had the expired-visible-24h behaviour · prevents the old
// NEX-88104 "Invitation expired" card from surfacing on reload.
const STORAGE_KEY = "nex-contacts-pending-invites-v2";

/** Serialise to localStorage · no-op outside the browser. */
export function persistInvites(invites: ReadonlyArray<PendingInvite>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invites));
  } catch {
    // Quota or private-mode errors are silently ignored · the mock
    // just degrades to in-memory state for the session.
  }
}

/** Load from localStorage · returns null when nothing persisted or
 *  the stored data fails a basic shape check. */
export function loadPersistedInvites(): ReadonlyArray<PendingInvite> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (row): row is PendingInvite =>
        row &&
        typeof row.id === "string" &&
        typeof row.nexId === "string" &&
        typeof row.createdAt === "string" &&
        (row.status === "pending" || row.status === "expired") &&
        (row.direction === "outbound" || row.direction === "inbound"),
    );
    // `senderIdentity` is passed through as-is · validation is
    // deliberately loose because the field only renders on inbound
    // and the renderer treats missing / malformed as a graceful fallback
    // (shows NEX-ID only, no name block).
    return valid;
  } catch {
    return null;
  }
}
