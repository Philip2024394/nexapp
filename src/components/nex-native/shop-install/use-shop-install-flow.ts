"use client";

// src/components/nex-native/shop-install/use-shop-install-flow.ts
//
// Owner directive 2026-11-27 · branded shop installation feature.
// -----------------------------------------------------------------------------
// Two colocated hooks that power every branded-shop install surface:
//
//   · useShopInstallFlow({ shopSlug })
//       Platform detection + `beforeinstallprompt` capture + the one
//       `trigger()` function that opens the install flow. Reused by
//       the standard install button, the slide-in notification, and
//       the burger-menu "Download App" row so all three surfaces
//       behave identically.
//
//   · useShopInstallDismissal({ shopSlug })
//       Spec §C 2-strike / 5-minute / permanent-suppression state
//       machine. Stores dismissal counts in localStorage keyed by
//       shop slug. `appinstalled` event flips the suppression bit
//       automatically. When a migration for
//       `nex_account_shop_install_prefs` lands (BLOCKED-AT-APPROVAL
//       on sandbox-apply per manifest-route comment), signed-in
//       reconciliation can be bolted on without breaking the guest
//       path.
//
// Design rules (owner directive):
//   · Never trigger the native prompt without a user action · the
//     browser throws silently when we do.
//   · Never claim installed when the OS has not confirmed. We ONLY
//     flip `isShopInstalled` on the `appinstalled` window event.
//   · iOS Safari never fires `beforeinstallprompt` · we short-circuit
//     to honest Share → Add to Home Screen instructions.
//   · One shared service worker scope (`/nex-native/`) is sealed.
//     Different shops have different `start_url`s. Android may
//     suppress the native prompt when the user already installed
//     NEX to a different start_url inside this scope; we treat the
//     1.2 s no-event window as "no prompt available right now" and
//     surface the browser-menu fallback copy rather than lying.
//   · Nothing here persists PII · only a shop slug → counts map.

import * as React from "react";

// ────────────────────────────────────────────────────────────────────────
// Shared types
// ────────────────────────────────────────────────────────────────────────

/** Honest install-state enum · matches `_install-client.tsx` vocabulary
 *  so the sealed global Install NEX surface and these branded shop
 *  surfaces speak the same language. */
export type ShopInstallState =
  | { kind: "detecting" }
  | { kind: "chromium"; deferred: BeforeInstallPromptEvent }
  | { kind: "ios" }
  | { kind: "android-fallback" }
  | { kind: "desktop"; deferred: BeforeInstallPromptEvent | null }
  | { kind: "installed" }
  | { kind: "unsupported" };

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ────────────────────────────────────────────────────────────────────────
// Platform detection · same semantics as _install-client.tsx so the
// two surfaces never diverge.
// ────────────────────────────────────────────────────────────────────────

function detectIsIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIosDevice = /iPad|iPhone|iPod/.test(ua);
  const isIpad13 =
    (navigator.platform === "MacIntel" &&
      (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints != null &&
      ((navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1)) ||
    false;
  return isIosDevice || isIpad13;
}

function detectIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.matchMedia?.("(display-mode: standalone)")?.matches ?? false) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectIsMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/.test(navigator.userAgent || "");
}

// ────────────────────────────────────────────────────────────────────────
// useShopInstallFlow
// ────────────────────────────────────────────────────────────────────────

export interface UseShopInstallFlowOptions {
  readonly shopSlug: string;
  /** Optional callback fired when `appinstalled` lands for THIS shop
   *  (i.e. while this hook is mounted under this slug). Lets the
   *  slide-in dismissal state machine suppress future prompts. */
  readonly onInstalled?: (shopSlug: string) => void;
}

export interface UseShopInstallFlowResult {
  readonly state: ShopInstallState;
  /** True when the sealed native prompt is sitting in memory and
   *  will open on the next `trigger()` call. */
  readonly canInstall: boolean;
  /** True when the current browser is running NEX as a standalone
   *  PWA (any shop or the main app) · suppresses install UI. */
  readonly isStandalone: boolean;
  /** True when we've previously received `appinstalled` for THIS
   *  shop slug in this browser · persisted in localStorage so a
   *  reload doesn't re-advertise install. */
  readonly isShopInstalled: boolean;
  /** Open the install flow. On Android/Chromium/desktop with a
   *  captured deferred event this calls `prompt()`. On iOS the
   *  slide-in / button surfaces render Share → A2HS instructions
   *  themselves instead of calling `trigger` · the caller checks
   *  `state.kind` before deciding. */
  readonly trigger: () => Promise<"accepted" | "dismissed" | "noop">;
}

const INSTALLED_FLAGS_KEY = "nex_shop_installed_flags_v1";

function readInstalledFlag(shopSlug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(INSTALLED_FLAGS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed[shopSlug] === true;
  } catch {
    return false;
  }
}

function writeInstalledFlag(shopSlug: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(INSTALLED_FLAGS_KEY);
    const parsed: Record<string, boolean> =
      raw && raw.length > 0 ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[shopSlug] = true;
    window.localStorage.setItem(INSTALLED_FLAGS_KEY, JSON.stringify(parsed));
  } catch {
    // Storage full / disabled · the suppression gracefully degrades
    // to "no permanent suppression" rather than crashing.
  }
}

/** Platform detection + install-prompt capture + trigger. Shared by
 *  every branded shop install surface (button · slide-in · burger). */
export function useShopInstallFlow({
  shopSlug,
  onInstalled,
}: UseShopInstallFlowOptions): UseShopInstallFlowResult {
  const [state, setState] = React.useState<ShopInstallState>({
    kind: "detecting",
  });
  const [isShopInstalled, setIsShopInstalled] = React.useState(false);

  // One-time hydration from localStorage · the page is server-
  // rendered so we can't read storage during the first paint. The
  // initial state is "detecting" and we never render install UI
  // while that's the case, so no flash.
  React.useEffect(() => {
    setIsShopInstalled(readInstalledFlag(shopSlug));
  }, [shopSlug]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Already running as a PWA · don't advertise install anywhere.
    if (detectIsStandalone()) {
      setState({ kind: "installed" });
      return;
    }

    const isIos = detectIsIos();
    const isMobile = detectIsMobile();

    if (isIos) {
      setState({ kind: "ios" });
      // iOS never fires beforeinstallprompt · but wrappers might
      // fire appinstalled.
      const onInstalledEvent = () => {
        writeInstalledFlag(shopSlug);
        setIsShopInstalled(true);
        setState({ kind: "installed" });
        onInstalled?.(shopSlug);
      };
      window.addEventListener("appinstalled", onInstalledEvent);
      return () => {
        window.removeEventListener("appinstalled", onInstalledEvent);
      };
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const deferred = e as BeforeInstallPromptEvent;
      setState({
        kind: isMobile ? "chromium" : "desktop",
        deferred,
      });
    };
    const onInstalledEvent = () => {
      writeInstalledFlag(shopSlug);
      setIsShopInstalled(true);
      setState({ kind: "installed" });
      onInstalled?.(shopSlug);
    };

    window.addEventListener(
      "beforeinstallprompt",
      onBeforeInstallPrompt as EventListener,
    );
    window.addEventListener("appinstalled", onInstalledEvent);

    // 1.2 s detection window · matches the sealed _install-client.
    // If `beforeinstallprompt` hasn't fired by then the browser
    // either (a) already has NEX installed via the shared scope or
    // (b) doesn't currently satisfy its installability heuristics.
    // Either way we surface the browser-menu fallback rather than
    // pretending a button will work.
    const timer = window.setTimeout(() => {
      setState((current) =>
        current.kind === "detecting"
          ? isMobile
            ? { kind: "android-fallback" }
            : { kind: "desktop", deferred: null }
          : current,
      );
    }, 1200);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstallPrompt as EventListener,
      );
      window.removeEventListener("appinstalled", onInstalledEvent);
      window.clearTimeout(timer);
    };
  }, [shopSlug, onInstalled]);

  const canInstall =
    state.kind === "chromium" ||
    (state.kind === "desktop" && state.deferred !== null);

  const trigger = React.useCallback(async (): Promise<
    "accepted" | "dismissed" | "noop"
  > => {
    if (state.kind !== "chromium" && state.kind !== "desktop") return "noop";
    const deferred = state.deferred;
    if (!deferred) return "noop";
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        writeInstalledFlag(shopSlug);
        setIsShopInstalled(true);
        setState({ kind: "installed" });
        onInstalled?.(shopSlug);
      }
      return choice.outcome;
    } catch {
      return "noop";
    }
  }, [state, shopSlug, onInstalled]);

  return {
    state,
    canInstall,
    isStandalone: state.kind === "installed",
    isShopInstalled,
    trigger,
  };
}

// ────────────────────────────────────────────────────────────────────────
// useShopInstallDismissal · Spec §C state machine
// ────────────────────────────────────────────────────────────────────────

const DISMISSAL_STORAGE_KEY = "nex_shop_install_prefs_v1";
const SECOND_SHOW_DELAY_MS = 5 * 60 * 1000;

interface ShopDismissalRecord {
  /** 0 · 1 · 2 · permanent stop at 2 per spec §C. */
  readonly dismissals: 0 | 1 | 2;
  /** Wall-clock ms of the FIRST dismissal · gates the 5-minute
   *  re-show window. Null when dismissals=0. */
  readonly firstDismissAt?: number | null;
  /** Permanent suppression · set when the user installs the shop
   *  OR dismisses a second time. Spec §C §E. */
  readonly suppressed?: boolean;
}

type DismissalMap = Record<string, ShopDismissalRecord>;

function readDismissalMap(): DismissalMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DISMISSAL_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DismissalMap;
  } catch {
    return {};
  }
}

function writeDismissalMap(map: DismissalMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISSAL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage full / disabled · degrade to "no persistence" · the
    // slide-in will re-appear next session, which is better than
    // crashing the shop page.
  }
}

export interface UseShopInstallDismissalOptions {
  readonly shopSlug: string;
  /** Mirror the install-flow hook's isShopInstalled so permanent
   *  suppression kicks in immediately on install · we don't wait
   *  for a reload to re-read localStorage. */
  readonly isShopInstalled: boolean;
  /** Mirror the install-flow hook's isStandalone so we never show
   *  a shop install prompt to someone already in PWA mode. */
  readonly isStandalone: boolean;
}

export interface UseShopInstallDismissalResult {
  /** True when the slide-in SHOULD render right now. Owners of the
   *  slide-in component just mount/unmount based on this flag. */
  readonly shouldShowSlideIn: boolean;
  /** Record a dismiss (close "X"). Flips state per spec §C. */
  readonly recordDismiss: () => void;
  /** Mark permanent suppression · used by install triggers so a
   *  completed install never re-prompts. The install-flow hook's
   *  `onInstalled` callback should forward to this. */
  readonly recordInstall: () => void;
}

/** Spec §C state machine: first visit → show · 1st X → hide + wait
 *  5 min · 2nd X → permanent suppression · install → permanent
 *  suppression. Per-customer per-shop · guest state in localStorage. */
export function useShopInstallDismissal({
  shopSlug,
  isShopInstalled,
  isStandalone,
}: UseShopInstallDismissalOptions): UseShopInstallDismissalResult {
  const [record, setRecord] = React.useState<ShopDismissalRecord>({
    dismissals: 0,
  });
  const [hydrated, setHydrated] = React.useState(false);
  // Monotonically ticks on a 30 s interval so the "5 minutes since
  // first dismiss" gate re-evaluates without us needing an explicit
  // setTimeout per record. We only tick while dismissals === 1 so
  // the common case (0 or 2) stays zero-cost.
  const [, setNow] = React.useState<number>(() => Date.now());

  // Hydrate from localStorage AFTER mount so SSR and the first
  // client paint agree (both start at dismissals: 0 · "detecting"
  // state in the install-flow hook holds back the UI anyway).
  React.useEffect(() => {
    const map = readDismissalMap();
    const existing = map[shopSlug];
    if (existing) setRecord(existing);
    setHydrated(true);
  }, [shopSlug]);

  // Tick every 30 s while waiting for the 5-min window · minimal
  // impact · stops as soon as dismissals leaves 1.
  React.useEffect(() => {
    if (record.dismissals !== 1) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 30 * 1000);
    return () => window.clearInterval(id);
  }, [record.dismissals]);

  // Visibility rule per spec §C · plus never-show guards from §E.
  const shouldShowSlideIn = React.useMemo(() => {
    if (!hydrated) return false;
    if (isStandalone) return false;
    if (isShopInstalled) return false;
    if (record.suppressed) return false;
    if (record.dismissals === 2) return false;
    if (record.dismissals === 0) return true;
    // dismissals === 1 · 5-min cooldown gate.
    if (record.firstDismissAt == null) return true;
    return Date.now() - record.firstDismissAt >= SECOND_SHOW_DELAY_MS;
  }, [hydrated, isStandalone, isShopInstalled, record]);

  const persist = React.useCallback(
    (next: ShopDismissalRecord) => {
      setRecord(next);
      const map = readDismissalMap();
      map[shopSlug] = next;
      writeDismissalMap(map);
    },
    [shopSlug],
  );

  const recordDismiss = React.useCallback(() => {
    setRecord((current) => {
      let next: ShopDismissalRecord;
      if (current.dismissals === 0) {
        next = {
          dismissals: 1,
          firstDismissAt: Date.now(),
          suppressed: false,
        };
      } else if (current.dismissals === 1) {
        next = {
          dismissals: 2,
          firstDismissAt: current.firstDismissAt ?? Date.now(),
          suppressed: true,
        };
      } else {
        next = current; // already at terminal state · no-op
      }
      const map = readDismissalMap();
      map[shopSlug] = next;
      writeDismissalMap(map);
      return next;
    });
  }, [shopSlug]);

  const recordInstall = React.useCallback(() => {
    const next: ShopDismissalRecord = {
      dismissals: record.dismissals,
      firstDismissAt: record.firstDismissAt ?? null,
      suppressed: true,
    };
    persist(next);
  }, [record, persist]);

  return {
    shouldShowSlideIn,
    recordDismiss,
    recordInstall,
  };
}
