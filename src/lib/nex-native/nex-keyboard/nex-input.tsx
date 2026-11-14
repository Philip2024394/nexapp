"use client";

// src/lib/nex-native/nex-keyboard/nex-input.tsx
//
// Owner-authorised 2026-10-24 · Phase 0.3 · shared wrapper around
// <input> that mounts the sealed JokerKeypad instead of the OS
// virtual keyboard on supported mobile viewports.
//
// Design doctrine (sealed by Phase 0 approval):
//   · Lazy-mount JokerKeypad on first open · zero cost until the
//     user focuses the input (keeps 100+ dormant inputs cheap).
//   · OS-keyboard suppression gated by isNexKeypadSupported() ·
//     non-Latin locales + desktop viewports fall through to the
//     native keyboard (SAFEGUARD A + F2 mobile cutoff).
//   · Byte-equivalent HTML `<input>` semantics otherwise · value /
//     onChange / placeholder / maxLength / autoFocus / data-* attrs
//     pass through so form libraries + validation + testing locators
//     work unchanged.
//   · data-nex-keypad="true" sentinel attribute · Phase 8 ESLint
//     rule uses this to detect app code that still uses raw <input>.
//
// This component does NOT ship any input migrations · Phase 1 and
// subsequent phases swap <input> → <NexInput> at call sites. Phase
// 0 ships the wrapper + the sandbox only.

import * as React from "react";
import { JokerKeypad } from "@/app/nex-native/chat-standard/_joker-keypad";
import { isNexKeypadSupported } from "./is-nex-keypad-supported";

/* Phase 0 corrective patch C 2026-10-24 · isomorphic layout effect ·
   runs synchronously after DOM commit but BEFORE paint on the client,
   so a state update inside it lands in the SAME paint as the first
   hydrated frame · zero visible flash + zero unusable-input interval.
   On the server (SSR) React emits a warning when useLayoutEffect is
   called · the typeof-window guard falls back to useEffect which is
   a no-op on server · standard React library pattern. */
const useIsomorphicLayoutEffect: typeof React.useLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onKeyDown"
>;

export interface NexInputProps extends NativeInputProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  /** Fires when the keypad's Enter key is pressed in single-line
   *  mode. Chat mode is not applicable to NexInput (that's what the
   *  sealed chat composers use directly). */
  readonly onEnter?: () => void;
  /** Theme accent for the JokerKeypad recolour. Defaults to NEX
   *  cyan `#00AFFF` · pass the active chat-theme primary to make
   *  the keypad feel like part of the surface. */
  readonly accentColor?: string;
  /** Restrict the keypad planes available to the user. undefined
   *  (default) allows all planes · pass `["numbers"]` for a numeric-
   *  only field, `["letters", "numbers", "symbols"]` to drop
   *  emoji/sticker/giphy, etc. */
  readonly planes?: ReadonlyArray<"letters" | "numbers" | "symbols" | "emoji" | "sticker" | "giphy">;
  /** Which plane the keypad opens on. Default "letters". */
  readonly initialPlane?: "letters" | "emoji" | "sticker";
  /** Explicit override for the activation decision · used by the
   *  sandbox + tests to force the behaviour regardless of viewport
   *  or locale. In production this prop is NOT passed · the helper
   *  decides automatically. */
  readonly forceKeypadActive?: boolean;
}

export function NexInput({
  value,
  onChange,
  onEnter,
  accentColor,
  planes,
  initialPlane,
  forceKeypadActive,
  maxLength,
  ...nativeProps
}: NexInputProps): React.JSX.Element {
  /* Phase 0 corrective patch C 2026-10-24 · HYDRATION-SAFE ACTIVATION.
     The useState initializer MUST return a value that matches the SSR
     render on first client render (hydration). On the server
     isNexKeypadSupported() returns false (window/navigator undefined);
     on the client it may return true. If the initializer called the
     helper directly, server and client first-render HTML would disagree
     and React 18 would log a hydration mismatch for inputMode / readOnly
     / data-nex-keypad.
     Fix: initial state is ALWAYS false (matches SSR). The real activation
     decision runs in useIsomorphicLayoutEffect which commits the state
     update synchronously BEFORE the browser paints the first frame · zero
     visible flash + the user never sees an unusable input · the OS
     keyboard cannot pop up during a race window because inputMode="none"
     is applied in the same paint as the first hydrated frame on supported
     mobile viewports.
     `forceKeypadActive` keeps its priority (sandbox + tests). */
  const [keypadActive, setKeypadActive] = React.useState<boolean>(() => {
    if (typeof forceKeypadActive === "boolean") return forceKeypadActive;
    return false;
  });
  useIsomorphicLayoutEffect(() => {
    if (typeof forceKeypadActive === "boolean") {
      setKeypadActive(forceKeypadActive);
      return;
    }
    setKeypadActive(isNexKeypadSupported());
  }, [forceKeypadActive]);

  const [keypadOpen, setKeypadOpen] = React.useState(false);
  /* Lazy-mount the keypad only after the first open · prevents 100+
     JokerKeypad instances existing per page even when unused. */
  const [keypadEverOpened, setKeypadEverOpened] = React.useState(false);

  const openKeypad = (): void => {
    if (!keypadActive) return;
    setKeypadEverOpened(true);
    setKeypadOpen(true);
  };

  const closeKeypad = (): void => setKeypadOpen(false);

  // Owner-authorised 2026-11-14 · Vault Privacy Completion Pass.
  // When the sealed keypad is forced on (production composer path),
  // direct DOM .value writes cannot update React state because the
  // onChange handler no-ops on keypadActive. For dev/test builds
  // only (NEXT_PUBLIC_NEX_E2E_HOOKS=1) we attach an escape-hatch
  // function on the input DOM node that routes through the real
  // React onChange setter. The _e2e-text-hook.tsx composer-text
  // hook prefers this path over value-set-and-dispatch. This is a
  // dev-only hatch · in production the env fold removes the effect.
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (process.env.NEXT_PUBLIC_NEX_E2E_HOOKS !== "1") return;
    const el = inputRef.current;
    if (!el) return;
    (el as HTMLInputElement & {
      __nexE2eSetValue?: (next: string) => void;
    }).__nexE2eSetValue = (next: string) => onChange(next);
    return () => {
      delete (el as HTMLInputElement & {
        __nexE2eSetValue?: (next: string) => void;
      }).__nexE2eSetValue;
    };
  }, [onChange]);

  // Owner directive 2026-10-25 · ROOT-CAUSE FIX for the recurring
  // mobile text-field overflow (symmetric to NexTextarea). Default
  // `box-sizing: border-box` so a caller's `width: 100%` + padding
  // keeps the OUTER box at 100% of its parent. The native <input>
  // default is content-box; without this fix any caller with
  // `width: 100%` + non-zero padding overflows its parent on narrow
  // viewports. Caller's own `style.boxSizing` still wins because
  // the caller's style is spread AFTER this default.
  const mergedStyle: React.CSSProperties = {
    boxSizing: "border-box",
    ...(nativeProps.style ?? {}),
  };
  return (
    <>
      <input
        {...nativeProps}
        ref={(node) => {
          inputRef.current = node;
          const forwarded = nativeProps.ref as
            | React.MutableRefObject<HTMLInputElement | null>
            | ((n: HTMLInputElement | null) => void)
            | undefined;
          if (typeof forwarded === "function") forwarded(node);
          else if (forwarded) forwarded.current = node;
        }}
        style={mergedStyle}
        data-nex-keypad={keypadActive ? "true" : "false"}
        value={value}
        maxLength={maxLength}
        /* OS-keyboard suppression chain · sealed from
           _surfaces/_composer.tsx:390-420. inputMode="none" is the
           primary signal; readOnly is the belt-and-braces fallback
           for older browsers; onMouseDown preventDefault kills the
           desktop context focus that otherwise opens an on-screen
           keyboard. onChange is a no-op when active because the
           keypad owns all writes. */
        inputMode={keypadActive ? "none" : nativeProps.inputMode}
        readOnly={keypadActive || nativeProps.readOnly}
        onChange={(e) => {
          if (keypadActive) return;
          onChange(e.target.value);
        }}
        onFocus={(e) => {
          if (keypadActive) openKeypad();
          nativeProps.onFocus?.(e);
        }}
        onMouseDown={(e) => {
          if (keypadActive) {
            e.preventDefault();
            openKeypad();
          }
          nativeProps.onMouseDown?.(e);
        }}
        onTouchStart={(e) => {
          if (keypadActive) openKeypad();
          nativeProps.onTouchStart?.(e);
        }}
        onClick={(e) => {
          if (keypadActive) openKeypad();
          nativeProps.onClick?.(e);
        }}
      />
      {keypadActive && keypadEverOpened ? (
        <JokerKeypad
          open={keypadOpen}
          value={value}
          onChange={(next) => {
            if (maxLength !== undefined && next.length > maxLength) {
              onChange(next.slice(0, maxLength));
              return;
            }
            onChange(next);
          }}
          onSend={() => {
            /* NexInput never uses chat mode · onSend is a no-op
               fallback that should not be reached. Caller provides
               onEnter for single-line Enter semantics. */
          }}
          onEnter={onEnter}
          onClose={closeKeypad}
          mode="single-line"
          planes={planes}
          initialPlane={initialPlane}
          // Owner directive 2026-11-03 · do NOT fall back to #00AFFF here ·
          // that inline override wins over the `:root` CSS vars emitted
          // by _world-stylesheet.tsx so Ireland's `WORLD_KEYPAD_ACCENT`
          // (Orange) was being masked by a hard-coded blue. Passing
          // undefined lets the keypad's paletteVars=={} branch fire so
          // the Ireland :root cascade applies.
          accentColor={accentColor}
          maxLength={maxLength}
        />
      ) : null}
    </>
  );
}
