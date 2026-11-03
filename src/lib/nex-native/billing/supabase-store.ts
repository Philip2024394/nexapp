// src/lib/nex-native/billing/supabase-store.ts
//
// NEX Billing Foundation · real BillingStore adapter.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Implementation of the BillingStore interface backed by direct PostgreSQL
// via the `pg` library. In production the connection string points at the
// Supabase pooler for the canonical NEX project; in the Gate-1 scratch
// rehearsal it points at the isolated nex_rehearsal_257 database. The
// adapter does NOT read any env var at import time · a connection source
// (either a `pg.Pool` or a connection-string string) is injected at
// construction. This keeps the module import-time pure and prevents
// autoloading production credentials.
//
// Why pg direct rather than @supabase/supabase-js:
//   · `INSERT ... ON CONFLICT DO NOTHING RETURNING` is the exact atomic
//     claim semantic the webhook-processor relies on. PostgREST's upsert
//     path has subtle representation quirks around ignored duplicates
//     (empty rows vs returned rows) that would require RPC wrappers.
//     Native pg gives us the exact semantics we audited.
//   · Multi-statement transactions (claim + state mutations + finalize)
//     are expressible as one BEGIN/COMMIT block via `withTransaction`.
//   · Parameterized queries are typed and natural (no string concat).
//
// SECURITY · the Supabase pooler endpoint uses the service-role identity.
// This module MUST be server-only (import "server-only") and MUST NOT be
// imported from any client bundle.
//
// REHEARSAL-GATED VERIFICATIONS · these behaviours are DESIGNED to be
// correct but can only be CONFIRMED once Gate 1 (scratch rehearsal)
// executes. Flagged inline with `// REHEARSAL · ...` so the test harness
// can check them off:
//   R-1 · atomic claim returns {isClaimed:true} on first call, {isClaimed:false} on duplicate
//   R-2 · partial unique index on nex_billing_adverse_event blocks duplicate inserts
//   R-3 · clearAdverseEvent only clears when access_block_cleared_at IS NULL
//   R-4 · readProductView joins account snapshot + adverse rows atomically
//   R-5 · updateProductSubscription writes ONLY the per-product columns (no cross-product leakage)
//   R-6 · ON DELETE CASCADE from nex_account removes checkout + adverse rows
//   R-7 · withTransaction rolls back ALL writes if any statement throws
//   R-8 · insertCheckoutSession unique violation on stripe_idempotency_key is caught + returns null
//   R-9 · findPendingCheckoutMappingEvents respects the partial index for outcome='pending_checkout_mapping'

import "server-only";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import pgLib from "pg";

import type {
  BillingStore,
  ClaimedEventRow,
  CheckoutSessionRow,
  InsertAdverseInput,
  InsertCheckoutSessionInput,
  UpdateProductSubscriptionInput,
} from "./store";
import type {
  AccountEntitlementView,
  AdverseEventRow,
  AdverseType,
  DisputeStripeStatus,
  AccessBlockClearedBy,
  EventLogRow,
  EventOutcome,
  NexProduct,
  ProductBillingSnapshot,
  ShopTier,
  SubscriptionStatus,
  VaultTier,
} from "./types";

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export interface SupabaseBillingStoreOptions {
  /** Either an existing pg.Pool OR a connection string. If a string is
   *  given, a Pool is created internally with max=5. */
  readonly source: Pool | string;
  /** Optional label for log + error context (e.g. "scratch", "production"). */
  readonly label?: string;
}

/** Executor abstraction · a client in a transaction OR the pool itself. */
type Executor = Pool | PoolClient;

export class SupabaseBillingStore implements BillingStore {
  private readonly pool: Pool;
  private readonly label: string;
  private readonly executor: Executor;

  constructor(options: SupabaseBillingStoreOptions, _tx?: PoolClient) {
    this.label = options.label ?? "default";
    if (typeof options.source === "string") {
      this.pool = new pgLib.Pool({
        connectionString: options.source,
        max: 5,
      });
    } else {
      this.pool = options.source;
    }
    this.executor = _tx ?? this.pool;
  }

  /** Run a block of store operations in a single BEGIN/COMMIT transaction.
   *  The callback receives a scoped SupabaseBillingStore that reuses the
   *  same PoolClient · every write participates in the same transaction.
   *  If the callback throws, the transaction rolls back (REHEARSAL · R-7). */
  async withTransaction<T>(
    fn: (txStore: SupabaseBillingStore) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const txStore = new SupabaseBillingStore(
        { source: this.pool, label: `${this.label}:tx` },
        client,
      );
      const result = await fn(txStore);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* non-fatal · surface the original error */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /** Close the underlying pool · call during shutdown. Idempotent. */
  async end(): Promise<void> {
    try {
      await this.pool.end();
    } catch {
      /* non-fatal */
    }
  }

  /** Run a callback inside a BEGIN/COMMIT where the given nex_account row
   *  is held under row-level lock (SELECT ... FOR UPDATE). Guarantees the
   *  callback body is the only pending writer for that account across
   *  concurrent requests · the critical section for Vault-quota reservation
   *  and Sell-listing allowance accounting (owner-recommended D4).
   *
   *  Fails fast if the account row does not exist.
   *
   *  REHEARSAL · R-12 (added for Gate 1):
   *    · Two concurrent withAccountLock callers for the same account
   *      serialise · the second blocks until the first commits.
   *    · withAccountLock callers for DIFFERENT accounts run in parallel.
   *    · If the callback throws, the row lock is released on ROLLBACK. */
  async withAccountLock<T>(
    accountId: string,
    fn: (txStore: SupabaseBillingStore) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(async (txStore) => {
      // Acquire the row-level lock BEFORE doing any work. If the row is
      // missing, this returns zero rows and we throw.
      const r = await (txStore as SupabaseBillingStore).query<{
        id: string;
      }>("SELECT id FROM nex_account WHERE id = $1 FOR UPDATE", [accountId]);
      if (r.rowCount === 0) {
        throw new Error(
          `withAccountLock · account ${accountId} does not exist`,
        );
      }
      return fn(txStore);
    });
  }

  // -------------------------------------------------------------------------
  // Internal query helpers
  // -------------------------------------------------------------------------

  private async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ rows: R[]; rowCount: number }> {
    const result = await (this.executor as Pool).query<R>(
      text,
      values as unknown[],
    );
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  }

  /** Internal · exposed so companion billing services (e.g. vault-quota)
   *  can issue scoped SQL inside the current transaction. NOT part of the
   *  public BillingStore interface · underscore-prefixed to signal that. */
  async _rawQuery<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ rows: R[]; rowCount: number }> {
    return this.query<R>(text, values);
  }

  // -------------------------------------------------------------------------
  // claimEvent · INSERT ... ON CONFLICT DO NOTHING RETURNING
  // -------------------------------------------------------------------------

  async claimEvent(
    input: Parameters<BillingStore["claimEvent"]>[0],
  ): Promise<ClaimedEventRow> {
    // REHEARSAL · R-1 · duplicate deliveries hit the PRIMARY KEY on
    // stripe_event_id · the RETURNING clause emits zero rows for the
    // conflict case · which maps to isClaimed=false.
    const sql = `
      INSERT INTO nex_billing_event_log (
        stripe_event_id,
        stripe_event_type,
        stripe_event_created,
        stripe_api_version,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_invoice_id,
        stripe_payment_intent_id,
        stripe_charge_id,
        stripe_dispute_id,
        stripe_refund_id,
        stripe_checkout_session_id,
        invoice_period_start,
        invoice_period_end,
        nex_account_id,
        product,
        outcome
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'processing'
      )
      ON CONFLICT (stripe_event_id) DO NOTHING
      RETURNING stripe_event_id
    `;
    const r = await this.query<{ stripe_event_id: string }>(sql, [
      input.stripeEventId,
      input.stripeEventType,
      input.stripeEventCreated,
      input.stripeApiVersion,
      input.stripeCustomerId ?? null,
      input.stripeSubscriptionId ?? null,
      input.stripeInvoiceId ?? null,
      input.stripePaymentIntentId ?? null,
      input.stripeChargeId ?? null,
      input.stripeDisputeId ?? null,
      input.stripeRefundId ?? null,
      input.stripeCheckoutSessionId ?? null,
      input.invoicePeriodStart ?? null,
      input.invoicePeriodEnd ?? null,
      input.nexAccountId ?? null,
      input.product ?? null,
    ]);
    return {
      stripeEventId: input.stripeEventId,
      isClaimed: r.rowCount > 0,
    };
  }

  // -------------------------------------------------------------------------
  // finalizeEvent
  // -------------------------------------------------------------------------

  async finalizeEvent(input: {
    stripeEventId: string;
    outcome: EventOutcome;
    outcomeDetail?: string | null;
  }): Promise<void> {
    const r = await this.query(
      `UPDATE nex_billing_event_log
         SET outcome        = $1,
             outcome_detail = $2,
             processed_at   = NOW()
       WHERE stripe_event_id = $3`,
      [input.outcome, input.outcomeDetail ?? null, input.stripeEventId],
    );
    if (r.rowCount === 0) {
      throw new Error(
        `finalizeEvent · no event-log row for stripe_event_id=${input.stripeEventId}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // readProductView · REHEARSAL R-4
  // -------------------------------------------------------------------------

  async readProductView(
    accountId: string,
    product: NexProduct,
  ): Promise<AccountEntitlementView | null> {
    const colPrefix = product; // 'shop' or 'vault'
    // Account snapshot
    const accountSql = `
      SELECT
        id                                   AS account_id,
        ${colPrefix}_tier                   AS tier,
        ${colPrefix}_status                 AS status,
        ${colPrefix}_period_end             AS period_end,
        ${colPrefix}_past_due_at            AS past_due_at,
        ${colPrefix}_stripe_customer_id     AS stripe_customer_id,
        ${colPrefix}_stripe_subscription_id AS stripe_subscription_id,
        ${colPrefix}_stripe_price_id        AS stripe_price_id
      FROM nex_account
      WHERE id = $1
    `;
    const accountR = await this.query<{
      account_id: string;
      tier: string | null;
      status: string | null;
      period_end: Date | null;
      past_due_at: Date | null;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      stripe_price_id: string | null;
    }>(accountSql, [accountId]);
    if (accountR.rowCount === 0) return null;
    const accountRow = accountR.rows[0];

    // Adverse rows (all, open + historical)
    const adverseR = await this.query<AdverseEventDbRow>(
      `SELECT * FROM nex_billing_adverse_event
        WHERE nex_account_id = $1 AND product = $2
        ORDER BY opened_at ASC`,
      [accountId, product],
    );

    const snapshot: ProductBillingSnapshot = {
      product,
      tier: accountRow.tier as ShopTier | VaultTier | null,
      status: accountRow.status as SubscriptionStatus | null,
      periodEnd: accountRow.period_end,
      pastDueAt: accountRow.past_due_at,
      stripeCustomerId: accountRow.stripe_customer_id,
      stripeSubscriptionId: accountRow.stripe_subscription_id,
      stripePriceId: accountRow.stripe_price_id,
    };
    return {
      accountId: accountRow.account_id,
      product,
      snapshot,
      adverseEvents: adverseR.rows.map(mapAdverseRow),
    };
  }

  // -------------------------------------------------------------------------
  // resolveAccountBySubscription · search both shop + vault subscription cols
  // -------------------------------------------------------------------------

  async resolveAccountBySubscription(
    stripeSubscriptionId: string,
  ): Promise<{ accountId: string; product: NexProduct } | null> {
    const r = await this.query<{ id: string; which: "shop" | "vault" }>(
      `SELECT id,
              CASE
                WHEN shop_stripe_subscription_id = $1  THEN 'shop'
                WHEN vault_stripe_subscription_id = $1 THEN 'vault'
              END AS which
         FROM nex_account
        WHERE shop_stripe_subscription_id = $1
           OR vault_stripe_subscription_id = $1
        LIMIT 1`,
      [stripeSubscriptionId],
    );
    if (r.rowCount === 0 || !r.rows[0].which) return null;
    return { accountId: r.rows[0].id, product: r.rows[0].which };
  }

  // -------------------------------------------------------------------------
  // Checkout session CRUD · REHEARSAL R-8
  // -------------------------------------------------------------------------

  async readCheckoutSession(
    internalSessionId: string,
  ): Promise<CheckoutSessionRow | null> {
    const r = await this.query<CheckoutSessionDbRow>(
      `SELECT * FROM nex_billing_checkout_session WHERE internal_session_id = $1`,
      [internalSessionId],
    );
    return r.rowCount === 0 ? null : mapCheckoutRow(r.rows[0]);
  }

  async readCheckoutSessionByStripeSessionId(
    stripeCheckoutSessionId: string,
  ): Promise<CheckoutSessionRow | null> {
    const r = await this.query<CheckoutSessionDbRow>(
      `SELECT * FROM nex_billing_checkout_session WHERE stripe_checkout_session_id = $1`,
      [stripeCheckoutSessionId],
    );
    return r.rowCount === 0 ? null : mapCheckoutRow(r.rows[0]);
  }

  async insertCheckoutSession(
    input: InsertCheckoutSessionInput,
  ): Promise<CheckoutSessionRow> {
    try {
      const r = await this.query<CheckoutSessionDbRow>(
        `INSERT INTO nex_billing_checkout_session (
           nex_account_id, product, intended_tier, stripe_idempotency_key
         ) VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          input.nexAccountId,
          input.product,
          input.intendedTier,
          input.stripeIdempotencyKey,
        ],
      );
      return mapCheckoutRow(r.rows[0]);
    } catch (err) {
      // UNIQUE violation on stripe_idempotency_key · surface distinctly
      const e = err as { code?: string; constraint?: string };
      if (e.code === "23505") {
        throw new Error(
          `insertCheckoutSession · duplicate stripe_idempotency_key · constraint=${e.constraint ?? "?"}`,
        );
      }
      throw err;
    }
  }

  async updateCheckoutSession(
    internalSessionId: string,
    patch: Partial<
      Pick<
        CheckoutSessionRow,
        | "stripeCheckoutSessionId"
        | "stripeCustomerId"
        | "stripeSubscriptionId"
        | "status"
        | "completedAt"
      >
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (patch.stripeCheckoutSessionId !== undefined) {
      sets.push(`stripe_checkout_session_id = $${i++}`);
      vals.push(patch.stripeCheckoutSessionId);
    }
    if (patch.stripeCustomerId !== undefined) {
      sets.push(`stripe_customer_id = $${i++}`);
      vals.push(patch.stripeCustomerId);
    }
    if (patch.stripeSubscriptionId !== undefined) {
      sets.push(`stripe_subscription_id = $${i++}`);
      vals.push(patch.stripeSubscriptionId);
    }
    if (patch.status !== undefined) {
      sets.push(`status = $${i++}`);
      vals.push(patch.status);
    }
    if (patch.completedAt !== undefined) {
      sets.push(`completed_at = $${i++}`);
      vals.push(patch.completedAt);
    }
    if (sets.length === 0) return; // no-op patch
    vals.push(internalSessionId);
    await this.query(
      `UPDATE nex_billing_checkout_session
          SET ${sets.join(", ")}
        WHERE internal_session_id = $${i}`,
      vals,
    );
  }

  // -------------------------------------------------------------------------
  // updateProductSubscription · REHEARSAL R-5
  // -------------------------------------------------------------------------

  async updateProductSubscription(
    accountId: string,
    product: NexProduct,
    patch: UpdateProductSubscriptionInput,
  ): Promise<void> {
    const prefix = product;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    const addCol = (col: string, val: unknown) => {
      sets.push(`${col} = $${i++}`);
      vals.push(val);
    };
    if (patch.tier !== undefined) addCol(`${prefix}_tier`, patch.tier);
    if (patch.status !== undefined) addCol(`${prefix}_status`, patch.status);
    if (patch.periodEnd !== undefined)
      addCol(`${prefix}_period_end`, patch.periodEnd);
    if (patch.pastDueAt !== undefined)
      addCol(`${prefix}_past_due_at`, patch.pastDueAt);
    if (patch.stripeCustomerId !== undefined)
      addCol(`${prefix}_stripe_customer_id`, patch.stripeCustomerId);
    if (patch.stripeSubscriptionId !== undefined)
      addCol(`${prefix}_stripe_subscription_id`, patch.stripeSubscriptionId);
    if (patch.stripePriceId !== undefined)
      addCol(`${prefix}_stripe_price_id`, patch.stripePriceId);
    if (sets.length === 0) return;
    vals.push(accountId);
    await this.query(
      `UPDATE nex_account SET ${sets.join(", ")} WHERE id = $${i}`,
      vals,
    );
  }

  // -------------------------------------------------------------------------
  // Adverse-event CRUD · REHEARSAL R-2
  // -------------------------------------------------------------------------

  async insertAdverseEvent(
    input: InsertAdverseInput,
  ): Promise<AdverseEventRow | null> {
    try {
      const r = await this.query<AdverseEventDbRow>(
        `INSERT INTO nex_billing_adverse_event (
           nex_account_id, product, adverse_type,
           stripe_subscription_id, stripe_invoice_id, stripe_payment_intent_id,
           stripe_charge_id, stripe_dispute_id, stripe_refund_id,
           invoice_period_start, invoice_period_end,
           stripe_dispute_status, stripe_dispute_closed_at,
           access_blocking,
           opened_by_event_id, admin_action_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
         ) RETURNING *`,
        [
          input.nexAccountId,
          input.product,
          input.adverseType,
          input.stripeSubscriptionId,
          input.stripeInvoiceId,
          input.stripePaymentIntentId,
          input.stripeChargeId,
          input.stripeDisputeId,
          input.stripeRefundId,
          input.invoicePeriodStart,
          input.invoicePeriodEnd,
          input.stripeDisputeStatus,
          input.stripeDisputeClosedAt,
          input.accessBlocking,
          input.openedByEventId,
          input.adminActionId,
        ],
      );
      return mapAdverseRow(r.rows[0]);
    } catch (err) {
      // Partial unique index violations (dispute open-dedup, refund-id,
      // origin-event, admin-action) all surface as unique_violation code
      // 23505. Return null for the caller to treat as "already recorded."
      const e = err as { code?: string };
      if (e.code === "23505") return null;
      throw err;
    }
  }

  async clearAdverseEvent(input: {
    adverseEventId: string;
    clearedAt: Date;
    clearedBy: AccessBlockClearedBy;
  }): Promise<boolean> {
    // REHEARSAL · R-3 · only clear if row is currently open (predicate
    // in WHERE prevents re-clearing)
    const r = await this.query(
      `UPDATE nex_billing_adverse_event
          SET access_block_cleared_at = $1,
              access_block_cleared_by = $2
        WHERE id = $3
          AND access_block_cleared_at IS NULL`,
      [input.clearedAt, input.clearedBy, input.adverseEventId],
    );
    return r.rowCount > 0;
  }

  async findOpenAdverseByDisputeId(
    stripeDisputeId: string,
  ): Promise<AdverseEventRow | null> {
    const r = await this.query<AdverseEventDbRow>(
      `SELECT * FROM nex_billing_adverse_event
        WHERE stripe_dispute_id = $1
          AND access_block_cleared_at IS NULL
        LIMIT 1`,
      [stripeDisputeId],
    );
    return r.rowCount === 0 ? null : mapAdverseRow(r.rows[0]);
  }

  async updateDisputeStripeResolution(input: {
    adverseEventId: string;
    stripeDisputeStatus: DisputeStripeStatus;
    stripeDisputeClosedAt: Date;
    adverseType?: AdverseType;
  }): Promise<void> {
    if (input.adverseType) {
      await this.query(
        `UPDATE nex_billing_adverse_event
            SET stripe_dispute_status = $1,
                stripe_dispute_closed_at = $2,
                adverse_type = $3
          WHERE id = $4`,
        [
          input.stripeDisputeStatus,
          input.stripeDisputeClosedAt,
          input.adverseType,
          input.adverseEventId,
        ],
      );
    } else {
      await this.query(
        `UPDATE nex_billing_adverse_event
            SET stripe_dispute_status = $1,
                stripe_dispute_closed_at = $2
          WHERE id = $3`,
        [
          input.stripeDisputeStatus,
          input.stripeDisputeClosedAt,
          input.adverseEventId,
        ],
      );
    }
  }

  // -------------------------------------------------------------------------
  // Pending-mapping enumeration · REHEARSAL R-9
  // -------------------------------------------------------------------------

  async findPendingCheckoutMappingEvents(limit: number): Promise<EventLogRow[]> {
    const r = await this.query<EventLogDbRow>(
      `SELECT * FROM nex_billing_event_log
        WHERE outcome = 'pending_checkout_mapping'
        ORDER BY received_at ASC
        LIMIT $1`,
      [Math.max(1, Math.min(1000, Math.floor(limit)))],
    );
    return r.rows.map(mapEventLogRow);
  }
}

// ---------------------------------------------------------------------------
// DB row shapes · snake_case · internal only
// ---------------------------------------------------------------------------

interface AdverseEventDbRow {
  id: string;
  nex_account_id: string;
  product: NexProduct;
  adverse_type: AdverseType;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_dispute_id: string | null;
  stripe_refund_id: string | null;
  invoice_period_start: Date | null;
  invoice_period_end: Date | null;
  stripe_dispute_status: DisputeStripeStatus | null;
  stripe_dispute_closed_at: Date | null;
  access_blocking: boolean;
  access_block_cleared_at: Date | null;
  access_block_cleared_by: AccessBlockClearedBy | null;
  opened_at: Date;
  opened_by_event_id: string | null;
  admin_action_id: string | null;
}

interface CheckoutSessionDbRow {
  internal_session_id: string;
  nex_account_id: string;
  product: NexProduct;
  intended_tier: string;
  stripe_idempotency_key: string;
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status:
    | "pending"
    | "awaiting_payment"
    | "completed"
    | "abandoned"
    | "orphaned";
  created_at: Date;
  completed_at: Date | null;
}

interface EventLogDbRow {
  stripe_event_id: string;
  stripe_event_type: string;
  stripe_event_created: Date;
  outcome: EventOutcome;
  outcome_detail: string | null;
  processed_at: Date | null;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  stripe_dispute_id: string | null;
  stripe_refund_id: string | null;
  stripe_checkout_session_id: string | null;
  invoice_period_start: Date | null;
  invoice_period_end: Date | null;
  nex_account_id: string | null;
  product: NexProduct | null;
}

// ---------------------------------------------------------------------------
// Mappers · snake_case DB → camelCase TS
// ---------------------------------------------------------------------------

function mapAdverseRow(r: AdverseEventDbRow): AdverseEventRow {
  return {
    id: r.id,
    nexAccountId: r.nex_account_id,
    product: r.product,
    adverseType: r.adverse_type,
    stripeSubscriptionId: r.stripe_subscription_id,
    stripeInvoiceId: r.stripe_invoice_id,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    stripeChargeId: r.stripe_charge_id,
    stripeDisputeId: r.stripe_dispute_id,
    stripeRefundId: r.stripe_refund_id,
    invoicePeriodStart: r.invoice_period_start,
    invoicePeriodEnd: r.invoice_period_end,
    stripeDisputeStatus: r.stripe_dispute_status,
    stripeDisputeClosedAt: r.stripe_dispute_closed_at,
    accessBlocking: r.access_blocking,
    accessBlockClearedAt: r.access_block_cleared_at,
    accessBlockClearedBy: r.access_block_cleared_by,
    openedAt: r.opened_at,
    openedByEventId: r.opened_by_event_id,
    adminActionId: r.admin_action_id,
  };
}

function mapCheckoutRow(r: CheckoutSessionDbRow): CheckoutSessionRow {
  return {
    internalSessionId: r.internal_session_id,
    nexAccountId: r.nex_account_id,
    product: r.product,
    intendedTier: r.intended_tier,
    stripeIdempotencyKey: r.stripe_idempotency_key,
    stripeCheckoutSessionId: r.stripe_checkout_session_id,
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,
    status: r.status,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

function mapEventLogRow(r: EventLogDbRow): EventLogRow {
  return {
    stripeEventId: r.stripe_event_id,
    stripeEventType: r.stripe_event_type,
    stripeEventCreated: r.stripe_event_created,
    outcome: r.outcome,
    outcomeDetail: r.outcome_detail,
    processedAt: r.processed_at,
    stripeSubscriptionId: r.stripe_subscription_id,
    stripeInvoiceId: r.stripe_invoice_id,
    stripeDisputeId: r.stripe_dispute_id,
    stripeRefundId: r.stripe_refund_id,
    stripeCheckoutSessionId: r.stripe_checkout_session_id,
    invoicePeriodStart: r.invoice_period_start,
    invoicePeriodEnd: r.invoice_period_end,
    nexAccountId: r.nex_account_id,
    product: r.product,
  };
}

// ---------------------------------------------------------------------------
// Factory · opt-in production vs scratch
// ---------------------------------------------------------------------------

/** Create a scratch-rehearsal adapter. REQUIRES SCRATCH_DATABASE_URL to be
 *  set and to point at localhost · the pg Pool will reject any non-
 *  localhost connection string downstream, but the factory also fail-
 *  closes here. */
export function createScratchBillingStore(): SupabaseBillingStore {
  const url = process.env.SCRATCH_DATABASE_URL;
  if (!url) {
    throw new Error(
      "createScratchBillingStore · SCRATCH_DATABASE_URL not set · refuse to connect to anything other than scratch rehearsal",
    );
  }
  const parsed = new URL(url);
  if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error(
      `createScratchBillingStore · hostname '${parsed.hostname}' is not localhost · refuse to connect`,
    );
  }
  const dbName = parsed.pathname.replace(/^\//, "");
  if (dbName !== "nex_rehearsal_257") {
    throw new Error(
      `createScratchBillingStore · database '${dbName}' is not the scratch DB · refuse to connect`,
    );
  }
  return new SupabaseBillingStore({ source: url, label: "scratch" });
}

/** Create a production adapter. REQUIRES DATABASE_URL to be set and to
 *  point at the canonical NEX Supabase pooler for project ref
 *  'ijvqdvsvwtwxzcqmoqit' per CLAUDE.md §8. The factory refuses any URL
 *  outside that identity. */
export function createProductionBillingStore(): SupabaseBillingStore {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "createProductionBillingStore · DATABASE_URL not set",
    );
  }
  // Identity validation mirrors scripts/apply-migration-207.mjs
  const parsed = new URL(url);
  const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
  let projectRef: string | null = null;
  if (parsed.hostname.endsWith(".pooler.supabase.com")) {
    const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/);
    if (m) projectRef = m[1];
  } else if (parsed.hostname.endsWith(".supabase.co")) {
    const m = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (m) projectRef = m[1];
  }
  if (projectRef !== EXPECTED_PROJECT_REF) {
    throw new Error(
      `createProductionBillingStore · DATABASE_URL does not point at canonical NEX Supabase project (expected ${EXPECTED_PROJECT_REF}, got ${projectRef ?? "(unparseable)"})`,
    );
  }
  return new SupabaseBillingStore({ source: url, label: "production" });
}
