"use client";

// src/components/nex-native/drawer/UnifiedDrawer.tsx
//
// NEX unified drawer · composition root · owner directive 2026-11-01.
// --------------------------------------------------------------------
// The ONE drawer architecture shared across every NEX country app
// AND Worldwide. One structure · one navigation experience · many
// country identities applied through the active-app/world CSS vars.
//
// Owner-sealed constraints (owner directive 2026-11-01):
//
//   §1 Global architecture
//     Build ONE reusable drawer. Do NOT build separate Ireland /
//     Indonesia / Worldwide drawer implementations.
//
//   §2 Country-specific visual identity
//     The drawer inherits palette from the DEPLOYMENT'S active world
//     via CSS vars (--nex-world-drawer-bg, --nex-world-primary-ink,
//     --nex-world-live-drawer-edge-light-display, etc.). The user's
//     account country / phone / IP / travel location does NOT drive
//     drawer chrome. A user visiting Ireland while using the
//     Indonesia app still sees Indonesia chrome.
//
//   §4 No dead buttons · no invented features
//     Every ContextStrip row must be verified against existing
//     routes + permissions by the CALLER before being passed in.
//     This component is dumb composition; it renders what it's given.
//
//   §5 Preserve all sealed ControlDrawer functionality
//     Identity bar · Emergency Help · YOUR NEX · YOUR BUSINESS ·
//     PREFERENCES & SUPPORT · Logout · Business Vault entitlement
//     gate all stay exactly as sealed in control-drawer-client.tsx.
//     The simplest way to honour that in Batch D: when no
//     ContextStrip is supplied, delegate the entire render to the
//     sealed ControlDrawer. No duplication, no regression surface.
//
// Reversibility (Batch B+C+D):
//   This file is new. Deleting it + reverting the `_contacts-header`
//   import switch restores the prior state exactly. No sealed file
//   is modified by this batch.
//
// Rollout schedule:
//   Batch D (now):  Delegate-only. Contacts has no ContextStrip, so
//                   UnifiedDrawer just renders <ControlDrawer/>. The
//                   migration is a one-import-line swap in
//                   `_contacts-header.tsx`.
//   Batch E (Feed): Introduce the composed path. When Feed supplies
//                   a ContextStrip, UnifiedDrawer wraps BaseDrawer +
//                   ContextStrip + the ControlDrawer universal body
//                   (either by reusing the sealed component in a
//                   portal-less mode, or by extracting its body into
//                   a shared primitive — decision taken at that
//                   batch's design review, not now).
//   Batches F-K:    Each surface supplies its own ContextStrip and
//                   switches to UnifiedDrawer independently.

import * as React from "react";
import {
  ControlDrawer,
  type ControlDrawerProps,
  type ControlDrawerSession,
} from "../control-drawer/control-drawer-client";
import type { ContextStripProps } from "./ContextStrip";

// Re-export the sealed session type so callers import from one place
// (`@/components/nex-native/drawer/UnifiedDrawer`) rather than reaching
// into the legacy control-drawer path. Legacy imports continue to work.
export type { ControlDrawerSession as UnifiedDrawerSession };

export interface UnifiedDrawerProps extends ControlDrawerProps {
  /** Optional surface-specific action list rendered above the
   *  universal drawer body. When null / omitted (Batch D on
   *  Contacts, Packages, Settings, Welcome, etc.) the drawer
   *  renders the sealed universal body unchanged.
   *
   *  Callers MUST verify each row's route + permission before
   *  constructing the strip. See the no-dead-buttons rule above. */
  readonly contextStrip?: ContextStripProps | null;
  // NOTE on Batch D+ Creator-Support props:
  //   `viewerEarnedCreatorBadges`, `viewerCreatorSupportConfigured`,
  //   and `hideCreatorSupportRow` are declared on `ControlDrawerProps`
  //   (the base interface). Because `UnifiedDrawerProps extends
  //   ControlDrawerProps`, they flow through automatically — callers
  //   pass them on `<UnifiedDrawer ... />` and they're spread into the
  //   underlying `<ControlDrawer ... />` by the delegate below.
  //   No pass-through wiring is required here.
}

export function UnifiedDrawer(props: UnifiedDrawerProps): React.JSX.Element {
  const { contextStrip, ...controlDrawerProps } = props;

  // Batch D path: no ContextStrip supplied → delegate directly to the
  // sealed ControlDrawer. Zero visible change for migrated surfaces,
  // zero regression surface, zero duplication.
  if (!contextStrip || contextStrip.rows.length === 0) {
    return <ControlDrawer {...controlDrawerProps} />;
  }

  // Future (Batch E+): compose BaseDrawer + ContextStrip + universal
  // body. Not implemented in this batch — the composition surface is
  // designed with Feed in mind so we don't over-commit to a shape
  // before the first real consumer arrives.
  //
  // Honest fallback: if a caller supplies a ContextStrip before Batch E
  // ships the composed path, we delegate (strip is silently dropped)
  // AND log a dev warning so the regression is noticed in review. In
  // production we never want to crash a drawer render over a
  // not-yet-implemented feature.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      "[UnifiedDrawer] ContextStrip was supplied but composition " +
        "arrives in Batch E (Feed). Falling back to the sealed " +
        "universal body for now. sectionLabel=",
      contextStrip.sectionLabel,
      "rows=",
      contextStrip.rows.length,
    );
  }
  return <ControlDrawer {...controlDrawerProps} />;
}
