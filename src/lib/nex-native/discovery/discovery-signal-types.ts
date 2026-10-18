// src/lib/nex-native/discovery/discovery-signal-types.ts
//
// NEX Discovery · signal type definitions · P2 of the recommended
// discovery system · owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Shared, edge-safe type contract used by:
//   · discovery-signal-service.ts : server-side writer
//   · future directory-card instrumentation (view / tap signals)
//   · future chat / save surfaces that fire interaction signals
//
// Doctrine (per the sealed NEX Directory Spine, 2026-10-07):
//
//   NEX Intelligence  = what-is-TRUE
//   NEX Directory     = what-is-safe-to-PUBLISH
//   NEX Business      = owner-CONTROLS
//   NEX Marketing     = acquisition-opportunities · DOWNSTREAM ONLY
//
// Discovery signals belong in the MARKETING / DISCOVERY layer.
// They READ from the Directory, they NEVER write to the Intelligence
// or Directory canonical tables. The signal table (`nex.discovery_
// signal`, see migration 208) is a sibling layer · its data informs
// personalised ranking (P3+) without ever touching truth.
//
// Zero PII leakage: signals carry only (account_id, signal_type,
// business_id?, metadata.jsonb). Metadata is opaque to the Directory
// layer · ranking policies may read it but no truth derivation
// uses it.

/** The enumerated signal types the discovery system records. New
 *  types require a doctrine review before they can be added · they
 *  determine what the ranking layer can derive about user intent. */
export const DISCOVERY_SIGNAL_TYPES = [
  // User saw a card render in viewport. The lightest signal · we
  // weigh it low in any ranking policy because card impressions
  // happen passively.
  "view",
  // User tapped a card to open the business cover page. Stronger
  // than view · reflects intent-to-explore.
  "tap",
  // User initiated a chat with the business from a directory card
  // or the business cover. Strongest intent signal.
  "chat_open",
  // User explicitly saved / bookmarked the business for later.
  "save",
  // User explicitly dismissed / "not interested" · negative signal
  // for the ranking policy (filter out, not just downweight).
  "dismiss",
] as const;

export type DiscoverySignalType = (typeof DISCOVERY_SIGNAL_TYPES)[number];

export function isDiscoverySignalType(
  value: unknown,
): value is DiscoverySignalType {
  return (
    typeof value === "string" &&
    (DISCOVERY_SIGNAL_TYPES as readonly string[]).includes(value)
  );
}

/** Input shape for the server-side writer. All fields are server-
 *  trusted · the caller is responsible for validating the user's
 *  session and that the business id (when present) belongs to a
 *  real nex_business or canonical row. */
export interface DiscoverySignalInput {
  /** The signed-in user generating the signal. */
  readonly accountId: string;
  /** The signal type · must be a member of DiscoverySignalType. */
  readonly signalType: DiscoverySignalType;
  /** Optional business this signal is about · present for all
   *  signals except (future) "pure navigation" events. */
  readonly businessId: string | null;
  /** Opaque metadata · pure JSON (no functions, no undefined). The
   *  Directory layer never introspects this · ranking policies may.
   *  Keep payloads small (< 1 KB serialised) · the field is NOT
   *  intended as a general-purpose event log. */
  readonly metadata: Record<string, unknown>;
}

/** Outcome of a signal write. Honest about what happened · callers
 *  that need to retry or fall back can switch on `kind`. */
export type DiscoverySignalOutcome =
  | { readonly kind: "written"; readonly id: string }
  | { readonly kind: "skipped-no-pipeline" }
  | { readonly kind: "skipped-no-session" }
  | { readonly kind: "skipped-invalid"; readonly reason: string }
  | { readonly kind: "failed"; readonly reason: string };
