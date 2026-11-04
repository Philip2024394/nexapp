"use client";

// src/app/nex-native/chat-9001/[accountId]/_prototype-composer-client.tsx
//
// NEX · Chat 9001 prototype composer with sealed JokerKeypad.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Minimal Phase 1 composer for the prototype chat surface. Reuses the
// sealed Chat9001Pill visual + the sealed JokerKeypad primitive with
// accentColor="#FF7200" (Ireland NEX Orange) so the keypad's accent
// keys render orange instead of the sealed Joker acid-green. The
// keypad backdrop + key fills already route through the Ireland
// world-palette vars set in _world-stylesheet.tsx so they read as
// Irish forest-green automatically.
//
// Text field behaviour · founder rule sealed 2026-10-24 ("any field
// that requires text is active nex keypad"):
//   · Input is readOnly + inputMode="none" so OS keyboard never opens.
//   · Tapping the input opens the sealed JokerKeypad instead.
//   · Keypad press reducer writes back via onChange · composer owns
//     the controlled string state · form POSTs it via a hidden
//     `body` input to the bound sendPeerMessageOrShareProductAction.
//
// Phase 1 scope (what this composer wires):
//   · Text send (sealed send action)
//   · + attach panel open (UniversalAttachPanel · Call Centre tile
//     reachable · Gallery/Document/Voice/Contact/Location are
//     surfaced but not wired because the upload pipeline lives in
//     PeerComposer and is a Phase 2 port task)
//   · Emoji button opens the keypad on the emoji plane
//
// Phase 1 OUT OF SCOPE (keeps using production PeerComposer on
// production peer routes · NOT lost · just not in the prototype demo):
//   · Reply to a message (?reply=<id>)
//   · Media capture (camera / video / voice recorder)
//   · Encrypted upload pipeline (Bridge 88)
//   · Product share via ?pending_product=<id>
//   · Theme stickers / theme emojis / dedicated sticker send action
//   · Pending-attachment preview chip
//
// Phase 2 (NOT authorised yet) will either: (a) backport the keypad
// integration into the production PeerComposer so both routes share
// one implementation, or (b) graduate this file to full feature
// parity with PeerComposer. Decision on which deferred until owner
// reviews the Phase 1 keypad feel.

import * as React from "react";
import { JokerKeypad } from "@/app/nex-native/chat-standard/_joker-keypad";
import { Chat9001Pill } from "@/components/nex-native/chat-chrome/chat-9001-pill";
import { UniversalAttachPanel } from "@/components/nex-native/chat-chrome/universal-attach-panel";
// Owner-authorised 2026-11-05 · Phase 1A location sharing · opens on
// Location tile tap · no map/GPS before precision tier chosen.
import {
  LocationPicker,
  generateSessionSalt,
} from "@/components/nex-native/location-picker/location-picker-client";
import type { LocationPayload } from "@/lib/nex-native/location/payload";
import type { AreaDataset } from "@/lib/nex-native/location/area-resolver";
import {
  getSessionSalt as idbGetSessionSalt,
  putSessionSalt as idbPutSessionSalt,
} from "@/lib/nex-native/location/outbox";
import type { SessionSalt } from "@/lib/nex-native/location/fuzz";

/** Minimal base64 helpers for session-salt persistence · same encoding
 *  as crypto/shared-secret.ts uses for ciphertext. */
function bytesToBase64Local(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
}
function base64ToBytesLocal(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// NEX Ireland accent · owner directive 2026-11-03 · "kepad is global
// on nex chat ireland and the blue keys change to orange color".
// Hex passed to JokerKeypad.accentColor so deriveKeypadVars() emits
// --nex-kp-accent/-dim/-glow/-pressed/-border as orange rgba tints.
// The keypad backdrop stays Ireland forest-green via the sealed
// --nex-keypad-bg-top/-bottom vars from _world-stylesheet.tsx.
const IRELAND_KEYPAD_ACCENT = "#FF7200";

export interface PrototypeComposerProps {
  readonly action: (
    formData: FormData,
  ) => Promise<never> | Promise<void> | void;
  readonly peerDisplayName: string;
  /** Phase 1A location sharing · self + peer + conversation context
   *  needed to authorise and encrypt location shares. All optional ·
   *  when any is missing the Location tile on the + panel stays inert. */
  readonly selfAccountId?: string;
  readonly peerAccountId?: string;
  readonly conversationId?: string;
  /** Bundled area dataset for the viewer's country · null disables the
   *  Area-only tier. Owner condition 4: production fixtures remain
   *  disabled until real data lands. */
  readonly areaDataset?: AreaDataset | null;
  /** Handler called when the picker produces a payload · parent
   *  encrypts + broadcasts + writes to outbox. Phase 1A stub: parent
   *  may log the payload if full wiring is deferred. */
  readonly onShareLocation?: (payload: LocationPayload) => void | Promise<void>;
}

export function PrototypeComposer({
  action,
  peerDisplayName,
  selfAccountId,
  peerAccountId,
  conversationId,
  areaDataset,
  onShareLocation,
}: PrototypeComposerProps): React.JSX.Element {
  const [value, setValue] = React.useState("");
  const [keypadOpen, setKeypadOpen] = React.useState(false);
  const [keypadPlane, setKeypadPlane] =
    React.useState<"letters" | "emoji" | "sticker">("letters");
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [locationOpen, setLocationOpen] = React.useState(false);
  const [lastNearbyShareAtMs, setLastNearbyShareAtMs] = React.useState<
    number | null
  >(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const canShareLocation =
    Boolean(selfAccountId) &&
    Boolean(peerAccountId) &&
    Boolean(conversationId);

  const getSessionSalt = React.useCallback(async (): Promise<SessionSalt> => {
    if (!selfAccountId || !conversationId) {
      return generateSessionSalt();
    }
    const key = `${selfAccountId}:${conversationId}`;
    const existing = await idbGetSessionSalt(key);
    const now = Date.now();
    if (existing && new Date(existing.rotates_at).getTime() > now) {
      return { bytes: base64ToBytesLocal(existing.salt_b64) };
    }
    const fresh = generateSessionSalt();
    const createdAt = new Date().toISOString();
    const rotates = new Date(now + 60 * 60 * 1000).toISOString();
    await idbPutSessionSalt({
      key,
      salt_b64: bytesToBase64Local(fresh.bytes),
      created_at: createdAt,
      last_used_at: createdAt,
      rotates_at: rotates,
    });
    return fresh;
  }, [selfAccountId, conversationId]);

  const markNearbyShared = React.useCallback(async () => {
    setLastNearbyShareAtMs(Date.now());
  }, []);

  const handleLocationSend = React.useCallback(
    async (payload: LocationPayload) => {
      if (onShareLocation) {
        await onShareLocation(payload);
      } else {
        // Parent didn't wire full encrypted broadcast in Phase 1A · we log
        // locally (never transmitted) so developers can inspect the payload
        // shape. Production surfaces MUST pass onShareLocation.
        // eslint-disable-next-line no-console
        console.log("[location] payload ready (no broadcast wired)", payload);
      }
    },
    [onShareLocation],
  );

  const handleSend = React.useCallback(() => {
    if (value.trim().length === 0) return;
    // Trigger native form submission · the server action receives the
    // current `value` via the hidden `body` input below.
    formRef.current?.requestSubmit();
    // Optimistic reset so the keypad closes immediately · the server
    // action redirects back to the chat which re-renders with the
    // delivered bubble.
    setValue("");
    setKeypadOpen(false);
  }, [value]);

  // Tap input → open keypad on letters plane.
  const openKeypadLetters = React.useCallback(() => {
    setKeypadPlane("letters");
    setKeypadOpen(true);
  }, []);
  // Tap emoji glyph in the pill → open keypad on emoji plane.
  const openKeypadEmoji = React.useCallback(() => {
    setKeypadPlane("emoji");
    setKeypadOpen(true);
  }, []);
  // Tap + → open UniversalAttachPanel. Keypad stays closed.
  const openAttach = React.useCallback(() => {
    setAttachOpen(true);
  }, []);

  return (
    <>
      <form
        ref={formRef}
        action={action}
        data-nex-prototype-composer
        style={{
          position: "relative",
          padding:
            "8px 10px calc(env(safe-area-inset-bottom, 0px) + 10px) 10px",
          flexShrink: 0,
          background: "transparent",
        }}
      >
        {/* Hidden body · the sealed server action reads this as the
            message text · same contract PeerComposer uses today. */}
        <input type="hidden" name="body" value={value} />

        <Chat9001Pill
          value={value}
          onChange={setValue}
          onSend={handleSend}
          onPlusAction={openAttach}
          onEmoji={openKeypadEmoji}
          placeholder={`Message ${peerDisplayName}…`}
          accentHex={IRELAND_KEYPAD_ACCENT}
          plusOpen={attachOpen}
          inputRef={inputRef}
          textareaDataAttr="nex-prototype-composer-input"
        />
      </form>

      {/* Suppress the OS keyboard · the input inside Chat9001Pill is a
          plain <input> · when the owner-sealed rule applies we force
          readOnly + inputMode="none" via a small effect on the ref.
          We do this here (not inside the pill) so the pill component
          stays agnostic and reusable on other surfaces. */}
      <SuppressOSKeyboard inputRef={inputRef} onTap={openKeypadLetters} />

      {/* JokerKeypad · Ireland orange accent · Ireland backdrop via
          world-palette CSS vars already set by _world-stylesheet.tsx. */}
      <JokerKeypad
        open={keypadOpen}
        value={value}
        onChange={setValue}
        onSend={handleSend}
        onClose={() => setKeypadOpen(false)}
        accentColor={IRELAND_KEYPAD_ACCENT}
        initialPlane={keypadPlane}
      />

      {/* + attach panel · shared 6-tile set · Call Centre tile is
          reachable (routes via Link in the panel). Gallery / Document
          / Voice are shown but without handlers in Phase 1 so they
          render in their sealed "coming soon" state. Phase 2 wires
          the production upload pipeline.
          Location tile wiring · Phase 1A · gated on conversation + keys
          being available · opens the LocationPicker modal. */}
      <UniversalAttachPanel
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPickLocation={
          canShareLocation
            ? () => {
                setAttachOpen(false);
                setLocationOpen(true);
              }
            : undefined
        }
      />

      {canShareLocation ? (
        <LocationPicker
          open={locationOpen}
          onClose={() => setLocationOpen(false)}
          peerDisplayName={peerDisplayName}
          conversationId={conversationId!}
          selfAccountId={selfAccountId!}
          onSend={handleLocationSend}
          getSessionSalt={getSessionSalt}
          markNearbyShared={markNearbyShared}
          lastNearbyShareAtMs={lastNearbyShareAtMs}
          areaDataset={areaDataset ?? null}
          allowFixtureAreaData={
            typeof process !== "undefined" &&
            process.env.NEXT_PUBLIC_NEX_LOCATION_ALLOW_FIXTURE === "1"
          }
        />
      ) : null}
    </>
  );
}

// ─── OS-keyboard suppression effect ─────────────────────────────────

/** Attaches readOnly + inputMode="none" + a tap handler to the given
 *  input ref on mount so OS keyboards never open and taps route to the
 *  JokerKeypad instead. Cleans up on unmount. Honours the sealed
 *  2026-10-24 universal-keypad rule.
 *
 *  Separated into its own component so the composer doesn't need its
 *  own useEffect for DOM side effects · also lets a future caller
 *  reuse the pattern on other NEX inputs. */
function SuppressOSKeyboard({
  inputRef,
  onTap,
}: {
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly onTap: () => void;
}): null {
  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // Lock the native keyboard off · iOS respects inputMode="none" +
    // readOnly, Android respects inputMode="none", desktop just stays
    // focusable without an input context.
    el.setAttribute("readonly", "true");
    el.setAttribute("inputmode", "none");
    const handler = (e: Event) => {
      e.preventDefault();
      onTap();
    };
    el.addEventListener("focus", handler);
    el.addEventListener("click", handler);
    return () => {
      el.removeEventListener("focus", handler);
      el.removeEventListener("click", handler);
      el.removeAttribute("readonly");
      el.removeAttribute("inputmode");
    };
  }, [inputRef, onTap]);
  return null;
}
