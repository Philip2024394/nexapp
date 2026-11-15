# Production migration dependency inventory · 290-348

**Author:** Stream C · 2026-11-16
**Scope:** Document-only. No DB writes. No production access.
**Related:** `nex-supabase/migrations/`, `scripts/apply-migration-<n>-*.mjs`

---

## Legend

- **Sandbox script present** — `scripts/apply-migration-<n>-sandbox.mjs`
  exists.
- **Production script present** — `scripts/apply-migration-<n>-production.mjs`
  exists.
- **Feature gated** — which NEX surface depends on this migration
  landing.
- **Sealed status** — prior owner seals that affect this migration.
- Rollback SQL is in `nex-supabase/migrations/<n>_*.rollback.sql`
  where applicable; migrations without a rollback are marked `—`.

All entries verified by `ls nex-supabase/migrations/` + `ls scripts/`
at 2026-11-16. Any entry whose status needs re-verification is marked.

---

## 290-299 · Security + rate-limit + chat crypto

| N   | File                                                | Sandbox | Prod | Gates                                      | Sealed                                                                 |
| --- | --------------------------------------------------- | ------- | ---- | ------------------------------------------ | ---------------------------------------------------------------------- |
| 290 | `nex_security_rate_limit.sql`                       | yes     | yes  | Global rate limiter ring                   | Phase 1 remediation priority 5                                         |
| 291 | `nex_security_rate_limit_claim_rpc.sql`             | yes     | no   | Claim RPC for 290                          | — (superseded variant on disk, not for apply)                          |
| 292 | `nex_security_audit_log.sql`                        | yes     | no   | Audit log                                  | —                                                                      |
| 293 | `nex_security_audit_reconcile.sql`                  | yes     | no   | Audit reconciler                           | —                                                                      |
| 294 | `nex_security_audit_erase_actor.sql`                | yes     | no   | Right-to-erase actor rewrite               | —                                                                      |
| 295 | `nex_peer_chat_ciphertext_bucket.sql`               | yes     | no   | Private chat attachment bucket (E2E)        | Device-only chat sealed 2026-11-09                                     |
| 296 | `nex_account_deletion.sql`                          | yes     | no   | Account deletion scaffolding                | —                                                                      |
| 297 | `nex_security_audit_retention_admin.sql`            | yes     | no   | Audit retention admin surface               | —                                                                      |
| 298 | `nex_peer_chat_envelope_overlay.sql`                | yes     | no   | Chat envelope overlay                       | —                                                                      |
| 299 | `nex_account_finalize_deletion.sql`                 | yes     | no   | Deletion finalise                           | —                                                                      |

## 300-309 · Incident + HQ + call + storage + attachment

| N   | File                                                | Sandbox | Prod | Gates                                      | Sealed                                                                 |
| --- | --------------------------------------------------- | ------- | ---- | ------------------------------------------ | ---------------------------------------------------------------------- |
| 300 | `nex_incident.sql`                                  | no      | no   | HQ incident v1 (superseded by 304)          | Phase 1 remediation priority 2                                         |
| 301 | `nex_hq_direct_channel.sql`                         | no      | no   | HQ DM channel                               | —                                                                      |
| 302 | `nex_admin_grant.sql`                               | no      | no   | Admin grant table                           | Phase 1 remediation priority 4 — DO NOT APPLY until audit matrix in |
| 303 | `nex_page_view.sql`                                 | yes     | no   | Traffic analytics                           | —                                                                      |
| 304 | `nex_incident_v2.sql`                               | yes     | no   | HQ incident v2 · DETECTED/RECOVERY/VERIFIED | Phase 1 remediation priority 2                                         |
| 305 | `nex_incident_v2_perf.sql`                          | yes     | no   | Indexes for 304                             | Phase 1 remediation priority 2                                         |
| 306 | `nex_peer_message_call_invite.sql`                  | yes     | no   | Call invite in chat                         | —                                                                      |
| 307 | `nex_group_call_country.sql`                        | yes     | no   | Group-call country-isolation                | —                                                                      |
| 308 | `nex_business_storage_metering.sql`                 | yes     | no   | Business storage meters                     | —                                                                      |
| 309 | `nex_peer_message_attachment_type_restore.sql`      | yes     | no   | Attachment-type restore                     | —                                                                      |

## 310-319 · Shop + Stripe + billing RLS + support tickets + QR

| N   | File                                                | Sandbox | Prod | Gates                                      | Sealed                                                                 |
| --- | --------------------------------------------------- | ------- | ---- | ------------------------------------------ | ---------------------------------------------------------------------- |
| 310 | `nex_account_shop_tier_add_shop.sql`                | yes     | no   | Shop tier column add                        | Scope Reduction 2026-11-06                                             |
| 311 | `nex_business_stripe_connect.sql`                   | yes     | no   | Merchant Stripe Connect columns             | Merchant-Owned Payments P1 sealed 2026-11-10                           |
| 312 | `nex_billing_rls_lockdown.sql`                      | yes     | yes  | Billing-table RLS                           | Phase 1 remediation priority 2 (P0-GATE pre-apply)                     |
| 313 | `nex_security_rate_limit_hq_admin_grant.sql`        | yes     | yes  | Rate ring for admin_grant                   | Phase 1 remediation priority 4                                         |
| 314 | `nex_trusted_contact_enabled.sql`                   | yes     | no   | Emergency contact enable toggle             | Emergency Help sealed 2026-11-09                                       |
| 315 | `nex_support_ticket.sql`                            | yes     | no   | Support ticket table                        | **PROD SEALED 2026-11-10 · DO NOT APPLY TO PROD**                      |
| 316 | `nex_support_ticket_sequence.sql`                   | yes     | no   | Ticket sequence BIGSERIAL                   | **PROD SEALED 2026-11-10 · DO NOT APPLY TO PROD**                      |
| 317 | `nex_support_ticket_resolved.sql`                   | yes     | no   | Resolved_at + partial index                 | **PROD SEALED 2026-11-10 · DO NOT APPLY TO PROD**                      |
| 318 | `nex_account_notification_prefs_order_PROPOSAL.sql` | yes     | no   | Notification prefs (PROPOSAL only)          | PROPOSAL — sandbox-verification-procedure.md present                    |
| 319 | `nex_merchant_qr_asset.sql`                         | yes     | no   | Merchant QR asset                           | Merchant-Owned Payments P5                                             |

## 320-329 · Payment method history + QR bucket + chat decisions proposals

| N   | File                                                | Sandbox | Prod | Gates                                      | Sealed                                                                 |
| --- | --------------------------------------------------- | ------- | ---- | ------------------------------------------ | ---------------------------------------------------------------------- |
| 320 | `nex_order_payment_method.sql`                      | yes     | no   | nex_order.payment_method_selected column    | —                                                                      |
| 321 | `nex_merchant_qr_bucket.sql`                        | yes     | no   | Merchant QR storage bucket                  | —                                                                      |
| 322 | `nex_payment_provider_config_PROPOSAL.sql`          | yes     | no   | Payment provider config (PROPOSAL)          | PROPOSAL — not authorised                                              |
| 323 | `nex_device_key_retired_at_PROPOSAL.sql`            | yes     | no   | Device key retirement (PROPOSAL)            | PROPOSAL — chat-decisions-locked-2026-11-10 pending                    |
| 324 | `nex_peer_message_delivery_status_PROPOSAL.sql`     | yes     | no   | Delivery status (PROPOSAL)                  | PROPOSAL                                                               |
| 325 | `nex_chat_adoption_metric_PROPOSAL.sql`             | yes     | no   | Chat adoption metrics (PROPOSAL)            | PROPOSAL                                                               |
| 326 | `nex_peer_message_expiry_sweep_PROPOSAL.sql`        | yes     | no   | Expiry sweep (PROPOSAL)                     | PROPOSAL                                                               |
| 327 | `nex_ciphertext_orphan_scan_PROPOSAL.sql`           | yes     | no   | Orphan ciphertext scan (PROPOSAL)           | PROPOSAL                                                               |
| 328 | `nex_peer_message_encrypted_check_NOT_VALID_PROPOSAL.sql` | yes | no   | Encrypted check NOT VALID (PROPOSAL)        | PROPOSAL                                                               |
| 329 | `nex_peer_message_encrypted_check_VALIDATE_PROPOSAL.sql` | no  | no   | Validate 328 (PROPOSAL · depends on 328)    | PROPOSAL                                                               |

## 330-339 · Rate-limit canonical + audit RLS + QR hardening + themes-plus + Ireland fields

| N   | File                                                | Sandbox | Prod | Gates                                      | Sealed                                                                 |
| --- | --------------------------------------------------- | ------- | ---- | ------------------------------------------ | ---------------------------------------------------------------------- |
| 330 | `nex_security_rate_limit_claim_fix_canonical.sql`   | yes     | no   | Fix for 291 canonical                       | —                                                                      |
| 331 | `nex_security_audit_rls_defence_in_depth.sql`       | yes     | no   | Audit RLS hardening                         | —                                                                      |
| 332 | `nex_peer_message_expire_undelivered_grants_fix.sql`| yes     | no   | Expire undelivered grants                   | —                                                                      |
| 333 | `nex_merchant_qr_bucket_restrictive_hardening.sql`  | yes     | no   | QR bucket hardening                         | —                                                                      |
| 334 | `nex_order_payment_method_history_correction.sql`   | yes     | no   | Correction to 320                           | —                                                                      |
| 335 | `nex_revoke_open_execute_grants_mutating_secdef.sql`| yes     | no   | Revoke open EXECUTE grants                  | —                                                                      |
| 336 | `nex_business_paypal_partner_columns_PROPOSAL.sql`  | no      | no   | PayPal partner columns (PROPOSAL)           | PROPOSAL                                                               |
| 337 | `nex_background_asset.sql`                          | yes     | no   | Background asset table + seed               | Themes+ Phase A sealed 2026-11-13                                      |
| 338 | `nex_themes_plus_until.sql`                         | yes     | no   | nex_account.themes_plus_until column        | Themes+ Phase A sealed 2026-11-13 · Stripe webhook writer NOT authorised |
| 339 | `nex_account_profile_ireland_fields.sql`            | yes     | no   | Ireland-specific profile fields             | —                                                                      |

## 340-348 · Themes sharing + bubbles + theme-ownership + shop intro + E2E + vault + single-session

| N   | File                                                | Sandbox | Prod | Gates                                      | Sealed                                                                 |
| --- | --------------------------------------------------- | ------- | ---- | ------------------------------------------ | ---------------------------------------------------------------------- |
| 340 | `nex_account_theme_sharing_globally_enabled.sql`    | yes     | no   | Theme sharing toggle                        | —                                                                      |
| 341 | `nex_account_bubble_colours.sql`                    | yes     | no   | Per-account chat bubble colours             | —                                                                      |
| 342 | `nex_theme_ownership_first_free_acquired_via.sql`   | yes     | no   | First-free provenance column                | Themes+ Phase A first-free sealed 2026-11-13                           |
| 343 | `nex_account_bubble_appearance.sql`                 | yes     | no   | Bubble appearance JSON                      | —                                                                      |
| 344 | `nex_business_shop_intro_message.sql`               | yes     | no   | Shop intro message                          | —                                                                      |
| 345 | `nex_message_e2e_encryption.sql`                    | no      | no   | Message E2E encryption table                | Device-only sealed 2026-11-09 — pending authorisation                  |
| 346 | `nex_vault_security_logging.sql`                    | yes     | no   | Vault access log                            | Vault bundled in Shop sealed 2026-11-06                                |
| 347 | `nex_vault_pin_reset_token.sql`                     | yes     | no   | Vault PIN reset token                       | —                                                                      |
| 348 | `nex_single_session_enforcement.sql`                | yes     | no   | Single-session enforcement                  | —                                                                      |

---

## Apply-script scaffolding statistics

- **Sandbox apply scripts present:** 290-348 EXCLUDING 300, 301,
  302, 329, 336, 345 (6 gaps · all PROPOSAL / blocker / unsealed).
- **Production apply scripts present:** ONLY 290, 312, 313 (3 total).

Every other migration requires:

1. Owner to authorise prod apply (sealed production rule).
2. A matching `apply-migration-<n>-production.mjs` script to be
   authored, following the `audit-stage0-production-baseline.mjs`
   pattern (ref-check refusing sandbox, explicit confirmations,
   rollback-on-error). Do NOT reuse sandbox scripts — they target
   `kdstoyyeygcopkogqsyv` and will fail-fast against prod.

## Audit baseline

- `scripts/audit-stage0-production-baseline.mjs` exists and
  provides a read-only probe pattern. Use this as the reference
  implementation when authoring new prod apply scripts.

## Blocker migrations (do NOT apply to prod)

- **315, 316, 317** · Support tickets · **PROD SEALED 2026-11-10**.
  Sandbox-only applied. Owner must re-open to re-authorise.
- **All `*_PROPOSAL.sql`** · Not authorised. Do NOT include in
  batch plans.
- **345** · Message E2E encryption · gated on device-only chat
  implementation authorisation.
- **302** · Admin grant · Phase 1 remediation priority 4. Document
  country-scope policy BEFORE prod apply.

## Dependency chains worth noting

- 329 → depends on 328 (NOT VALID then VALIDATE pattern).
- 305 → depends on 304 (performance indexes).
- 316, 317 → depend on 315.
- 330 → corrects 291 canonical form.
- 334 → corrects 320.
- 342 → depends on themes ownership (migration N<340, verify).
- 347 → depends on 346 (vault security logging before PIN reset
  token).

## What this document does NOT do

- Does not authorise ANY production apply.
- Does not execute any script.
- Does not schedule any batch.
- Owner must authorise each prod apply separately per sealed rule.
