"use client";

// src/app/nex-native/_add-to-cart-button.tsx
//
// Bridge 22 · Small "Add to cart" button that writes into
// localStorage. Reusable across the shop landing product cards,
// the product detail page, the menu page dish cards, and the
// menu-first shop landing.
//
// Deduplication: if an item with the same (shop_id, id, variants)
// already exists, we bump its quantity by qtyToAdd rather than
// creating a duplicate line.

import { useRef, useState } from "react";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";

export interface AddToCartItemInit {
  kind: "product" | "menu_item";
  id: string;
  shop_id: string;
  shop_slug: string;
  shop_owner_account_id: string;
  shop_display_name: string;
  /** Bridge 25c · frozen at add-time so /cart can estimate bike
   *  delivery without re-fetching the seller row. */
  shop_lat?: number | null;
  shop_lng?: number | null;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  variants?: string[];
  /** Bridge 23c-3 · perk tokens attached to a menu-item line ·
   *  frozen on the cart-line so the seller sees the same chips the
   *  buyer saw at add-time even if the dish changes later. */
  perks?: string[];
  perks_note?: string | null;
  qty?: number;
}

export function AddToCartButton({
  item,
  label = "Add to cart",
  tone = "primary",
  compact = false,
}: {
  item: AddToCartItemInit;
  label?: string;
  tone?: "primary" | "ghost" | "green";
  compact?: boolean;
}) {
  const [added, setAdded] = useState(false);
  // C-0 fix 2026-10-30 · honest failure state. Previously a
  // localStorage write that threw was silently swallowed and the
  // button never changed, so the user had no idea whether the
  // product had actually been added. We now surface the failure
  // explicitly ("Not added · tap to retry") so the customer is
  // never told an action succeeded when it did not.
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  // Synchronous dedupe guard. `useState` lags by one render cycle,
  // so a fast double-tap could execute the write twice before React
  // flipped the pending state. A ref flips immediately, so the
  // second tap sees `busyRef.current === true` and bails out,
  // preventing a duplicate quantity bump.
  const busyRef = useRef(false);

  function onClick() {
    if (busyRef.current || added) return;
    busyRef.current = true;
    setPending(true);
    setFailed(false);

    let ok = false;
    try {
      // Pre-flight storage probe. Some browsers (iOS private mode,
      // storage-quota exceeded) throw on the first access rather
      // than at setItem time; we need an honest fail before the
      // write even begins.
      if (typeof window === "undefined" || !window.localStorage) {
        throw new Error("storage-unavailable");
      }
      const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
      const arr: NexCartItem[] = raw ? JSON.parse(raw) : [];
      const variants = item.variants ?? [];
      const qtyToAdd = item.qty ?? 1;
      const dedupeKey = `${item.shop_id}::${item.id}::${variants
        .slice()
        .sort()
        .join("|")}`;
      const existingIdx = arr.findIndex(
        (x) => x && `${x.shop_id}::${x.id}::${(x.variants ?? [])
          .slice()
          .sort()
          .join("|")}` === dedupeKey,
      );
      if (existingIdx >= 0) {
        arr[existingIdx] = {
          ...arr[existingIdx]!,
          quantity: (arr[existingIdx]!.quantity || 1) + qtyToAdd,
        };
      } else {
        arr.push({
          key:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${dedupeKey}::${Date.now()}`,
          kind: item.kind,
          id: item.id,
          shop_id: item.shop_id,
          shop_slug: item.shop_slug,
          shop_owner_account_id: item.shop_owner_account_id,
          shop_display_name: item.shop_display_name,
          shop_lat: item.shop_lat ?? null,
          shop_lng: item.shop_lng ?? null,
          name: item.name,
          price_pence: item.price_pence,
          currency: item.currency,
          image_url: item.image_url,
          quantity: qtyToAdd,
          variants,
          perks: item.perks ?? [],
          perks_note: item.perks_note ?? null,
          note: null,
          added_at: Date.now(),
        });
      }
      // The write is the authoritative success boundary. If this
      // throws (quota exceeded, SecurityError, disk full) we fall
      // into the catch and `ok` stays `false`.
      window.localStorage.setItem(NEX_CART_STORAGE_KEY, JSON.stringify(arr));
      // Persistence confirmed · flip `ok` immediately. The event
      // dispatch is best-effort notification only and MUST NOT be
      // able to downgrade a successful write into a reported failure
      // (owner-authorised correction 2026-10-30 · a dispatch failure
      // following a successful setItem would otherwise cause the UI
      // to prompt a retry that double-adds the quantity).
      ok = true;
      try {
        window.dispatchEvent(new CustomEvent("nex-cart-changed"));
      } catch {
        /* Dispatch failure is extremely rare (document teardown).
           Persistence stands; downstream listeners catch up on the
           next storage event or page refresh. */
      }
    } catch {
      ok = false;
    }

    setPending(false);
    if (ok) {
      setAdded(true);
      setTimeout(() => {
        setAdded(false);
        busyRef.current = false;
      }, 1400);
    } else {
      setFailed(true);
      // Longer visible failure window than success so the user has
      // time to notice it and retry. Clears the busy flag so the
      // retry tap is accepted.
      setTimeout(() => {
        setFailed(false);
        busyRef.current = false;
      }, 2400);
    }
  }

  const isGreen = tone === "green" || added;
  const isRed = failed;
  const isPrimary = tone === "primary" && !added && !failed;
  const isGhost = tone === "ghost" && !added && !failed;
  void isGhost;

  const buttonLabel = failed
    ? "Not added · tap to retry"
    : pending
      ? "Adding…"
      : added
        ? "✓ Added"
        : label;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={buttonLabel}
      aria-live={failed || added ? "polite" : undefined}
      disabled={pending}
      style={{
        padding: compact ? "6px 12px" : "10px 14px",
        borderRadius: compact ? 999 : 12,
        background: isRed
          ? "linear-gradient(180deg, #FF4B5C 0%, #C8102E 100%)"
          : isGreen
            ? "linear-gradient(180deg, #22E37A 0%, #16D66B 100%)"
            : isPrimary
              ? "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)"
              : "rgba(0,175,255,0.14)",
        border: isRed
          ? "1px solid rgba(200,16,46,0.65)"
          : isGreen
            ? "1px solid rgba(22,214,107,0.55)"
            : isPrimary
              ? "1px solid rgba(255,114,0,0.6)"
              : "1px solid rgba(0,175,255,0.5)",
        color: isRed
          ? "#FFFFFF"
          : isGreen
            ? "#0B0F1A"
            : isPrimary
              ? "#0B0F1A"
              : "#F4F7FC",
        fontSize: compact ? 10 : 12,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.75 : 1,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        boxShadow: isRed
          ? "0 6px 14px rgba(200,16,46,0.4), inset 0 1px 0 rgba(255,255,255,0.28)"
          : isGreen
            ? "0 6px 14px rgba(22,214,107,0.35), inset 0 1px 0 rgba(255,255,255,0.28)"
            : isPrimary
              ? "0 6px 14px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)"
              : "none",
        transition: "background 160ms ease",
        // Keep the button under any full-card <a> overlays by making
        // it position: relative so it sits above via stacking.
        position: "relative",
        zIndex: 4,
      }}
    >
      {buttonLabel}
    </button>
  );
}
