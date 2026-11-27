// src/lib/nex-native/shop-install/merge-shop-install-records.ts
//
// Pure merge rule for the shop-install dismissal + install state machine.
// Split out of sync-shop-install-prefs.ts on 2026-11-27 because that file
// carries "use server" · Next.js 16 rejects any non-async export from a
// Server Actions module, and this function is deliberately synchronous
// (pure · no I/O · exhaustively unit-tested).
//
// -----------------------------------------------------------------------------
// Merge contract (binding · documented in migration 369 header)
// -----------------------------------------------------------------------------
// "Most-advanced wins". When client (localStorage) state and server row
// disagree, the merged record is:
//
//   · dismissals        := MAX(local.dismissals, server.dismissals)
//   · first_dismiss_at  := the EARLIER of the two non-null timestamps
//                          (so the Spec §C 5-minute cooldown fires from
//                          the FIRST dismiss across any device)
//   · suppressed        := local.suppressed OR server.suppressed
//   · installed         := local.installed OR server.installed
//
// The merge is monotonic. Once a user has reached dismissals=2, been
// suppressed, or installed the shop, a stale device-local record can
// never undo that state.

/** Client-side record shape · mirrors `ShopDismissalRecord` +
 *  INSTALLED_FLAGS_KEY in use-shop-install-flow.ts. Kept here (not
 *  imported from the client module) so neither the server action nor
 *  this pure helper pull a "use client" hook into a server bundle. */
export interface ShopInstallClientRecord {
  readonly shopSlug: string;
  readonly dismissals: 0 | 1 | 2;
  /** Wall-clock ms of the FIRST dismissal · null when dismissals=0. */
  readonly firstDismissAt: number | null;
  readonly suppressed: boolean;
  readonly installed: boolean;
}

/** Shape returned from the Postgres row. */
export interface ServerRow {
  readonly dismissals: 0 | 1 | 2;
  /** ISO string from Postgres timestamptz. */
  readonly first_dismiss_at: string | null;
  readonly suppressed: boolean;
  readonly installed: boolean;
}

/** Pure · no I/O · exhaustively exercised by
 *  src/lib/nex-native/__tests__/sync-shop-install-prefs.test.ts. */
export function mergeShopInstallRecords(
  client: ShopInstallClientRecord,
  server: ServerRow | null,
): ShopInstallClientRecord {
  if (!server) return client;
  const serverFirstMs =
    server.first_dismiss_at == null
      ? null
      : Date.parse(server.first_dismiss_at);
  const mergedDismissals = Math.max(client.dismissals, server.dismissals) as 0 | 1 | 2;
  // Earlier-non-null · null only when both inputs are null (which the
  // CHECK constraint says only happens at dismissals=0).
  let mergedFirstDismissAt: number | null = null;
  if (client.firstDismissAt != null && serverFirstMs != null) {
    mergedFirstDismissAt = Math.min(client.firstDismissAt, serverFirstMs);
  } else if (client.firstDismissAt != null) {
    mergedFirstDismissAt = client.firstDismissAt;
  } else if (serverFirstMs != null) {
    mergedFirstDismissAt = serverFirstMs;
  }
  // Invariant: dismissals ≥ 1 implies firstDismissAt is non-null.
  // If this ever fails we treat it as a data-integrity defect · fall
  // forward by stamping now() so the state machine keeps moving
  // rather than surfacing an impossible record to the UI.
  if (mergedDismissals >= 1 && mergedFirstDismissAt == null) {
    mergedFirstDismissAt = Date.now();
  }
  return {
    shopSlug: client.shopSlug,
    dismissals: mergedDismissals,
    firstDismissAt: mergedDismissals === 0 ? null : mergedFirstDismissAt,
    suppressed: client.suppressed || server.suppressed,
    installed: client.installed || server.installed,
  };
}
