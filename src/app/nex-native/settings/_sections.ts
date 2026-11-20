// src/app/nex-native/settings/_sections.ts
//
// NEX Settings · Information Architecture · sealed 2026-10-06.
// --------------------------------------------------------------
// Single source of truth for the Settings landing's grouped rows.
// Pure data · no React imports · so tests can read the IA without
// rendering anything and verify every route exists.
//
// Groups follow the founder-sealed Phase 1 architecture (§4):
//   · Your account
//   · Your NEX
//   · Messages
//   · Privacy & Safety
//   · Storage & Data
//   · Payments & NEX Wallet
//   · Help
//
// Each row either links to an existing route OR links to a Phase 1
// placeholder page that honestly declares "Coming soon" (per §28).
// No row is a dead link.

export interface SettingsRowDef {
  readonly key: string;
  readonly href: string | null;
  readonly emoji: string;
  readonly title: string;
  readonly subtitle: string;
  readonly comingSoon?: boolean;
  readonly highlighted?: boolean;
  /**
   * When present, the row is rendered as a button that triggers a
   * client-side action rather than navigating. Currently supports:
   *   · "open-notifications-drawer" · opens the canonical LEFT
   *     notifications drawer already mounted by the app shell.
   * Rows with an actionKind must set href:null.
   */
  readonly actionKind?: "open-notifications-drawer";
}

export interface SettingsGroupDef {
  readonly key: string;
  readonly label: string;
  readonly rows: readonly SettingsRowDef[];
}

export const SETTINGS_GROUPS: readonly SettingsGroupDef[] = [
  {
    key: "account",
    label: "Your account",
    rows: [
      {
        key: "profile",
        href: "/nex-native/settings/profile",
        emoji: "🪪",
        title: "Profile",
        subtitle: "Your name, profile, bio and public information",
      },
      {
        key: "plan",
        href: "/nex-native/settings/tier",
        emoji: "🎯",
        title: "Your NEX plan",
        subtitle: "Your current plan and available upgrades",
      },
      {
        key: "language",
        href: "/nex-native/settings/language",
        emoji: "🌐",
        title: "Language",
        subtitle: "Choose Bahasa Indonesia or English",
      },
    ],
  },
  {
    key: "your-nex",
    label: "Your NEX",
    rows: [
      {
        key: "nex-socials",
        // 2026-10-15 · owner-directed · Settings link now leads to the
        // "Coming Soon" intro landing (/nex-socials/intro) rather than
        // the sealed chooser (/nex-socials). The sealed chooser is
        // unchanged and still reachable at its URL for internal
        // testing + any existing deep links.
        href: "/nex-native/nex-socials/intro",
        emoji: "🌃",
        title: "NEX Socials",
        subtitle:
          "Business · new friends · dating · night life · everyone around you",
        highlighted: true,
      },
      {
        key: "chat-world",
        href: "/nex-native/chat-themes-library",
        emoji: "🌊",
        title: "Chat World",
        subtitle: "Choose the World that shapes your chat",
      },
      {
        // See-My-Theme (sealed 2026-10-16) · dedicated per-contact
        // theme-visibility card. Owner directive: "Chat World selects
        // your theme; See My Theme controls where that theme is shown."
        // Links to a searchable accepted-friends list; each row has an
        // ON/OFF toggle. The AND-rule gate at
        // src/app/nex-native/chat/peer/[accountId]/page.tsx enforces
        // the resolved visibility · the toggle NEVER modifies the
        // viewer's own `chat_theme` column.
        key: "see-my-theme",
        href: "/nex-native/settings/see-my-theme",
        emoji: "🎨",
        title: "See My Theme",
        subtitle: "Choose which contacts see your personal chat theme",
      },
      // 2026-11-17 · founder-directed removal. "World Intro" and
      // "Custom Intro" rows were dead-link entries pointing at
      // /nex-native/settings/world-intro + /custom-intro, neither of
      // which exists on disk. Removed from the Settings landing per the
      // Settings Correction prompt. The underlying intro-video feature
      // (sealed elsewhere in the shop + chat shell) is NOT affected by
      // this removal · only the broken Settings entry points are gone.
      {
        // Owner directive 2026-11-11 (Cycle 41) · surface the real
        // chat-background-sync preference page. Ties the shop cover
        // image and the chat background together in either direction;
        // each direction is independent. Natural neighbour of Chat
        // World and the intro rows.
        key: "chat-background-sync",
        href: "/nex-native/settings/chat-background-sync",
        emoji: "🖼️",
        title: "Background sync",
        subtitle: "Link your shop cover to your chat background",
        comingSoon: false,
      },
    ],
  },
  {
    key: "messages",
    label: "Messages",
    rows: [
      {
        // 2026-10-15 · Stage 3 graduation. The Notifications surface
        // was authored against the sealed push-subscription-service
        // (migration 098) + the new preferences table (migration 198)
        // + the sealed notification-dispatch-service (which enforces
        // the Vault boundary server-side and fails CLOSED for every
        // category when prefs cannot be read). Scope note: the
        // preferences UI is functional today · no event source wires
        // to the dispatch helper yet (deferred to Stage 3b).
        // 2026-11-17 · founder-directed · the Notifications row now
        // opens the canonical LEFT notifications drawer (the same
        // drawer the header bell opens) rather than navigating to a
        // non-existent /settings/notifications page. Rendered as a
        // button that dispatches `nex:open-notifications-drawer` via
        // window CustomEvent · the drawer subscribes on mount.
        key: "notifications",
        href: null,
        actionKind: "open-notifications-drawer",
        emoji: "🔔",
        title: "Notifications",
        subtitle: "Control message, call and other NEX notifications",
        comingSoon: false,
      },
      {
        // 2026-10-15 · R9 Stage 4 graduation. Replaces the ComingSoon
        // shell with a real preferences surface backed by migration 199
        // (AUTHORED · NOT YET APPLIED). Four controls: reciprocal
        // read receipts · typing indicator · last-seen visibility ·
        // online-status visibility. Enforcement patches wired at
        // peer-message-service.markPeerMessagesRead (write gate) +
        // peer-message/since route (reciprocity filter) + sealed
        // typing/presence channels (opt-flag prop pass-through).
        key: "chat-settings",
        href: "/nex-native/settings/chat-settings",
        emoji: "💬",
        title: "Chat settings",
        subtitle:
          "Read receipts, online status, typing visibility and chat behaviour",
        comingSoon: false,
      },
      {
        // Owner directive 2026-11-11 (Cycle 40) · surface the
        // disappearing-messages preference page that was already built
        // but never linked from the Settings landing. Real route at
        // /nex-native/settings/disappearing-messages renders a per-
        // account default timer the user chooses for their own
        // outgoing messages; the server deletes them when the timer
        // elapses. Each contact's inbound messages honour that
        // contact's own default.
        key: "disappearing-messages",
        href: "/nex-native/settings/disappearing-messages",
        emoji: "⏳",
        title: "Disappearing messages",
        subtitle: "Set a default timer for messages you send",
        comingSoon: false,
      },
      {
        // Owner directive 2026-11-11 (Cycle 41) · surface the chat-
        // font preference page. Lets the viewer pick the font used in
        // their own chat UI. Reads/writes the account's chat_font
        // column only · not applied to other users' chats.
        key: "chat-font",
        href: "/nex-native/settings/chat-font",
        emoji: "🔤",
        title: "Chat font",
        subtitle: "Pick the font used in your chat",
        comingSoon: false,
      },
    ],
  },
  {
    key: "privacy-safety",
    label: "Privacy & Safety",
    rows: [
      {
        // 2026-10-15 · R10 Stage 5 graduation. Replaces the ComingSoon
        // shell with a real preferences surface backed by migration 200
        // (AUTHORED · NOT YET APPLIED). Two controls: 3-level
        // profile_visibility (public/contacts/private) and 2-level
        // who_can_message (everyone/contacts). who_can_call deferred.
        // Enforcement at peer-conversation-service.
        // getOrCreatePeerConversationAsSender (new gated wrapper) +
        // resolveProfileVisibilityForViewer helper for viewer-aware
        // profile reads. is_discoverable remains a separate axis on
        // nex_account_profile per owner directive.
        key: "privacy",
        href: "/nex-native/settings/privacy",
        emoji: "🛡️",
        title: "Privacy",
        subtitle: "Who can see your information and how people contact you",
        comingSoon: false,
      },
      {
        // 2026-10-15 · Stage 1 graduation. The Settings/Blocked UI
        // was authored against the sealed `friend-service.listBlockedByMe`
        // + `unblockAccount` surface. Owner directive: label the row
        // "Blocked contacts" (NOT "Blocked & restricted") because the
        // current backend only implements the block state · restricted
        // is not yet a product rule.
        key: "blocked",
        href: "/nex-native/settings/blocked",
        emoji: "🚫",
        title: "Blocked contacts",
        subtitle: "Manage people you've blocked",
        comingSoon: false,
      },
      {
        // 2026-10-15 · Phase 0 honest-flag correction. The Security
        // surface GRADUATED out of the Coming Soon shell on 2026-10-06
        // (see _settings-ia.test.ts § F note at line 193-197). The IA
        // flag was never flipped from the pre-graduation default. This
        // row is now rendered as a live, clickable entry on the
        // Settings landing.
        key: "security",
        href: "/nex-native/settings/security",
        emoji: "🔐",
        title: "Security",
        subtitle: "Account and sign-in security",
        comingSoon: false,
      },
      {
        // Owner directive 2026-11-11 (Cycle 41) · surface the chat-
        // protection preference page. Viewer-side screenshot + copy
        // block: when ON, the chat UI blocks text selection, right-
        // click, and the copy keyboard shortcut on YOUR screen.
        // Honest copy about scope (it's a viewer-side guard, not a
        // server-enforced DRM).
        key: "chat-protection",
        href: "/nex-native/settings/chat-protection",
        emoji: "🛡️",
        title: "Screenshot & copy protection",
        subtitle: "Block screenshot and copy inside your chat",
        comingSoon: false,
      },
    ],
  },
  {
    key: "storage-data",
    label: "Storage & Data",
    rows: [
      {
        // Settings → Storage & Data → Vault · the user-facing doorway
        // into Vault. Authorised 2026-10-07 as part of the B.4 follow-
        // up because the Vault chat surface at /vault/home/chats/
        // [conversationId] was otherwise unreachable from Settings.
        //
        // The row title is deliberately "Vault" (not "Storage") and the
        // subtitle avoids any commercial reference (no GB figures, no
        // Bisnis, no pricing · those are sealed Phase E scope). The
        // older storage/page.tsx file is intentionally left on disk as
        // an orphaned route · touching it is forbidden until Phase E.
        // 2026-10-15 · Phase 0 destination correction. The sealed
        // Vault state resolver at `/nex-native/vault` is the correct
        // doorway: it reads the user's state (no session → sign-in,
        // no setup → intro, locked → PIN, unlocked → /vault/home) and
        // routes accordingly. Linking directly to `/vault/home` would
        // bypass the intro + state-aware routing. Owner-authorised
        // destination for the Settings landing's Vault row.
        key: "vault",
        href: "/nex-native/vault",
        emoji: "🔐",
        title: "Vault",
        subtitle: "Your private space for chats and files.",
        comingSoon: false,
      },
      {
        // 2026-10-15 · R14 Stage 6 graduation. Replaces the ComingSoon
        // shell with a real preferences surface backed by migration 201
        // (AUTHORED · NOT YET APPLIED). Four controls: per-media auto-
        // download (images/videos/audio × always/wifi_only/never) +
        // upload quality (standard/HD). Wi-Fi detection is best-effort
        // via navigator.connection. Data export remains honestly
        // unavailable pending email + background-job infrastructure
        // decisions (see docs/architecture/data-export-phase-2.md).
        // 2026-11-17 · founder-directed Storage & Data unification.
        // Settings "Data usage" and Shop Settings "Storage" now lead
        // to the same canonical Storage experience at
        // /nex-native/settings/storage. The old `/data-usage` route is
        // preserved as a compatibility redirect (see
        // /settings/data-usage/page.tsx) so any inbound deep-links or
        // bookmarks still land the user in the right place.
        key: "data-usage",
        href: "/nex-native/settings/storage",
        emoji: "📶",
        title: "Storage & Data",
        subtitle: "Shop storage, bandwidth and how NEX uses your data",
        comingSoon: false,
      },
    ],
  },
  {
    key: "payments-wallet",
    label: "Payments & NEX Wallet",
    rows: [
      {
        // Owner directive 2026-11-11 (Cycle 41) · surface the payment
        // provider setup page from Settings in addition to the drawer
        // link. Lets sellers connect Stripe / PayPal / QR codes for
        // receiving payments on their shop orders.
        key: "payments",
        href: "/nex-native/settings/payments",
        emoji: "💳",
        title: "Payment providers",
        subtitle: "Connect Stripe, PayPal and QR codes to receive payments",
        comingSoon: false,
      },
      {
        key: "wallet",
        href: null,
        emoji: "⚡",
        title: "Power tokens & wallet",
        subtitle: "Earn · spend · tip · affiliate commissions · chat boosts",
        comingSoon: true,
      },
      // 2026-11-17 · founder-directed removal. The "Earn with NEX ·
      // Affiliate" row has been removed from the Settings landing.
      // The affiliate feature itself (if/when re-authored) is out of
      // the current launch scope; the Settings doorway was removed
      // per the Settings Correction prompt.
    ],
  },
  {
    key: "help",
    label: "Help",
    rows: [
      {
        // 2026-10-15 · Stage 2 graduation. Replaced the ComingSoon
        // shell with a real landing that routes users to the sealed
        // NEX1 support chat (NEX_OFFICIAL_CHAT_HREF with
        // intent=help_support). No invented FAQ · content is honest.
        key: "help",
        href: "/nex-native/settings/help",
        emoji: "❓",
        title: "Help & support",
        subtitle: "Get help with NEX",
        comingSoon: false,
      },
      // 2026-11-17 · founder-directed removal. The "About NEX" row
      // has been removed from the Settings landing per the Settings
      // Correction prompt. The underlying /settings/about page
      // remains on disk but is no longer surfaced in Settings.
    ],
  },
] as const;

/** Flat list of every settings row across every group · lets tests
 *  assert each href is reachable without walking the group tree. */
export const ALL_SETTINGS_ROWS: readonly SettingsRowDef[] =
  SETTINGS_GROUPS.flatMap((g) => g.rows);
