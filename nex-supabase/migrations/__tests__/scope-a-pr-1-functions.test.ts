// nex-supabase/migrations/__tests__/scope-a-pr-1-functions.test.ts
//
// Scope-A PR-1 · source-shape tests for migration 265 (five
// transactional plpgsql RPCs).
//
// Evidence boundary: see scope-a-pr-1-event-registry.test.ts.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const M265 = readFileSync(
  resolve(__dirname, "..", "265_nex_friend_request_tx_functions.sql"),
  "utf8",
);

const FN_SIGNATURES: ReadonlyArray<{
  readonly name: string;
  readonly args: string;
}> = [
  { name: "nex_friend_request_create_tx", args: "uuid, text, text, text, uuid" },
  { name: "nex_friend_request_accept_tx", args: "uuid, uuid, text, uuid" },
  { name: "nex_friend_request_cancel_tx", args: "uuid, uuid, uuid" },
  { name: "nex_friend_request_sweep_run", args: "uuid" },
  { name: "nex_invite_event_retention_run", args: "uuid" },
];

// ═══════════════════════════════════════════════════════════════════════
// Shape · structure of the migration
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 265 · migration shape", () => {
  it("declares the DRAFT apply guard", () => {
    expect(M265).toMatch(/Migration 265 is DRAFT/);
  });

  it("declares pre-flight dependencies on all six predecessor tables + pgcrypto + 15-row registry", () => {
    expect(M265).toMatch(/nex_friend_request missing \(migration 215\)/);
    expect(M265).toMatch(/nex_friend_edge missing \(migration 025\)/);
    expect(M265).toMatch(/nex_peer_conversation missing \(migration 047\)/);
    expect(M265).toMatch(/nex_invite_event_type missing \(migration 260\)/);
    expect(M265).toMatch(/nex_invite_event missing \(migration 262\)/);
    expect(M265).toMatch(/nex_invite_event_hold missing \(migration 263\)/);
    expect(M265).toMatch(/idempotency columns missing on nex_friend_request \(migration 264\)/);
    expect(M265).toMatch(/pgcrypto extension missing/);
    expect(M265).toMatch(/event registry contains % rows/);
  });

  it("records a nex_migration_history row for version 265", () => {
    expect(M265).toMatch(/INSERT INTO public\.nex_migration_history[\s\S]*?'265'/);
  });

  it("transaction is wrapped in BEGIN/COMMIT", () => {
    expect(M265).toMatch(/^BEGIN;/m);
    expect(M265).toMatch(/^COMMIT;/m);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Shape · each function carries the same security contract
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 265 · security contract (applies to all 5 functions)", () => {
  for (const fn of FN_SIGNATURES) {
    describe(fn.name, () => {
      it("is defined with CREATE OR REPLACE FUNCTION in public schema", () => {
        expect(M265).toMatch(
          new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn.name}\\(`),
        );
      });

      it("uses LANGUAGE plpgsql", () => {
        // Each function's body contains LANGUAGE plpgsql between CREATE and the next ';'.
        // We assert at least one plpgsql clause per fn name is present (less fragile than
        // slicing between fn names in a growing file).
        const idx = M265.indexOf(`CREATE OR REPLACE FUNCTION public.${fn.name}(`);
        expect(idx, `${fn.name} definition not found`).toBeGreaterThan(-1);
        const slice = M265.slice(idx, idx + 2000);
        expect(slice).toMatch(/LANGUAGE plpgsql/);
      });

      it("declares SECURITY DEFINER", () => {
        const idx = M265.indexOf(`CREATE OR REPLACE FUNCTION public.${fn.name}(`);
        const slice = M265.slice(idx, idx + 2000);
        expect(slice).toMatch(/SECURITY DEFINER/);
      });

      it("sets a fixed search_path of pg_catalog, public (no extensions implicitly resolved)", () => {
        const idx = M265.indexOf(`CREATE OR REPLACE FUNCTION public.${fn.name}(`);
        const slice = M265.slice(idx, idx + 2000);
        expect(slice).toMatch(/SET search_path\s*=\s*pg_catalog\s*,\s*public/);
      });

      it("REVOKEs ALL from PUBLIC, anon, and authenticated", () => {
        const sigRe = new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${fn.name}\\(${fn.args.replace(/,/g, "\\s*,\\s*")}\\)\\s+FROM PUBLIC`,
        );
        expect(M265).toMatch(sigRe);
        const anonRe = new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${fn.name}\\(${fn.args.replace(/,/g, "\\s*,\\s*")}\\)\\s+FROM anon`,
        );
        expect(M265).toMatch(anonRe);
        const authRe = new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${fn.name}\\(${fn.args.replace(/,/g, "\\s*,\\s*")}\\)\\s+FROM authenticated`,
        );
        expect(M265).toMatch(authRe);
      });

      it("GRANTs EXECUTE only to service_role", () => {
        const grantRe = new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${fn.name}\\(${fn.args.replace(/,/g, "\\s*,\\s*")}\\)\\s+TO service_role`,
        );
        expect(M265).toMatch(grantRe);
      });

      it("carries a COMMENT ON FUNCTION documenting its contract", () => {
        const commentRe = new RegExp(
          `COMMENT ON FUNCTION public\\.${fn.name}\\(${fn.args.replace(/,/g, "\\s*,\\s*")}\\)\\s+IS`,
        );
        expect(M265).toMatch(commentRe);
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Shape · correctness-critical patterns in function bodies
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 265 · correctness patterns", () => {
  it("NEVER classifies errors by SQLERRM substring matching", () => {
    expect(M265).not.toMatch(/SQLERRM\s+(?:LIKE|ILIKE|~)/);
    expect(M265).not.toMatch(/position\s*\(.*SQLERRM/i);
  });

  it("uses GET STACKED DIAGNOSTICS with constraint-name routing", () => {
    expect(M265).toMatch(/GET STACKED DIAGNOSTICS[\s\S]*?CONSTRAINT_NAME/);
    expect(M265).toMatch(/v_constraint_name/);
  });

  it("uses structured diagnostics on foreign_key_violation (event emission)", () => {
    expect(M265).toMatch(/EXCEPTION\s+WHEN foreign_key_violation[\s\S]*?GET STACKED DIAGNOSTICS/);
  });

  it("uses structured diagnostics on unique_violation (invite insert)", () => {
    expect(M265).toMatch(/EXCEPTION\s+WHEN unique_violation[\s\S]*?GET STACKED DIAGNOSTICS/);
  });

  it("re-RAISEs unexpected unique_violations with the constraint name preserved", () => {
    expect(M265).toMatch(/unexpected unique_violation on constraint/);
    expect(M265).toMatch(/USING ERRCODE\s*=\s*'23505'/);
  });

  it("surfaces unregistered events as event_type_unregistered with ERRCODE 23503", () => {
    expect(M265).toMatch(/event_type_unregistered/);
    expect(M265).toMatch(/USING ERRCODE\s*=\s*'23503'/);
  });

  it("has NO dynamic EXECUTE anywhere", () => {
    // Scan for the dangerous dynamic-SQL pattern specifically: EXECUTE
    // followed by a string literal or variable (e.g. EXECUTE 'DROP ...',
    // EXECUTE format(...), EXECUTE v_sql). Comments and prose uses of
    // the word "EXECUTE" (as in "GRANT EXECUTE" or doctrine text) do NOT
    // match this pattern.
    const lines = M265.split("\n");
    const bad = lines.filter((l) => {
      // Ignore SQL comment lines.
      const trimmed = l.trim();
      if (trimmed.startsWith("--")) return false;
      // Dangerous forms: EXECUTE '...'  ·  EXECUTE format(  ·  EXECUTE v_...
      return /\bEXECUTE\s+(?:'|format\s*\(|v_[a-z_]+\b)/i.test(l);
    });
    expect(bad, `found dynamic EXECUTE: ${bad.map((l) => l.trim()).join(" | ")}`).toEqual([]);
  });

  // ── create_tx ──────────────────────────────────────────────────────
  it("create_tx validates sender existence before any state change", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/SELECT EXISTS\(SELECT 1 FROM public\.nex_account WHERE id = p_sender_account_id\)/);
    expect(slice).toMatch(/'invalid_sender'/);
  });

  it("create_tx validates recipient handle regex (matches migration 215 CHECK)", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/p_recipient_handle\s*!~\s*'\^nex-\\d\+\$'/);
    expect(slice).toMatch(/'invalid_handle'/);
  });

  it("create_tx resolves recipient handle case-insensitively (matches sealed service)", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/lower\(nex_handle\)\s*=\s*lower\(p_recipient_handle\)/);
    expect(slice).toMatch(/'unknown_handle'/);
  });

  it("create_tx rejects self-invite AFTER recipient resolution", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/v_recipient_id\s*=\s*p_sender_account_id/);
    expect(slice).toMatch(/'self_invite'/);
  });

  it("create_tx enforces cooldown via nex_friend_request.cooldown_ends_at", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/max\(cooldown_ends_at\)/);
    expect(slice).toMatch(/cooldown_ends_at\s*>\s*v_now/);
    expect(slice).toMatch(/'cooldown'/);
  });

  it("create_tx fingerprint uses extensions.digest (schema-qualified for Supabase pgcrypto)", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/extensions\.digest\(/);
    // NO unqualified digest( CALL in executable SQL. Strip SQL comments
    // before scanning · comments in sealed migrations document the
    // function by name using English prose like "pgcrypto's digest()".
    const noComments = slice
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    const unqualified = noComments.match(/(^|[^.a-zA-Z_])digest\(/g) ?? [];
    expect(unqualified, "unqualified digest() call found in executable SQL").toEqual([]);
  });

  it("create_tx fingerprint input uses v1 prefix + length-fixed per-field hashes + null markers", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/'v1\|'/);
    expect(slice).toMatch(/encode\(extensions\.digest\(lower\(coalesce\(p_recipient_handle, ''\)\),\s*'sha256'\),\s*'hex'\)/);
    expect(slice).toMatch(/encode\(extensions\.digest\(coalesce\(p_intro_note, ''\),\s*'sha256'\),\s*'hex'\)/);
    expect(slice).toMatch(/'NULL'\s+ELSE\s+'VAL'/);
  });

  it("create_tx fast-path uses FOR UPDATE row-lock on idempotency lookup", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/FROM public\.nex_friend_request[\s\S]*?FOR UPDATE/);
  });

  it("create_tx returns already_created on fingerprint match (not DISTINCT FROM)", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/v_existing_fp\s+IS NOT DISTINCT FROM\s+v_fingerprint/);
    expect(slice).toMatch(/'already_created',\s*true/);
  });

  it("create_tx returns idempotency_key_conflict on payload mismatch", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/'idempotency_key_conflict'/);
  });

  it("create_tx EXCEPTION branch handles concurrent idempotency race with re-read + compare", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/nex_friend_request_idempotency_unique/);
    expect(slice).toMatch(/'idempotency_lookup_lost'/);
  });

  it("create_tx EXCEPTION branch distinguishes pending-unique from idempotency-unique by constraint name", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/nex_friend_request_unique_pending/);
    expect(slice).toMatch(/'duplicate_pending'/);
  });

  it("create_tx returns conflict request_id only · NEVER the recipient_handle or intro_note of the colliding row", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    const conflictReturn = slice.match(/'reason',\s*'idempotency_key_conflict'[\s\S]*?\);/)?.[0] ?? "";
    expect(conflictReturn).toMatch(/'request_id'/);
    expect(conflictReturn).not.toMatch(/recipient_handle/);
    expect(conflictReturn).not.toMatch(/intro_note/);
  });

  it("create_tx emits invite.created event atomically with the insert", () => {
    const slice = sliceFn("nex_friend_request_create_tx");
    expect(slice).toMatch(/INSERT INTO public\.nex_invite_event[\s\S]*?'invite\.created'[\s\S]*?'lifecycle'/);
  });

  // ── accept_tx ──────────────────────────────────────────────────────
  it("accept_tx validates p_category to friends|business before any state change", () => {
    const slice = sliceFn("nex_friend_request_accept_tx");
    expect(slice).toMatch(/p_category NOT IN\s*\(\s*'friends'\s*,\s*'business'\s*\)/);
    expect(slice).toMatch(/'invalid_category'/);
  });

  it("accept_tx locks the request row with FOR UPDATE and checks recipient_account_id ownership", () => {
    const slice = sliceFn("nex_friend_request_accept_tx");
    expect(slice).toMatch(/WHERE id = p_request_id\s+AND recipient_account_id = p_acceptor_account_id\s+FOR UPDATE/);
    expect(slice).toMatch(/'not_recipient_or_not_found'/);
  });

  it("accept_tx returns already_accepted (idempotent) on category match", () => {
    const slice = sliceFn("nex_friend_request_accept_tx");
    expect(slice).toMatch(/v_row\.status = 'accepted' AND v_row\.accepted_category = p_category/);
    expect(slice).toMatch(/'already_accepted',\s*true/);
  });

  it("accept_tx returns already_accepted_other_category on category mismatch", () => {
    const slice = sliceFn("nex_friend_request_accept_tx");
    expect(slice).toMatch(/'already_accepted_other_category'/);
    expect(slice).toMatch(/'actual_category'/);
  });

  it("accept_tx rejects expired invite with explicit reason", () => {
    const slice = sliceFn("nex_friend_request_accept_tx");
    expect(slice).toMatch(/v_row\.expires_at\s*<=\s*v_now/);
    expect(slice).toMatch(/'expired'/);
  });

  it("accept_tx canonically orders friend_edge INSERT with a < b (matches migration 025 CHECK)", () => {
    const slice = sliceFn("nex_friend_request_accept_tx");
    expect(slice).toMatch(/v_row\.sender_account_id\s*<\s*p_acceptor_account_id/);
  });

  it("accept_tx friend_edge INSERT uses ON CONFLICT · preserves historical requested_by", () => {
    const slice = sliceFn("nex_friend_request_accept_tx");
    expect(slice).toMatch(/INSERT INTO public\.nex_friend_edge[\s\S]*?ON CONFLICT\s*\(\s*a_account_id\s*,\s*b_account_id\s*\)\s*DO UPDATE/);
    const onConflict = slice.match(/ON CONFLICT\s*\([\s\S]*?DO UPDATE[\s\S]*?;/)?.[0] ?? "";
    expect(onConflict).not.toMatch(/requested_by\s*=/);
  });

  it("accept_tx documents that business peer_conversation is deferred to PR-2 service layer", () => {
    const slice = sliceFn("nex_friend_request_accept_tx");
    expect(slice).toMatch(/deferred to service layer/i);
  });

  it("accept_tx emits invite.accepted event atomically with elapsed_ms", () => {
    const slice = sliceFn("nex_friend_request_accept_tx");
    expect(slice).toMatch(/INSERT INTO public\.nex_invite_event[\s\S]*?'invite\.accepted'/);
    expect(slice).toMatch(/elapsed_ms_from_created/);
  });

  // ── cancel_tx ──────────────────────────────────────────────────────
  it("cancel_tx locks the request row with FOR UPDATE and checks sender_account_id ownership", () => {
    const slice = sliceFn("nex_friend_request_cancel_tx");
    expect(slice).toMatch(/WHERE id = p_request_id\s+FOR UPDATE/);
    expect(slice).toMatch(/v_row\.sender_account_id\s*<>\s*p_canceller_account_id/);
    expect(slice).toMatch(/'not_sender'/);
  });

  it("cancel_tx is idempotent on already-cancelled rows (returns prior cancelled_at)", () => {
    const slice = sliceFn("nex_friend_request_cancel_tx");
    expect(slice).toMatch(/v_row\.status = 'cancelled'/);
    expect(slice).toMatch(/'already_cancelled',\s*true/);
  });

  it("cancel_tx emits invite.cancelled event atomically", () => {
    const slice = sliceFn("nex_friend_request_cancel_tx");
    expect(slice).toMatch(/INSERT INTO public\.nex_invite_event[\s\S]*?'invite\.cancelled'/);
  });

  // ── sweep_run ──────────────────────────────────────────────────────
  it("sweep_run uses transaction-scoped advisory lock keyed on a hash of a well-known string", () => {
    const slice = sliceFn("nex_friend_request_sweep_run");
    expect(slice).toMatch(/pg_try_advisory_xact_lock\s*\(\s*hashtextextended\s*\(\s*'nex_friend_request_sweep_run'/);
  });

  it("sweep_run returns {ok, skipped:'concurrent'} when lock contended · no state change · no event", () => {
    const slice = sliceFn("nex_friend_request_sweep_run");
    expect(slice).toMatch(/'skipped',\s*'concurrent'/);
  });

  it("sweep_run performs the flip + per-row events + heartbeat in a single transaction", () => {
    const slice = sliceFn("nex_friend_request_sweep_run");
    expect(slice).toMatch(/WITH flipped AS \(\s*UPDATE public\.nex_friend_request/);
    expect(slice).toMatch(/'invite\.expired\.swept'/);
    expect(slice).toMatch(/'sweep\.run\.ok'/);
  });

  it("sweep_run emits sweep.run.ok heartbeat even when zero rows flip (watcher correctness)", () => {
    const slice = sliceFn("nex_friend_request_sweep_run");
    // The INSERT for sweep.run.ok is unconditional (not inside IF v_flipped > 0)
    const heartbeatSection = slice.match(/'sweep\.run\.ok'[\s\S]*?EXCEPTION/)?.[0] ?? "";
    expect(heartbeatSection).toMatch(/jsonb_build_object\('flipped', v_flipped/);
  });

  // ── retention_run ──────────────────────────────────────────────────
  it("retention_run has a lifecycle pass with 90-day window and preserves active-invite + hold rows", () => {
    const slice = sliceFn("nex_invite_event_retention_run");
    expect(slice).toMatch(/event_class = 'lifecycle'/);
    expect(slice).toMatch(/interval '90 days'/);
    expect(slice).toMatch(/r\.status = 'pending'[\s\S]*?r\.cooldown_ends_at > v_now/);
    expect(slice).toMatch(/nex_invite_event_hold[\s\S]*?cleared_at IS NULL/);
  });

  it("retention_run has an operational pass with 365-day window", () => {
    const slice = sliceFn("nex_invite_event_retention_run");
    expect(slice).toMatch(/event_class = 'operational'/);
    expect(slice).toMatch(/interval '365 days'/);
  });

  it("retention_run uses FOR UPDATE SKIP LOCKED on each candidate CTE", () => {
    const slice = sliceFn("nex_invite_event_retention_run");
    const skips = slice.match(/FOR UPDATE SKIP LOCKED/g) ?? [];
    expect(skips.length).toBeGreaterThanOrEqual(2);
  });

  it("retention_run bounded by LIMIT 1000 per pass", () => {
    const slice = sliceFn("nex_invite_event_retention_run");
    const limits = slice.match(/LIMIT 1000/g) ?? [];
    expect(limits.length).toBeGreaterThanOrEqual(2);
  });

  it("retention_run emits retention.run.ok heartbeat with per-class counts", () => {
    const slice = sliceFn("nex_invite_event_retention_run");
    expect(slice).toMatch(/'retention\.run\.ok'/);
    expect(slice).toMatch(/'lifecycle_deleted',\s*v_lifecycle_deleted/);
    expect(slice).toMatch(/'operational_deleted',\s*v_operational_deleted/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function sliceFn(name: string): string {
  const start = M265.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`${name} not found in migration 265`);
  // Grab until the next CREATE OR REPLACE FUNCTION or the GRANT/REVOKE block.
  // The function body ends at `$fn$;` so we take everything up to the first
  // closing of the dollar-quoted body plus the surrounding REVOKE/GRANT lines.
  const bodyEnd = M265.indexOf("$fn$;", start);
  if (bodyEnd < 0) throw new Error(`${name} body end ($fn$;) not found`);
  // Include the subsequent REVOKE/GRANT/COMMENT ON FUNCTION lines for the same fn.
  const after = M265.slice(bodyEnd);
  const nextFnCreate = after.indexOf("CREATE OR REPLACE FUNCTION public.");
  const tail = nextFnCreate < 0 ? after : after.slice(0, nextFnCreate);
  return M265.slice(start, bodyEnd) + tail;
}

// ═══════════════════════════════════════════════════════════════════════
// Integration matrix · DISABLED pending authorised sandbox + rollback rehearsal.
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 265 · integration matrix (requires authorised sandbox)", () => {
  it.skip("anon role · all 5 functions reject with 42501 permission denied", () => {});
  it.skip("authenticated role · all 5 functions reject with 42501 permission denied", () => {});
  it.skip("service_role · each function returns ok=true happy path", () => {});
  it.skip("create_tx · duplicate pending triggers unique_violation routed to 'duplicate_pending'", () => {});
  it.skip("create_tx · same idempotency key, same payload returns already_created", () => {});
  it.skip("create_tx · same idempotency key, different recipient returns idempotency_key_conflict", () => {});
  it.skip("create_tx · same idempotency key, different intro_note returns idempotency_key_conflict", () => {});
  it.skip("create_tx · concurrent same-key race · first commits, second returns conflict with first's request_id", () => {});
  it.skip("create_tx · unknown recipient handle returns unknown_handle", () => {});
  it.skip("create_tx · self-invite returns self_invite after recipient resolution", () => {});
  it.skip("create_tx · active cooldown returns reason=cooldown with exact cooldown_ends_at", () => {});
  it.skip("accept_tx · double-click Confirm · one commits, other returns already_accepted:true", () => {});
  it.skip("accept_tx · wrong recipient returns not_recipient_or_not_found", () => {});
  it.skip("accept_tx · expired invite returns expired", () => {});
  it.skip("accept_tx · friends category · creates canonical friend_edge · retry is idempotent via ON CONFLICT", () => {});
  it.skip("cancel_tx · wrong sender returns not_sender", () => {});
  it.skip("cancel_tx · already cancelled returns already_cancelled:true", () => {});
  it.skip("sweep_run · two concurrent calls · second returns {skipped:concurrent} immediately", () => {});
  it.skip("sweep_run · zero-row sweep still emits sweep.run.ok", () => {});
  it.skip("sweep_run · N-row sweep emits N invite.expired.swept + 1 sweep.run.ok all in one transaction", () => {});
  it.skip("retention_run · bounded 1000-row per pass · preserves active-invite and held rows", () => {});
  it.skip("retention_run · retention.run.ok dims carry both class counts", () => {});
  it.skip("event FK fires · emitting an unregistered event name raises foreign_key_violation routed to event_type_unregistered", () => {});
  it.skip("search_path · an attacker-created public.digest cannot shadow extensions.digest (schema-qualified)", () => {});
});
