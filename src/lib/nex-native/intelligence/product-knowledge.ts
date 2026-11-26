// src/lib/nex-native/intelligence/product-knowledge.ts
//
// Bridge 92 · NEX Product Knowledge (Phase 1 · authoritative,
// versioned-in-code).
// -------------------------------------------------------------------
// This is the NEX Product Knowledge Model referenced by the audit
// brief. Every entry is a NEX-owned authoritative fact about how the
// NEX Chat product actually works today — versioned as code so any
// drift between docs and product goes through code review.
//
// Scope (Phase 1 only · per the extension brief):
//   · Features · what the product does + who can use it
//   · Plans · what's included + limits + upgrade path
//   · Workflows · step-by-step how the user actually gets somewhere
//
// Explicitly OUT of scope for Phase 1 (documented in the report):
//   · Telemetry event ingestion              (Phase 2)
//   · Explicit feedback capture             (Phase 2)
//   · Friction detection                    (Phase 3)
//   · Support-pattern analysis              (Phase 3)
//   · Improvement proposal ledger           (Phase 4)
//   · Experiment framework                  (Phase 4)
//   · NEX-assisted engineering proposals    (Phase 5)
//
// Rules:
//   · Every entry has an id, keywords, and content that the gateway
//     can retrieve + score + cite
//   · Entries carry `sealed_at` so the model output can note when a
//     fact was last verified in code
//   · No entry may state a plan feature or entitlement the current
//     production code doesn't actually enforce · if it does, fix the
//     code or fix the entry BEFORE the mismatch reaches a user
//   · This module is client-safe (no server-only import) so both the
//     gateway (server) and future admin views (client) can consume it

import type { NexAccountTier, NexSubscriptionPlan } from "../types";

export type ProductKnowledgeKind = "feature" | "plan" | "workflow";

export interface ProductKnowledgeEntry {
  id: string;
  kind: ProductKnowledgeKind;
  title: string;
  /** Concise description the retriever will show to the model. Kept
   *  under 400 chars so evidence bundles don't blow the context. */
  content: string;
  /** Tokens the retriever scores on. Keep to nouns + verbs the user
   *  is likely to type. */
  keywords: string[];
  /** When this entry was last audited against the running code. Format
   *  YYYY-MM-DD so the model can surface freshness. */
  sealed_at: string;
  /** For features · which plan grants access. For plans · self. For
   *  workflows · null (workflows are usually plan-agnostic). */
  required_plan?: NexAccountTier | null;
  /** For features · dependency features by id (a video call needs
   *  the peer chat feature to exist). Purely descriptive · gateway
   *  doesn't recursively expand this. */
  dependencies?: string[];
  /** For features + workflows · optional pointer at the NEX-native
   *  route where the user actually does this. */
  entry_href?: string;
}

// ─── Features ────────────────────────────────────────────────────────

export const NEX_FEATURES: readonly ProductKnowledgeEntry[] = [
  {
    id: "feature.peer_chat",
    kind: "feature",
    title: "Peer-to-peer chat",
    content:
      "Send text messages between two NEX users. Messages are end-to-end encrypted on your device before delivery when both parties have an active device key · if your contact's device isn't ready, the composer warns you before the message is sent as a standard (unencrypted) message. Server drops delivered ciphertext after 7 days (Bridge 78 purge). Your phone is the archive · if you lose it you lose the history.",
    keywords: ["chat", "message", "text", "send", "peer", "friend", "e2e", "encrypted"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    entry_href: "/nex-native/chat",
  },
  {
    id: "feature.encrypted_media",
    kind: "feature",
    title: "Encrypted photos, videos, and voice notes",
    content:
      "Personal images, video and voice notes sent in peer chat use client-side encryption when both devices are set up (Bridge 81). Documents currently use the standard attachment path (deferred to a later stage). The composer warns before sending if encryption can't complete so you can decide whether to proceed. Shop product images and restaurant menu photos stay server-hosted per the doctrine split so cold visitors can browse.",
    keywords: ["photo", "image", "video", "voice", "attachment", "encrypted", "media", "record"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    dependencies: ["feature.peer_chat"],
  },
  {
    id: "feature.voice_call",
    kind: "feature",
    title: "Voice call",
    content:
      "One-to-one voice calls over WebRTC (Bridge 68). Media flows peer-to-peer · never through NEX servers. Global incoming ring (Bridge 86) means the ring reaches you anywhere in NEX, not just when you're viewing that specific chat. Web Push wakes closed tabs / locked phones (Bridge 89b).",
    keywords: ["voice", "call", "ring", "phone", "webrtc"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    dependencies: ["feature.peer_chat"],
  },
  {
    id: "feature.video_call",
    kind: "feature",
    title: "Video call",
    content:
      "One-to-one video calls over WebRTC (Bridge 69). Full-bleed remote video with a mirrored local PIP top-right. Camera toggle mid-call. Same global ring + push wakeup as voice.",
    keywords: ["video", "call", "camera", "face", "webrtc"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    dependencies: ["feature.voice_call"],
  },
  {
    id: "feature.themes_base",
    kind: "feature",
    title: "Base themes (free forever)",
    content:
      "Five free chat themes always unlocked: Default, Titanium, Pink, Gold, Night. Your theme paints every conversation you're in · friends see your theme when they open your chat (theme-ownership doctrine).",
    keywords: ["theme", "look", "colour", "color", "style", "default", "titanium", "pink", "gold", "night"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    entry_href: "/nex-native/chat-themes-library",
  },
  {
    id: "feature.themes_premium",
    kind: "feature",
    title: "Premium themes",
    content:
      "Bisnis unlocks all premium themes: Night Sky, Pink Dream, and future drops. Every premium theme ships with its own mascot, bubble style, and wallpaper. 7-day free trial available once per account.",
    keywords: ["theme", "premium", "night", "sky", "pink", "dream", "mascot", "wallpaper", "trial"],
    sealed_at: "2026-09-29",
    required_plan: "bisnis",
    entry_href: "/nex-native/chat-themes-library",
  },
  {
    id: "feature.themes_trial",
    kind: "feature",
    title: "7-day premium themes trial",
    content:
      "Once per account you can try Bisnis-tier premium themes free for 7 days. Trial unlocks every premium theme + mascot for the window. After the trial expires the account drops back to Gratis unless the buyer subscribed.",
    keywords: ["trial", "free", "seven", "days", "try", "premium", "theme"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    entry_href: "/nex-native/settings/tier",
  },
  {
    id: "feature.presence",
    kind: "feature",
    title: "Live presence",
    content:
      "Green Online / amber Busy / grey Offline · per conversation only (Bridge 83 scoped to per-conversation channels so the roster doesn't grow with DAU). Presence updates in real time via Supabase Realtime.",
    keywords: ["online", "offline", "presence", "status", "green", "away", "busy"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    dependencies: ["feature.peer_chat"],
  },
  {
    id: "feature.typing_indicator",
    kind: "feature",
    title: "Typing indicator",
    content:
      "See a small pill with three bouncing dots when the peer is composing (Bridge 70). Debounced 500ms · auto-clears after 3 seconds of silence.",
    keywords: ["typing", "composing", "dots"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    dependencies: ["feature.peer_chat"],
  },
  {
    id: "feature.reactions",
    kind: "feature",
    title: "Message reactions",
    content:
      "Six quick reactions: ❤️ 👍 😂 😮 😢 🙏. Tap the small smile chip on any message to open the picker. Reactions render as a chip row under the message with a count.",
    keywords: ["reaction", "emoji", "heart", "like", "tapback"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    dependencies: ["feature.peer_chat"],
  },
  {
    id: "feature.read_ticks",
    kind: "feature",
    title: "Read receipt ticks",
    content:
      "Single grey ✓ when the message left your device. Double blue ✓✓ when the peer opens the chat. Updates live via realtime (Bridge 73) · sender sees the flip without reloading.",
    keywords: ["read", "receipt", "tick", "seen", "checkmark", "delivered"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    dependencies: ["feature.peer_chat"],
  },
  {
    id: "feature.nex_id",
    kind: "feature",
    title: "Your NEX ID (nex-XXXXX)",
    content:
      "Every account gets an auto-assigned NEX ID like nex-10247 · sequential from 10000, guaranteed unique. Share this so friends can find you. Phone number stays private and is only used for signup + password reset.",
    keywords: ["id", "handle", "nex-id", "share", "add", "friend"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    entry_href: "/nex-native/settings/profile",
  },
  {
    id: "feature.display_name",
    kind: "feature",
    title: "Editable display name with emoji",
    content:
      "Your display name is what friends see on your messages. Freely editable · emoji welcome (e.g. Aisha 📷) · 2–40 characters (Bridge 80 · migration 095 CHECK enforces this at DB level).",
    keywords: ["name", "display", "username", "emoji"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    entry_href: "/nex-native/settings/profile",
  },
  {
    id: "feature.business_chat",
    kind: "feature",
    title: "Business chat with NEX Assistant replies",
    content:
      "Customers who message a business get an automated first-reply from NEX Assistant (in-process 0.5B model with retrieval-grounded prompts · Bridge 91). The business owner still sees and answers personally · NEX Assistant just doesn't leave customers waiting.",
    keywords: ["business", "shop", "assistant", "reply", "customer"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
  },
  {
    id: "feature.shop_landing",
    kind: "feature",
    title: "Public shop / menu landing",
    content:
      "The public business cover surface was retired 2026-11-06. A replacement destination for cold visitors is pending — until then, only authenticated discovery paths reach a business.",
    keywords: ["shop", "landing", "public", "menu", "browse", "product"],
    sealed_at: "2026-11-06",
    required_plan: "gratis",
  },
  {
    id: "feature.direct_price_ladder",
    kind: "feature",
    title: "NEX Direct Price loyalty ladder",
    content:
      "Sellers set a per-order tier discount ladder + share-to-earn bonuses (max cap 15%). Buyers see savings vs typical delivery apps (never named). Discounts stack up to the seller's cap. Share bonuses (+5% peer / +7% group) within a 48h window with 7-day anti-spam.",
    keywords: ["price", "discount", "ladder", "loyalty", "share", "earn", "bonus"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
  },
  {
    id: "feature.zero_knowledge_doctrine",
    kind: "feature",
    title: "Zero-knowledge architecture",
    content:
      "NEX servers cannot read personal peer chat content · they only relay encrypted bytes. Calls are peer-to-peer WebRTC. Shop product images stay public. Losing your phone means losing your NEX history (we can't restore it because we don't hold it).",
    keywords: ["privacy", "encryption", "e2e", "zero-knowledge", "phone", "database", "backup"],
    sealed_at: "2026-09-29",
    required_plan: "gratis",
    entry_href: "/nex-native/about/privacy",
  },
];

// ─── Plans ───────────────────────────────────────────────────────────

export const NEX_PLANS: readonly ProductKnowledgeEntry[] = [
  // Owner-sealed 2026-11-08 (round 29) · supersedes the seven-tier
  // Indonesia model sealed 2026-09-29. Single global Shop package at
  // €4.99 / £4.99 / $4.99 / Rp 89,000 with pay-as-you-grow capacity
  // packs. Chat stays free forever. Chat Themes remain one-time per
  // theme (regional pricing). Vault bundled with Shop.
  {
    id: "plan.chat_free",
    kind: "plan",
    title: "NEX Chat · free forever",
    content:
      "Chat is free for every NEX account, globally. Includes: unlimited peer chat, unlimited groups, 5 base themes, mascots, chat effects (send + receive), read receipts + presence, voice + video + group calls (free), NEX1 support chat. End-to-end encrypted. Device-local message storage. No phone number required.",
    keywords: ["free", "chat", "foundation", "always"],
    sealed_at: "2026-11-08",
    required_plan: "gratis",
    entry_href: "/nex-native/pricing",
  },
  {
    id: "plan.chat_themes",
    kind: "plan",
    title: "Chat Themes · one-time per theme",
    content:
      "Premium chat themes purchased one-time · yours forever. Prices by market: €3.49 (Europe) · £2.99 (UK) · $3.99 (US) · Rp 29,000 (Indonesia). Included free with any NEX Shop subscription.",
    keywords: ["themes", "chat themes", "theme pack", "one-time", "purchase"],
    sealed_at: "2026-11-08",
    entry_href: "/nex-native/chat-themes-library",
  },
  {
    id: "plan.nex_shop",
    kind: "plan",
    title: "NEX Shop · €4.99 / £4.99 / $4.99 / Rp 89,000 per month",
    content:
      "One global Shop package. Same features for every subscriber. Includes: 10 shop products, 3 shop videos, 1 GB storage, 30 GB monthly delivery, Chat Themes, Vault, 0% commission on sales. Grow with +5 / +10 / +25 GB storage packs (from €1.80/mo) and +30 / +100 / +300 GB bandwidth packs (from €2.69/mo). Cancel any time · 30-day read-only grace on cancel · 10% bandwidth grace before enforcement. Indonesia upgrade pack prices pending pilot data.",
    keywords: ["shop", "subscribe", "business", "pricing", "plan", "monthly", "upgrade", "storage", "bandwidth"],
    sealed_at: "2026-11-08",
    required_plan: "bisnis",
    entry_href: "/nex-native/pricing",
  },
];

// ─── Workflows ───────────────────────────────────────────────────────

export const NEX_WORKFLOWS: readonly ProductKnowledgeEntry[] = [
  {
    id: "workflow.signup",
    kind: "workflow",
    title: "Sign up for NEX",
    content:
      "Go to /nex-native/sign-in?mode=signup. Enter full name, email, phone (country code + digits), password (6+ chars). Phone is a credential attribute only · other users never see it. Your NEX ID (nex-XXXXX) is auto-assigned. NEX Assistant sends you a welcome message.",
    keywords: ["signup", "register", "create", "account", "new"],
    sealed_at: "2026-11-25",
    entry_href: "/nex-native/sign-in?mode=signup",
  },
  {
    id: "workflow.add_friend",
    kind: "workflow",
    title: "Add a friend by NEX ID",
    content:
      "Go to /nex-native/friends. Paste the friend's nex-XXXXX handle in the invite box (bare digits also work). Send invite · they get a notification on their side and can accept. Once accepted you can start a peer chat.",
    keywords: ["add", "friend", "invite", "connect"],
    sealed_at: "2026-09-29",
    entry_href: "/nex-native/friends",
  },
  {
    id: "workflow.send_message",
    kind: "workflow",
    title: "Send a text message",
    content:
      "Open a peer chat. Type in the composer. Press Enter or tap Send. If both parties have registered a device key the message is encrypted end-to-end. If not, a confirmation modal appears so you know you're sending standard (unencrypted) text (Bridge 90).",
    keywords: ["send", "message", "text", "chat"],
    sealed_at: "2026-09-29",
  },
  {
    id: "workflow.start_voice_call",
    kind: "workflow",
    title: "Start a voice call",
    content:
      "Open the peer chat · tap the phone icon top-left of the header. Grant microphone permission on first use. Peer sees Incoming call anywhere in NEX (global inbox · Bridge 86). Accept flows into the full-screen call overlay. Mute / hangup buttons at the bottom.",
    keywords: ["call", "voice", "ring", "phone", "microphone"],
    sealed_at: "2026-09-29",
  },
  {
    id: "workflow.start_video_call",
    kind: "workflow",
    title: "Start a video call",
    content:
      "Same as voice but tap the camera icon (right of the phone icon). Grant camera + mic permission. Local video shows as a mirrored PIP top-right; remote fills the screen. Camera toggle available mid-call.",
    keywords: ["video", "call", "camera", "face"],
    sealed_at: "2026-09-29",
  },
  {
    id: "workflow.try_premium_theme",
    kind: "workflow",
    title: "Try premium themes free for 7 days",
    content:
      "Go to /nex-native/settings/tier · tap the 'Try 7 days free' pill on any premium package card (Ringan / Bisnis). Trial starts immediately · every premium theme unlocked for 7 days. One trial per account · after expiry you drop to Gratis unless you subscribe.",
    keywords: ["trial", "seven", "days", "free", "premium", "theme", "try"],
    sealed_at: "2026-09-29",
    entry_href: "/nex-native/settings/tier",
  },
  {
    id: "workflow.change_theme",
    kind: "workflow",
    title: "Change your chat theme",
    content:
      "Go to /nex-native/chat-themes-library · tap any unlocked theme card. Selection saves immediately. Every friend sees your new theme when they open your chat (theme-ownership doctrine).",
    keywords: ["theme", "change", "switch", "pick", "select"],
    sealed_at: "2026-09-29",
    entry_href: "/nex-native/chat-themes-library",
  },
  {
    id: "workflow.subscribe_bisnis",
    kind: "workflow",
    title: "Subscribe to Bisnis",
    content:
      "Go to /nex-native/settings/tier · tap the Bisnis Subscribe button. That deep-links to the NEX1 support chat with an intent hint. NEX ops confirms your bank transfer / GoPay / QRIS receipt and activates your plan manually. Activation writes tier=bisnis + bisnis_expires_at.",
    keywords: ["subscribe", "bisnis", "upgrade", "buy", "plan"],
    sealed_at: "2026-09-29",
    entry_href: "/nex-native/settings/tier",
  },
  {
    id: "workflow.edit_display_name",
    kind: "workflow",
    title: "Edit your display name",
    content:
      "Go to /nex-native/settings/profile (Personal tab). The 'Your name' panel at the top has an input · type your new name (emoji welcome, 2–40 chars). Save. Change is visible to friends the next time they open your chat.",
    keywords: ["name", "display", "username", "edit", "change"],
    sealed_at: "2026-09-29",
    entry_href: "/nex-native/settings/profile",
  },
  {
    id: "workflow.create_business",
    kind: "workflow",
    title: "Create a business / shop",
    content:
      "Go to /nex-native/onboarding · fill in shop name, slug, first product name + price. On save you get a public shop page at /nex-native/[slug]. Add more products / edit hours / add menu items from /nex-native/manage/*.",
    keywords: ["business", "shop", "create", "onboarding", "seller"],
    sealed_at: "2026-09-29",
    entry_href: "/nex-native/onboarding",
  },
];

// ─── Public catalogue ────────────────────────────────────────────────

export const NEX_PRODUCT_KNOWLEDGE: readonly ProductKnowledgeEntry[] = [
  ...NEX_FEATURES,
  ...NEX_PLANS,
  ...NEX_WORKFLOWS,
];

/** Look up an entry by id · useful for tests + deep-link resolution. */
export function findProductEntry(id: string): ProductKnowledgeEntry | null {
  return NEX_PRODUCT_KNOWLEDGE.find((e) => e.id === id) ?? null;
}

/** Currency-aware plan-name lookup for account-context questions
 *  ("what does my plan include?"). Maps the NexSubscriptionPlan enum
 *  values recorded on nex_account to plan entries in this catalogue.
 *
 *  2026-11-25 reconciliation: the 2026-11-08 catalogue rename retired
 *  the per-tier Indonesia-era entries (`plan.bisnis`, `plan.themes_
 *  ringan`, `plan.buy_theme`, `plan.own_theme_request`, `plan.gratis`)
 *  and replaced them with three global entries (`plan.chat_free`,
 *  `plan.chat_themes`, `plan.nex_shop`). The `NexSubscriptionPlan`
 *  enum values stored on `nex_account` were not renamed · this
 *  function is the translation layer between the stored enum and the
 *  current catalogue. Without this mapping the LLM returned null for
 *  every paying-user context lookup since 2026-11-08.
 *
 *  Mapping:
 *    plan === "bisnis"              → plan.nex_shop (paid Shop)
 *    plan === "ringan"              → plan.chat_themes
 *    plan === "buy"                 → plan.chat_themes
 *    plan === "custom"              → plan.chat_themes
 *    tier ∈ { "bisnis", "pro" }     → plan.nex_shop
 *    default (free user)            → plan.chat_free
 */
export function planEntryForSubscription(
  plan: NexSubscriptionPlan | null,
  tier: NexAccountTier,
): ProductKnowledgeEntry | null {
  if (plan === "bisnis") return findProductEntry("plan.nex_shop");
  if (plan === "ringan") return findProductEntry("plan.chat_themes");
  if (plan === "buy") return findProductEntry("plan.chat_themes");
  if (plan === "custom") return findProductEntry("plan.chat_themes");
  if (tier === "bisnis" || tier === "pro") return findProductEntry("plan.nex_shop");
  return findProductEntry("plan.chat_free");
}
