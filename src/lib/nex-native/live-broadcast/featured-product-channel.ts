// src/lib/nex-native/live-broadcast/featured-product-channel.ts
//
// NEX Live Commerce · featured-product propagation channel.
//
// Scope · a thin wrapper around a dedicated Supabase Realtime BROADCAST
// channel named `nex:live-featured:{sessionId}`. The broadcaster uses
// this channel to publish the currently-featured product to every
// viewer; viewers subscribe and fire a callback whenever the featured
// product changes.
//
// Why a separate channel (not reusing `nex:live:{sessionId}` presence):
//   · Keeps presence lean. Presence rows are the admission ledger · we
//     do NOT want to pack product payloads into a presence meta that
//     is re-tracked on every roster change.
//   · Lets viewers subscribe to featured-product updates WITHOUT ever
//     joining the presence roster · useful if a Phase 2 preview surface
//     wants to render the "currently featured" chip without being
//     counted against the MAX_VIEWERS cap.
//   · Clean separation of concerns · when we later wire inventory or
//     per-variant signals, they ride this channel instead of inflating
//     the admission channel.
//
// Zero cost · one Realtime broadcast channel, state carried in the
// broadcaster's local memory, no DB write.
//
// Late-joiner handling:
//   · The broadcaster TRACKS PRESENCE on this channel with its current
//     featured product as the presence meta. Supabase Realtime fires a
//     presence sync to every new subscriber on join · the viewer reads
//     the broadcaster's presence row and reconstructs the current
//     featured product WITHOUT needing a dedicated "state request"
//     round-trip.
//   · If the broadcaster has not set anything yet, the presence row
//     carries `product: null` and the viewer renders no overlay.

"use client";

import { openNexChannel, type NexChannelHandle } from "../realtime/channel";
import type { LiveProductSnapshot } from "@/components/nex-native/live-commerce/ProductOverlayCard";

export type FeaturedProductRole = "broadcaster" | "viewer";

export interface OpenFeaturedProductChannelOptions {
  readonly sessionId: string;
  readonly role: FeaturedProductRole;
  /** Fires on every featured-product broadcast received AND on
   *  broadcaster-presence-sync so a viewer joining mid-stream learns
   *  the current featured state. For broadcasters this is a no-op · the
   *  broadcaster is the authoritative source and never consumes its
   *  own echo (self-filter is honoured by openNexChannel). */
  readonly onFeaturedChange?: (product: LiveProductSnapshot | null) => void;
}

export interface FeaturedProductChannelHandle {
  /** Broadcaster · publish a new featured product (or null to clear).
   *  Viewer · no-op (returns a resolved promise). */
  setFeatured(product: LiveProductSnapshot | null): Promise<void>;
  /** Tear down the underlying channel. Idempotent · safe to call
   *  multiple times. Never throws. */
  close(): Promise<void>;
}

/** Internal message shape. Tolerate unknown types silently so Phase 2
 *  additions (variants, stock, etc.) don't break Phase 1 clients. The
 *  index signature satisfies the `BroadcastPayload = Record<string,
 *  unknown>` constraint on `openNexChannel` · same workaround that
 *  broadcast-engine.ts uses for its presence track. */
interface FeaturedSetMessage {
  type: "featured-set";
  product: LiveProductSnapshot | null;
  at: number;
  [k: string]: unknown;
}

/** Broadcaster-side presence payload · carries the current featured
 *  product so late-joining viewers can resolve state from the sync. We
 *  shape this as a plain record with an index signature so it satisfies
 *  the `BroadcastPayload = Record<string, unknown>` generic on
 *  `openNexChannel` (same workaround as broadcast-engine.ts uses for
 *  its own presence track). */
interface FeaturedPresenceTrack {
  role: "broadcaster";
  product: LiveProductSnapshot | null;
  at: number;
  [k: string]: unknown;
}

/** Guards against partially-shaped payloads. Returns the normalised
 *  snapshot or null if the shape is invalid. */
function normaliseProduct(raw: unknown): LiveProductSnapshot | null {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<LiveProductSnapshot>;
  if (
    typeof p.productId !== "string" ||
    typeof p.name !== "string" ||
    typeof p.priceLabel !== "string" ||
    typeof p.shopName !== "string" ||
    typeof p.hasVariants !== "boolean"
  ) {
    return null;
  }
  const stock = p.stockStatus;
  if (
    stock !== "in_stock" &&
    stock !== "low_stock" &&
    stock !== "sold_out" &&
    stock !== "made_to_order"
  ) {
    return null;
  }
  const imageUrl =
    p.imageUrl === null || typeof p.imageUrl === "string" ? p.imageUrl : null;
  return {
    productId: p.productId,
    name: p.name,
    imageUrl: imageUrl ?? null,
    priceLabel: p.priceLabel,
    shopName: p.shopName,
    stockStatus: stock,
    hasVariants: p.hasVariants,
  };
}

/** Open (or attach to) the featured-product channel for a session.
 *
 *  Broadcaster: calls to `setFeatured` broadcast the new state to every
 *  subscriber AND update the broadcaster's own presence row so that
 *  late-joining viewers see the current state on their first sync.
 *
 *  Viewer: subscribes to broadcasts and presence syncs; both fan into
 *  the single `onFeaturedChange` callback. The viewer's `setFeatured`
 *  is a no-op · the broadcaster is the only authoritative writer. */
export function openFeaturedProductChannel(
  opts: OpenFeaturedProductChannelOptions,
): FeaturedProductChannelHandle {
  const { sessionId, role, onFeaturedChange } = opts;
  const channelName = `nex:live-featured:${sessionId}`;
  // selfId · we don't need identity for featured-product propagation,
  // but openNexChannel requires one for broadcast self-filtering. Mint
  // a per-handle id so two handles opened in the same session (e.g.
  // owner previewing their own stream) don't swallow each other's echo.
  const selfId = `${role}:${sessionId}:${Math.random().toString(36).slice(2)}`;

  let closed = false;
  // Broadcaster's locally-held current state · also mirrored into
  // presence so viewers can resolve state on first sync.
  let currentProduct: LiveProductSnapshot | null = null;

  const handle: NexChannelHandle = openNexChannel<FeaturedSetMessage>({
    name: channelName,
    selfId,
    onBroadcast: (event, envelope) => {
      if (closed) return;
      if (role === "broadcaster") return; // broadcaster never consumes
      if (event !== "featured-set") return; // tolerate unknown types
      const payload = envelope.payload;
      if (!payload || payload.type !== "featured-set") return;
      const product = normaliseProduct(payload.product);
      onFeaturedChange?.(product);
    },
    onPresenceChange: (state) => {
      if (closed) return;
      if (role !== "viewer") return;
      // Walk the presence state and pick the broadcaster row (there
      // should be at most one · the first one wins deterministically
      // if a race occurs during handoff).
      for (const [, metas] of Object.entries(state)) {
        const meta = (metas?.[0] ?? {}) as Partial<FeaturedPresenceTrack>;
        if (meta.role !== "broadcaster") continue;
        const product = normaliseProduct(meta.product);
        onFeaturedChange?.(product);
        return;
      }
      // No broadcaster on the roster · nothing featured yet.
      onFeaturedChange?.(null);
    },
    onError: () => {
      /* best-effort channel · surfacing errors here would spam the
       * broadcaster UI without actionable recovery. The engine's own
       * presence channel is where connectivity issues surface. */
    },
  });

  // Broadcaster tracks a presence row carrying the initial (null)
  // featured state. Fire-and-forget · the first `setFeatured` call
  // overrides this with real content.
  if (role === "broadcaster") {
    const initial: FeaturedPresenceTrack = {
      role: "broadcaster",
      product: null,
      at: Date.now(),
    };
    void handle
      .trackPresence(initial as unknown as Record<string, unknown>)
      .catch(() => {
        /* best-effort · broadcast still works without presence track */
      });
  }

  return {
    async setFeatured(product: LiveProductSnapshot | null): Promise<void> {
      if (closed) return;
      if (role !== "broadcaster") return; // viewers · no-op
      currentProduct = product;
      const message: FeaturedSetMessage = {
        type: "featured-set",
        product,
        at: Date.now(),
      };
      try {
        await handle.broadcast("featured-set", message as unknown as Record<string, unknown>);
      } catch {
        /* best-effort · a Phase 2 toast could surface this */
      }
      // Refresh the broadcaster presence row so late-joining viewers
      // land on the current product.
      const track: FeaturedPresenceTrack = {
        role: "broadcaster",
        product: currentProduct,
        at: Date.now(),
      };
      try {
        await handle.trackPresence(
          track as unknown as Record<string, unknown>,
        );
      } catch {
        /* best-effort · broadcast already carried the primary signal */
      }
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      try {
        await handle.close();
      } catch {
        /* idempotent · swallow */
      }
    },
  };
}
