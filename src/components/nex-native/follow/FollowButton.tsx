"use client";

// src/components/nex-native/follow/FollowButton.tsx
//
// Shared Follow primitive · Stage 1 of the sealed Follow architecture.
// Owner-authorised 2026-10-30 per `docs/doctrine/nex-follow-architecture
// -draft-2026-10-30.md` §16 + Stage 1 preparation §13.6.
//
// Behaviour (sealed per §12 O-3):
//   · Not-following → shows "Follow" (filled accent).
//   · Following     → shows "Following" (outlined). Tap = immediate
//                     unfollow · NO confirmation sheet (sealed
//                     convention · matches like/unlike optimistic
//                     toggle).
//   · Self-view (isSelfAccount=true) → component returns null.
//
// Optimistic UI pattern (matches sealed MusicActionsStack.handleLike):
//   · Tap → immediate state flip + server call
//   · Error → roll back + log (visible via observability counters)
//   · Pending state (D1 Stage 2+) → not shipped Stage 1
//
// Design tokens (sealed design-token rule 2026-10-17):
//   · Uses NEX_FONT_SANS
//   · Accent via theme context when provided · defaults to sealed
//     cyan #00AFFF

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";
import {
  followAction,
  unfollowAction,
} from "@/lib/nex-native/follow/follow-actions";
import type {
  NexFollowErrorCode,
  NexFollowSource,
  NexFollowState,
} from "@/lib/nex-native/follow/types";

export interface FollowButtonProps {
  readonly followeeId: string;
  readonly source: NexFollowSource;
  /** SSR-provided initial state so first paint matches the server
   *  truth (no "Follow → flip to Following" flash on hydration). */
  readonly initialState?: NexFollowState;
  /** Hide the button entirely when the viewer is the followee. The
   *  parent surface (profile page / music slide / live viewer) owns
   *  this check since it already knows both identities. */
  readonly isSelfAccount?: boolean;
  readonly size?: "sm" | "md" | "lg";
  readonly label?: {
    readonly follow?: string;
    readonly following?: string;
  };
  /** Owner-authorised 2026-10-30 · optional theme accent override.
   *  Defaults to sealed NEX cyan. */
  readonly accent?: string;
  /** Fired on every state change (including rollbacks from server
   *  errors). Caller may use this to refresh counts optimistically. */
  readonly onStateChange?: (next: NexFollowState) => void;
  /** Owner-authorised 2026-10-30 · Stage 2 feedback hook · fires
   *  when the server rejects an action (rate-limit · blocked ·
   *  self-follow · internal-error · etc.). Callers may wire a
   *  toast / snack / parent-level feedback. The button already
   *  renders its own perceptual signal (brief shake) so this hook
   *  is additive · no caller is required. */
  readonly onReject?: (reason: NexFollowErrorCode, message: string) => void;
  readonly disabled?: boolean;
}

export function FollowButton(props: FollowButtonProps): React.JSX.Element | null {
  if (props.isSelfAccount === true) return null;

  const [state, setState] = React.useState<NexFollowState>(
    props.initialState ?? "not-following",
  );
  const [pending, setPending] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  // Owner-authorised 2026-10-30 · Stage 2 shake feedback · briefly
  // flashes a shake animation when the server rejects. Hook into
  // the sealed keyframes injected below. 320ms matches the user's
  // perceptual-feedback band (long enough to notice, short enough
  // not to delay re-interaction).
  const [rejectedAtMs, setRejectedAtMs] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (rejectedAtMs === null) return;
    const t = window.setTimeout(() => setRejectedAtMs(null), 340);
    return () => window.clearTimeout(t);
  }, [rejectedAtMs]);

  const accent = props.accent ?? "#00AFFF";
  const size = props.size ?? "md";
  const followLabel = props.label?.follow ?? "Follow";
  const followingLabel = props.label?.following ?? "Following";

  const handleTap = React.useCallback(async (): Promise<void> => {
    if (pending || props.disabled) return;

    // Optimistic flip
    const prev = state;
    const next: NexFollowState = prev === "following" ? "not-following" : "following";
    setState(next);
    setErrorMsg(null);
    setPending(true);
    props.onStateChange?.(next);

    try {
      const result =
        next === "following"
          ? await followAction({ followeeId: props.followeeId, source: props.source })
          : await unfollowAction({ followeeId: props.followeeId });
      if (!result.ok) {
        // Roll back + perceptual feedback + caller hook
        setState(prev);
        setErrorMsg(result.message);
        setRejectedAtMs(Date.now());
        props.onStateChange?.(prev);
        props.onReject?.(result.code, result.message);
      } else {
        // Reconcile against server-authoritative state
        if (result.data.state !== next) {
          setState(result.data.state);
          props.onStateChange?.(result.data.state);
        }
      }
    } catch (e) {
      // Network or unexpected · roll back + perceptual feedback
      setState(prev);
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setRejectedAtMs(Date.now());
      props.onStateChange?.(prev);
      props.onReject?.("internal", msg);
    } finally {
      setPending(false);
    }
  }, [pending, props, state]);

  const dim = size === "sm" ? SM : size === "lg" ? LG : MD;
  const isFollowing = state === "following";
  const rejected = rejectedAtMs !== null;

  return (
    <>
      {/* Scoped keyframes · one declaration per mounted button is
          cheap; the browser dedupes identical rules. Local-scope
          `@keyframes` not possible in inline CSS so we inject the
          animation as a reusable global rule under a NEX-prefix. */}
      <style>{SHAKE_KEYFRAMES_CSS}</style>
      <button
        type="button"
        data-nex-follow-button
        data-nex-follow-state={state}
        data-nex-follow-pending={pending ? "true" : "false"}
        data-nex-follow-rejected={rejected ? "true" : "false"}
        aria-pressed={isFollowing}
        aria-busy={pending}
        aria-label={isFollowing ? followingLabel : followLabel}
        onClick={handleTap}
        disabled={props.disabled === true}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: dim.padding,
          borderRadius: 999,
          fontFamily: NEX_FONT_SANS,
          fontSize: dim.fontSize,
          fontWeight: 800,
          letterSpacing: "0.02em",
          cursor: props.disabled ? "not-allowed" : "pointer",
          background: isFollowing ? "transparent" : accent,
          color: isFollowing ? accent : "#031018",
          border: `1.5px solid ${accent}`,
          opacity: pending ? 0.72 : 1,
          transition:
            "background 160ms ease-out, color 160ms ease-out, opacity 160ms ease-out",
          minWidth: dim.minWidth,
          minHeight: 44,
          animation: rejected ? "nex-follow-shake 320ms ease-out" : undefined,
        }}
        title={errorMsg ?? undefined}
      >
        {isFollowing ? followingLabel : followLabel}
      </button>
    </>
  );
}

const SHAKE_KEYFRAMES_CSS = `
@keyframes nex-follow-shake {
  0%   { transform: translateX(0); }
  18%  { transform: translateX(-6px); }
  36%  { transform: translateX(6px); }
  54%  { transform: translateX(-4px); }
  72%  { transform: translateX(4px); }
  90%  { transform: translateX(-2px); }
  100% { transform: translateX(0); }
}
`;

const SM = { padding: "6px 14px", fontSize: 12, minWidth: 92 } as const;
const MD = { padding: "9px 20px", fontSize: 13, minWidth: 110 } as const;
const LG = { padding: "12px 26px", fontSize: 14, minWidth: 128 } as const;
