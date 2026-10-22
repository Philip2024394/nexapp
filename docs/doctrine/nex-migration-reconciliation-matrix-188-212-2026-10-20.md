# NEX Migration Reconciliation Matrix · 188–212 · READ-ONLY

**Status:** 📝 Reconciliation audit · owner-recorded 2026-10-20
**Author:** Claude (recording live-DB-vs-local evidence)
**Date:** 2026-10-20
**Target DB probed:** `ijvqdvsvwtwxzcqmoqit` (sealed Supabase project)
**Probe:** `scripts/preflight-nex-migration-history-readonly.mjs` run at 2026-10-20T15:22:48Z

> **What this document is:** a per-migration reconciliation matrix for
> the 188–212 range. Based on local file preambles + the recorded
> `nex_migration_history` baseline captured earlier today.
>
> **What this document is NOT:**
> - It is NOT an authorisation to apply ANY migration.
> - It does NOT batch-apply, author new migrations, or author Family
>   Safety SQL.
> - It does NOT change feature flags, Family Safety code, public
>   copy, the Package Contract DRAFT, or any proposal document.
> - It does NOT connect to the live DB (the record of its state was
>   captured by the earlier authorised probe · no new connection).
> - It does NOT prove physical schema state · the "applied" column
>   reflects `nex_migration_history` only (see "limitations" section).

---

## Legend

**applied?** · from the 2026-10-20 probe · YES if the version is in `nex_migration_history`

**status markers in file preamble:**
- `SEALED` · doctrine-sealed · changes require founder authorisation
- `AUTHORED · NOT YET APPLIED` · explicit per-file gate (owner directive 2026-10-15)
- `DRAFT · NOT APPLIED` · more cautious variant
- `FOUNDER AUTHORISATION PENDING` · explicit pending gate
- `declarative backfill` · idempotent · meant as source-of-truth not change
- `routine` · no explicit special-handling marker (no implicit permission to apply)

**compatibility with current live baseline:**
- 🟢 **Safe** · depends only on already-applied versions
- 🟡 **Chain** · requires other unapplied siblings to land in order
- 🔴 **Blocked** · depends on something still unresolved
- ⚫ **Policy-blocked** · requires owner decision on scope/doctrine

---

## Matrix

### 188 · `nex_business_media_backfill_ddl`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | `DECLARATIVE BACKFILL · 2026-10-13` · idempotent · "the on-repo source of truth for its schema" |
| Change | Declares `nex.business_media` DDL. Note: the preamble explicitly says the table already exists in production (applied directly outside the migration pipeline). This file is a backfill to make the local repo match. |
| Dependencies | References `nex.business_canonical` (166 · applied) · pairs with the reconciliation script `scripts/nex-images/reconcile-legacy-to-business-media.mjs` (NOT run here) |
| NEX features depending | Directory read path via `src/lib/nex-native/directory/media-resolver.ts` |
| Compatibility | 🟢 **Safe** · 100% idempotent · every statement is `IF NOT EXISTS` · re-applying against production is a no-op by construction |
| Evidence/authorisation needed before applying | Operator confirms the live table shape matches the file. The preamble itself says this migration will NOT force reconciliation on drift · the drift-detection harness in `scripts/audit-harvest-schema.mjs` flags divergence first. **Low risk · still requires separate explicit "apply this one" authorisation** |

### 189 · `nex_business_media_review`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | `NEW TABLE · 2026-10-13` · founder-decision #2 reference |
| Change | Creates `nex.business_media_review` approval queue. Written by harvest executors + reconciliation script. Read by admin dashboard at `/nex-native/admin/image-review`. |
| Dependencies | References `nex.business_media` (requires 188 to be applied or the live table that already exists) |
| NEX features depending | Admin image review surface + harvest/import pipelines |
| Compatibility | 🟡 **Chain** · depends on 188 being either applied (declarative) or the pre-existing live table. 188 should land first to lock the schema into the repo |
| Evidence/authorisation needed before applying | 188 landed first OR confirmation that live `nex.business_media` already matches. Admin dashboard code must be reviewed for assumptions · deferred to apply decision |

### 190 · `nex_harvester_schema_match`
| Field | Value |
|---|---|
| Applied on target DB | **YES** · 2026-10-13T16:07:03Z |
| Marker | Already applied · no further action needed |
| Change | Added `nex.business_canonical.metadata` jsonb + `nex.aof_cycle.cycle_seq` default |
| Dependencies | n/a (applied) |
| Compatibility | 🟢 **In baseline** |

### 191 · `nex_chat_theme_catalogue_extension`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | No explicit sealed/draft marker · adds doctrine-shaped columns (`origin`, `bespoke_for_account_id`, `is_purchasable`, `catalogue_price_minor`, `catalogue_price_currency`). Preserves ONE NEX IDENTITY doctrine. |
| Change | Extends `nex_chat_theme` with 5 columns + CHECK constraints. Introduces concept of `origin` (standard/premium_ready_made/bespoke), bespoke-account link, purchasable flag, catalogue price |
| Dependencies | Column `bespoke_for_account_id` is `uuid REFERENCES nex_account(id)` (001 · applied) · column list affects migration 196's REVOKE/GRANT. |
| NEX features depending | **Theme commerce chain** · `src/app/nex-native/chat-themes-library/*` · `/nex-native/settings/tier` ladder (which lists purchasable themes) · the entire 191→196 subsystem |
| Compatibility | 🟡 **Chain head** · lands first in the 191→196 theme-commerce chain. On its own: safe. But applying only 191 without 192-194 means `is_purchasable=true` has nowhere to actually settle a purchase. |
| Evidence/authorisation needed before applying | Decision on whether the 191→196 chain goes as one wave or incrementally. Owner-sealed memory already describes theme ownership as "locked permanent per purchase" (per `project_nex_launch_pricing_2026_10_20` + `project_nex_theme_commerce_purchase_journey_draft_2026_10_20`). This whole chain IS the backing schema for that doctrine. |

### 192 · `nex_theme_commission`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | No explicit sealed marker · doctrine says "Append-only · no public write path · service-role only" |
| Change | Creates `nex_theme_commission` ledger table. One row per (theme_id, account_id). Independent of catalogue price. |
| Dependencies | `theme_id → nex_chat_theme(id)` (applied in bridge era) · `account_id → nex_account(id)` (001 · applied). No dependency on 191. |
| NEX features depending | Future bespoke-commission admin surface (owner-sealed `/settings/tier` "Own Theme Request" pathway) |
| Compatibility | 🟢 **Safe standalone** (does not depend on 191) BUT purpose only makes sense as part of the 191→196 chain |
| Evidence/authorisation needed before applying | Same chain-wave decision as 191 |

### 193 · `nex_theme_purchase`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | No explicit sealed marker · doctrine explicitly says *"Payment provider is NOT WIRED YET. The purchase table exists so the catalogue + service layer can be built, but every verified state transition will come from a trusted webhook adapter later."* |
| Change | Creates `nex_theme_purchase` intent + state-machine table (pending → verified / failed / cancelled / expired / refunded). Partial UNIQUE on (provider, provider_event_id) for idempotent replay. |
| Dependencies | FKs to `nex_chat_theme(id)` + `nex_account(id)` (both applied) |
| NEX features depending | **The theme commerce purchase journey** · owner-sealed memory `project_nex_theme_commerce_purchase_journey_draft_2026_10_20` discusses this exact table. Payment provider still unresolved per owner doctrine ("NEX never handles payments"). |
| Compatibility | 🟡 **Chain** · 194 (ownership) has a composite FK to this table · they must land together or 194 fails. ⚫ **Policy** · the "payment provider is NOT WIRED YET" + "NEX never handles payments" doctrine means the table can land but no path INSERTs 'verified' until the webhook adapter + payment partner is decided |
| Evidence/authorisation needed before applying | Chain-wave decision + confirmation that creating a dormant purchase intent table (no verified path) is acceptable |

### 194 · `nex_theme_ownership`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | No explicit sealed marker. Explicit composite-FK requirement to 193. |
| Change | Creates `nex_theme_ownership` · "Permanent, auditable per-account theme ownership." 3-source CHECK (bespoke · direct_purchase · grant). Composite FK into 193 (purchase_id, account_id, theme_id). Trigger-enforced invariant: direct_purchase ownership requires `nex_theme_purchase.state='verified'`. |
| Dependencies | **Hard: 193 must land first** (composite FK). Also FKs `nex_chat_theme(id)` + `nex_account(id)`. |
| NEX features depending | Owner-sealed "theme ownership persists per purchase, not per subscription" doctrine (memory `project_nex_launch_pricing_2026_10_20`). The Chat Themes product's permanence promise relies on this table existing. |
| Compatibility | 🔴 **Blocked on 193** · 194 cannot land before 193 (hard composite-FK requirement) |
| Evidence/authorisation needed before applying | 193 must land first OR 193+194 in a single apply transaction |

### 195 · `nex_business_theme`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | No explicit sealed marker. Preserves ONE NEX IDENTITY doctrine (account.chat_theme stays authoritative default). |
| Change | Creates `nex_business_theme` · per-business saved themes + active-theme pointer as OVERRIDE on top of account default. Partial UNIQUE on one activated row per business. |
| Dependencies | References `nex_business(id)` (002 · applied) · `nex_chat_theme(id)` (applied) · service-level `canActivate()` reads 193 + 194 ownership + `nex_account.tier` |
| NEX features depending | Business shop face · `/nex-native/{businessSlug}` renderer · theme preview surfaces · entire business-theme override behaviour |
| Compatibility | 🟡 **Chain** · can land before 193+194 (uses them at service layer only, not FK) BUT the service's `canActivate()` would reject every activation until ownership rows exist. |
| Evidence/authorisation needed before applying | Chain-wave decision + verification that pre-ownership activations fail gracefully (not with a loud error that breaks the shop page) |

### 196 · `nex_chat_theme_bespoke_owner_privacy`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | Security-review Stage-2 privacy fix |
| Change | REVOKES `SELECT` on `nex_chat_theme` from `anon`/`authenticated`, then GRANTS SELECT on all columns EXCEPT `bespoke_for_account_id`. Closes a privacy gap where a bespoke-but-purchasable theme leaks its commissioning account. |
| Dependencies | **Hard: 191 must land first** (the `bespoke_for_account_id` column it protects comes from 191) |
| NEX features depending | Every reader of `nex_chat_theme` on anon/authenticated role (chat themes library, pick-theme flow). This REVOKE narrows access · any client code depending on receiving `bespoke_for_account_id` will fail. |
| Compatibility | 🔴 **Blocked on 191**. Applying 196 BEFORE 191 would REVOKE SELECT on a table that still has the old column shape — anon/authenticated clients would see every row-level SELECT fail from that moment |
| Evidence/authorisation needed before applying | 191 landed first. Grep audit of any `nex_chat_theme` reader on anon/authenticated role to confirm none depend on `bespoke_for_account_id` client-side (service-role reads unaffected) |

### 197 · `nex_community_rate_limit_peer_message_guest`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | No explicit sealed marker · "closes design-contract gap G1" |
| Change | Extends the sealed CHECK constraint on `nex_community_rate_limit.action` to accept new action key `peer_message_guest`. Reuses the existing rolling-window primitive for guest-chat rate limits. |
| Dependencies | Depends on `nex_community_rate_limit` existing (applied in Bridge 99 era) |
| NEX features depending | Guest-chat rate limit at `src/lib/nex-native/community/rate-limit.ts`. Without this, the rate-limiter uses the old action-set and guest-chat sends have no rolling-window ceiling (Stage-2 security audit G1) |
| Compatibility | 🟢 **Safe** · additive CHECK constraint relaxation. Reversible. Standalone. |
| Evidence/authorisation needed before applying | Confirmation the guest-chat surface is still shipping (owner may decide to defer guest chat behind feature flag separately). Low risk operationally. |

### 198 · `nex_account_notification_prefs`
| Field | Value |
|---|---|
| Applied on target DB | **YES** · 2026-10-15T17:02:38Z |
| Marker | Already applied · no further action needed |
| Compatibility | 🟢 **In baseline** |

### 199 · `nex_account_chat_privacy_prefs`
| Field | Value |
|---|---|
| Applied on target DB | **YES** · 2026-10-15T20:43:16Z |
| Marker | Already applied · no further action needed |
| Compatibility | 🟢 **In baseline** |

### 200 · `nex_account_privacy_prefs`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | **`STATUS: AUTHORED · NOT YET APPLIED`** · explicit "separate explicit application authorisation is required" |
| Change | Adds `profile_visibility` (public/contacts/private) + `who_can_message` (everyone/contacts) columns to `nex_account`. Defaults preserve existing behaviour. "Private" returns 404 (not 403) to prevent enumeration. |
| Dependencies | None schema-wise. Enforcement lives in sealed account-reader + peer-conversation-service paths. |
| NEX features depending | **Account-identity surface** · profile reads at `/nex-native/profile/[handle]` + peer-conversation initiation gate. Service code already reads these columns · WITHOUT this migration, service queries ignoring the missing column fail silently (defaults applied) OR raise a column-missing error depending on how the reader is written. Needs verification before apply. |
| Compatibility | 🟡 **Chain** · docs reference 199 as sister migration. Service layer may already read `profile_visibility`/`who_can_message` · if so, every account read currently returns the SQL error gracefully or the service degrades. |
| Evidence/authorisation needed before applying | Owner explicitly staked 199/200/201 as a trio (`preflight-migrations-199-200-201-readonly.mjs`). Separate application authorisation named in file header. |

### 201 · `nex_account_data_usage_prefs`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | **`STATUS: AUTHORED · NOT YET APPLIED`** · same explicit gate as 199/200 |
| Change | Adds 4 columns to `nex_account`: `auto_download_{images,videos,audio}` (always/wifi_only/never) + `upload_quality`. 'wifi_only' is best-effort (navigator.connection availability). |
| Dependencies | None schema-wise. |
| NEX features depending | Media auto-download policy + upload quality setting (likely in Settings surface) |
| Compatibility | 🟡 **Chain** · sister to 199/200 per the sealed preflight script. Independent at DDL level. |
| Evidence/authorisation needed before applying | Same explicit gate · the preflight script `scripts/preflight-migrations-199-200-201-readonly.mjs` was designed as the gate for 199/200/201 as a group · 199 is applied already, so this is a "finish the trio" apply |

### 202 · `nex_business_canonical_email_qualification`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | **`STATUS: AUTHORED · NOT YET APPLIED`** · explicit per-file gate |
| Change | Adds 6 columns to `nex.business_canonical`: `email`, `email_source_url`, `email_verified_at`, `email_status` (FOUND/VALIDATED/INVALID/NOT_FOUND), plus 2 more (file truncated at line 22). All nullable additive. |
| Dependencies | Requires `nex.business_canonical` (167 · applied). Pairs with 203 (outreach queue). |
| NEX features depending | The owner-directed "harvester email qualification pipeline" (sealed 2026-10-16) · harvester backfill flow. Downstream services probe `information_schema` to degrade gracefully when columns absent (same pattern as 203). |
| Compatibility | 🟢 **Safe standalone** · additive, no destructive, consumer code is schema-aware (information_schema probe-and-skip). |
| Evidence/authorisation needed before applying | Separate explicit application authorisation per file preamble. Owner-sealed harvester scope decision. |

### 203 · `nex_outreach_queue_and_lease`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | **`STATUS: DRAFT · NOT APPLIED`** · three explicit gates listed in preamble |
| Change | Phase 1.4 harvester outreach queue + suppression + atomic lease columns on `business_canonical`. Pairs with code at `src/lib/nex-native/outreach/*` + `email-backfill-orchestrator.ts`. |
| Dependencies | Depends on `nex.business_canonical` (167 · applied). Companion to 202. Downstream code degrades gracefully via information_schema probe. |
| NEX features depending | Harvester outreach pipeline · entire Phase 1.4 outreach flow |
| Compatibility | ⚫ **Policy-blocked** · the preamble explicitly lists **three owner gates**: (1) apply this migration · (2) **fill in the legal basis + opt-out mechanism in Phase 1.3 doctrine** (owner-blank today) · (3) enable `NEX_OUTREACH_ENABLED=true` (default OFF). The schema can land but the feature stays dormant without the legal gate. |
| Evidence/authorisation needed before applying | Three gates named in-file. Independent of this matrix: Phase 1.3 doctrine completion. |

### 204 · `nex_account_chosen_handle`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | No explicit sealed/authored marker in preamble (standard header) |
| Change | Adds `nex_account.chosen_handle` (nullable, no unique index, display-only). Explicitly says: Sealed `nex_handle` (migration 013) is NOT touched. |
| Dependencies | None schema-wise beyond `nex_account` (001 · applied). |
| NEX features depending | Settings page's "chosen handle" field. Service code must handle NULL cases gracefully for all pre-existing accounts. |
| Compatibility | 🟢 **Safe** · additive, nullable, no behaviour change for existing accounts. Reversible. |
| Evidence/authorisation needed before applying | Low risk · verify the Settings UI gracefully handles pre-column state (older DB without this column) |

### 205 · `nex_account_profile_cover_and_interests`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | **`STATUS: AUTHORED · NOT YET APPLIED`** · explicit gate |
| Change | Adds `cover_image_url` + `interests` jsonb(?) columns to `nex_account_profile` (migration 042 · applied). Supports sealed 2026-10-17 profile UI at `/nex-native/profile/[handle]`. |
| Dependencies | Requires `nex_account_profile` (042 · applied). File-storage dependency on sealed NEX storage buckets. |
| NEX features depending | **Account identity surface** · the entire canonical profile UI at `/nex-native/profile/[handle]`. The route itself is already shipped (per earlier grep showing /profile/me redirect). Readers of this profile likely tolerate missing columns as NULL. |
| Compatibility | 🟡 **Chain** · functionally couples with the profile UI's new fields · needs verification that readers tolerate the pre-apply schema |
| Evidence/authorisation needed before applying | Separate explicit application authorisation per file preamble + verification that the profile route handles NULL cover + empty interests |

### 206 · `nex_account_hq_role`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | **`STATUS: AUTHORED · NOT YET APPLIED`** · explicit "live-project reverification against ijvqdvsvwtwxzcqmoqit" required |
| Change | Adds `nex_account.hq_role` (NULL/'reviewer'/'admin'). HQ governance semantics. |
| Dependencies | None schema-wise beyond `nex_account`. |
| NEX features depending | **Identity + privilege surface** · HQ dashboards + review queues (if any read this column already, they currently see no HQ accounts) |
| Compatibility | ⚫ **Policy-blocked** · HQ role governance is a privilege-escalation primitive. Should land only after a documented process for *WHO* becomes reviewer/admin, *HOW* they are promoted, *HOW* the promotion is audited. |
| Evidence/authorisation needed before applying | Explicit identity/privilege doctrine for HQ roles (not visible in the file preamble). The "live-project reverification" phrasing in the preamble suggests the owner wants a project-id re-check before touching this file. |

### 207 · `nex_onboarding_and_vault_trial`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | **ANOMALY** · unlike every other 2026-10-15+ migration this file has **no `STATUS:` header, no doctrine comments beyond a 2-line summary, no explicit application gate**. Pure `ALTER TABLE` with 3 `ADD COLUMN IF NOT EXISTS`. |
| Change | Adds `nex_account.onboarding_step` + `nex_account.shop_theme_id` + `nex_account.vault_trial_used_at`. The last column is a **Vault commercial primitive**. |
| Dependencies | None schema-wise. |
| NEX features depending | Onboarding step tracker + 7-day Vault trial (sealed Vault Entitlements Policy references `vault_trial_used_at`). The sealed LOCKED Vault Entitlements Policy §G.B5 names a 7-day trial · this column is its backing storage. |
| Compatibility | ⚫ **Policy-blocked (Vault)** · the Vault Entitlements Policy is LOCKED and names 8 decisions · B5 (7-day trial + 30-day grace) is one of them. Applying 207 writes a Vault-commercial column WITHOUT the surrounding doctrine (W1-W12 unimplemented · no entitlement contract code yet). **This migration also stands out as the only one in the 200-212 range without the sealed "AUTHORED · NOT YET APPLIED" marker · that may be a doctrine-compliance gap in the migration file itself.** |
| Evidence/authorisation needed before applying | Vault W-item decisions (W1 unblocked per LOCKED policy but not scheduled). Separate decision about whether `vault_trial_used_at` can land before the Vault entitlement enforcement code. **Also recommended: add the sealed STATUS marker to the file preamble before any apply decision.** |

### 208 · `nex_discovery_signal`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | **`owner-authorised 2026-10-18 as a MIGRATION FILE only · APPLICATION requires separate explicit approval`** · explicit gate |
| Change | Behaviour-signal table for discovery · marketing-layer only. Sealed Directory Spine doctrine: Intelligence/Directory/Business/Marketing separation. |
| Dependencies | Companion to code at `src/lib/nex-native/discovery/*`. Discovery service likely information-schema-probes to degrade gracefully. |
| NEX features depending | Discovery P2 recommendation system (future · marketing layer only · never used for publication/truth) |
| Compatibility | 🟢 **Safe** · doctrine-isolated · Marketing-only layer · additive. |
| Evidence/authorisation needed before applying | Separate explicit application authorisation per file preamble |

### 209 · `nex_account_intro_video`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | `Owner-authorised 2026-10-20 · "ship all · fully ready for customer"` · recent · author intent is clear but no explicit STATUS marker |
| Change | Adds 10 text/scalar columns to `nex_account` for intro video + chat screen wallpaper customisation. 9:16 portrait. 5 position × 5 font × 4 size × 3 align tokens. |
| Dependencies | Pairs with 210 (storage buckets) · pairs with 211 (title segments jsonb). Binaries live in 210's buckets. |
| NEX features depending | **Account identity surface** · `/nex-native/settings/intro-video` + any chat renderer that honours per-account intro customisation. Also referenced by the drawer entry (per existing control-drawer code). |
| Compatibility | 🟡 **Chain head of 209→210→211** · 209 (columns) + 210 (buckets) + 211 (segments jsonb) should apply as a group · 212 depends on 210's bucket. Applying 209 alone with no bucket means the pointer columns point at non-existent storage. |
| Evidence/authorisation needed before applying | 209+210+211 wave decision. Verification that the drawer entry (already in-code) tolerates NULL intro columns. |

### 210 · `nex_user_intros_storage`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | `owner-authorised 2026-10-20` |
| Change | Creates 2 Supabase Storage buckets: `nex-user-intros` + `nex-user-wallpapers`. RLS policy mirrors sealed `nex-avatars` pattern (migration 069 · applied). |
| Dependencies | Independent of 209/211 at DDL level · but functionally meaningful as a group |
| NEX features depending | 209's pointer columns + 212's shop-cover-override uploads use these buckets |
| Compatibility | 🟡 **Chain** · must land before 212 (which uploads to `nex-user-wallpapers` bucket) |
| Evidence/authorisation needed before applying | Decision on 209→210→211 wave. Verification bucket names don't collide with existing buckets (should be new). |

### 211 · `nex_account_intro_title_segments`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | `Owner-authorised 2026-10-20 · "ship segments"` |
| Change | Adds `intro_title_segments` jsonb column to `nex_account` for per-character styling. NULL means fallback to single-colour from 209. |
| Dependencies | **Hard: 209 must land first** · the fallback explicitly depends on `intro_title_color` from 209. |
| NEX features depending | Intro video title overlay rendering |
| Compatibility | 🔴 **Blocked on 209** · references the fallback column added in 209 |
| Evidence/authorisation needed before applying | 209 landed first. Chain-wave decision. |

### 212 · `nex_business_shop_cover_overrides`
| Field | Value |
|---|---|
| Applied on target DB | **NO** |
| Marker | **`Philip 2026-10-20 · FOUNDER AUTHORISATION PENDING · Shop Cover Wave`** · explicit pending gate |
| Change | Adds `shop_cover_image_url` + `shop_cover_tint_hex` to `public.nex_business`. Owner-overrides on sealed Cover-A theme (migration 100 · applied). Both nullable · zero regression. |
| Dependencies | **Hard: uses the `nex-user-wallpapers` bucket from 210** · path `shop/{business_id}/cover.{ext}` |
| NEX features depending | Business shop face · `/nex-native/{businessSlug}` · owner-tunable cover (new) |
| Compatibility | 🔴 **Blocked on 210** · the storage path is in a bucket that doesn't exist until 210 applies |
| Evidence/authorisation needed before applying | 210 landed first. Founder authorisation marked PENDING. |

---

## Dependency chains visible in the range

Three natural chains + several standalones:

### Chain A · Theme commerce (191 → 196)

```
191 catalogue extension (adds origin/bespoke/purchasable/price columns)
  ├─ 192 commission ledger (independent at DDL; needed for bespoke workflow)
  ├─ 193 purchase intent + state machine
  │     └─ 194 ownership (composite FK into 193 · hard dependency)
  ├─ 195 business theme pointer (service-level uses 193+194 ownership)
  └─ 196 column-level REVOKE/GRANT privacy fix (hard dependency on 191's new column)
```

**Apply order if the chain goes:** 191 → (192 || 193) → 194 → 195 → 196. 196 MUST follow 191.
**Policy flag:** 193 docstring says "Payment provider is NOT WIRED YET." Owner "NEX never handles payments" doctrine means `verified` state is unreachable until webhook adapter decision. Table landing is cosmetically dormant.

### Chain B · Harvester outreach (202 → 203)

```
202 email qualification columns (safe additive)
  └─ 203 outreach queue (3 named gates: schema apply + Phase 1.3 doctrine + env flag)
```

**Policy flag:** Phase 1.3 doctrine on legal basis + opt-out mechanism is explicitly "owner-blank today." 203 schema can land dormant; the feature itself needs the doctrine completion.

### Chain C · Intro video + shop cover (209 → 212)

```
209 intro video pointer columns on nex_account
  ├─ 210 storage buckets (nex-user-intros, nex-user-wallpapers)
  │     └─ 212 shop cover overrides (uses nex-user-wallpapers bucket)
  └─ 211 title segments jsonb (references 209's fallback column)
```

**Apply order:** 209 and 210 can go in parallel (one touches `nex_account`, the other creates buckets · zero DDL overlap). 211 must follow 209. 212 must follow 210.

### Standalones (no cross-dependency in this range)

- **188** · nex_business_media backfill (declarative · idempotent)
- **189** · nex_business_media_review queue (soft dependency on 188)
- **197** · community_rate_limit CHECK relaxation (standalone · low risk)
- **199, 200, 201** · privacy prefs trio (independent DDL, co-authored, sealed preflight script treats them as a group)
- **204** · chosen_handle display column (standalone · additive · null-safe)
- **205** · profile cover + interests (standalone · additive)
- **206** · hq_role (standalone DDL; policy-blocked at the identity-governance level)
- **207** · onboarding + vault trial (standalone DDL; policy-blocked at the Vault entitlements level · also doctrine-marker anomaly)
- **208** · discovery_signal marketing-only table (standalone · doctrine-isolated)

---

## Compatibility with the current live baseline

The live DB is at version 199 (last applied 2026-10-15T20:43:16Z). Nothing in the 188–212 range depends on an unapplied-earlier version · all cross-migration dependencies are internal to the range OR satisfied by applied versions (001, 002, 042, 069, 100, 116, 166, 167, etc. are all `YES` on target per the probe).

**No migration in this range is architecturally blocked by missing earlier migrations.** The blockers that exist are:

1. **Internal chain blockers** (194 blocks on 193, 196 blocks on 191, 211 blocks on 209, 212 blocks on 210). These are resolved by applying chain-head first.
2. **Policy blockers** (⚫ in the matrix) · unrelated to local-vs-DB divergence; they are doctrine-level gates owner must resolve independently.
3. **Service-layer tolerance for pre-apply schema** · for several migrations (200, 201, 205, 209), app code may already read the yet-to-exist columns. If the service degrades gracefully (NULL coalesce, information_schema probe), apply is reversible-safe. If it throws, apply surfaces otherwise-silent brittleness. **Verification pass needed before any of these applies individually.**

---

## Explicit "do NOT apply as routine" list

Per the owner's directive — "migrations that affect Vault, account privacy, identity, or theme ownership should not be treated as routine schema updates" — the following in this range are **non-routine** by that definition:

| Version | Reason non-routine |
|---|---|
| 191 | Theme ownership subsystem · chain head |
| 192 | Theme commission ledger (bespoke commerce) |
| 193 | Theme purchase state machine (chain-critical for ownership) |
| 194 | **Theme ownership · permanent per-purchase doctrine primitive** |
| 195 | Business theme override pointer (relies on ownership) |
| 196 | Chat-theme privacy fix (REVOKE/GRANT disruption surface) |
| 199 | **Account chat privacy preferences** (applied already · listed for completeness) |
| 200 | **Account profile visibility + who-can-message** |
| 201 | Account data-usage + upload quality preferences |
| 205 | Account profile cover + interests (identity surface) |
| 206 | **Account HQ role · privilege-escalation primitive** |
| 207 | **Vault trial column** (plus doctrine-marker anomaly) |
| 209 | Account intro video (identity surface) |
| 210 | Account intro + wallpaper storage buckets (identity surface) |
| 211 | Account intro title styling (identity surface) |
| 212 | Business shop cover override (owner tunable branding) |

**Routine-eligible (operationally low-risk · still requires per-file authorisation per Safety Constitution §5):**
- 188 · idempotent declarative backfill
- 189 · new table, isolated admin surface, soft chain
- 197 · one CHECK relaxation
- 202 · additive harvester columns, consumer code is probe-and-skip
- 203 · outreach queue schema (policy-blocked at feature flag, but schema itself is safe)
- 204 · chosen handle display column (nullable additive)
- 208 · marketing-only, doctrine-isolated

Even these "routine-eligible" items still require per-file authorisation. The owner-sealed CLAUDE.md §5 is clear: a migration being safe does not implicitly authorise its apply.

---

## Limitations of this matrix

Same three load-bearing limitations as the probe receipt earlier today:

1. **`nex_migration_history` records intent, not post-apply schema state.** A migration recorded as applied could still have had its DDL partially rolled back by an operator later. This matrix assumes the recorded applied set equals the live schema; a schema-level verification (second authorised probe querying `information_schema`) would be needed to prove each applied column actually exists.
2. **Out-of-band DDL may exist.** The 188 preamble explicitly says `nex.business_media` was applied directly outside the migration pipeline. If other out-of-band tables exist, they are invisible to this matrix.
3. **The policy flags (⚫) depend on the current state of owner-written doctrine.** Doctrine evolves; this matrix is a snapshot of 2026-10-20. Vault Entitlements Policy LOCKED, Package Contract DRAFT, Service Principle DRAFT, pricing proposal — any of these can change the policy assessment of a given migration.

---

## Specifically called out · Family Safety

Zero migrations in this range touch Family Safety. The 14 Family Safety service-layer tables identified in the earlier audit (`family_link`, `account_age_attestation`, `account_minor_profile`, `parent_custody_link`, `family_link_revocation_cooldown`, `family_link_pressure_report`, `family_safety_dashboard_access_log`, `parent_custody_audit_log`, `child_account_creation_request`, `safechat_classification`, `family_safety_entitlement`, `family_safety_payment_attempt`, `id_document_blob`, `id_verification_submission`) are **not present in the 188–212 range on local disk**. Any Family Safety migration would be version 213 or later.

**The owner's safeguard note stands:** physical absence of Family Safety tables on target DB is not yet proven · only `nex_migration_history` absence is proven. A separately-authorised `information_schema.tables WHERE table_schema = 'nex' AND table_name IN (...)` probe is the only way to upgrade "not recorded" to "verified-not-present."

---

## What this matrix does NOT authorise

- Does NOT apply any migration (single or batched)
- Does NOT author new migrations · including Family Safety
- Does NOT change feature-flag defaults
- Does NOT change public copy or Package Contract DRAFT
- Does NOT connect to the live DB (uses the earlier authorised probe output as evidence base)
- Does NOT commit, push, or deploy
- Does NOT touch Family Safety code, Emergency Help code, or any application code
- Does NOT update the Family Safety Database Proposal doc (owner's housekeeping note stands · wait for next explicit edit authorisation)
- Does NOT promote the Package Contract DRAFT to LOCKED
- Does NOT alter Phase A1's release hold

---

## Next approval gates (per migration)

Each row in the matrix has its "evidence/authorisation needed before applying" column. The owner can authorise any single-file apply by naming the version + confirming the gate conditions in that row. Chain-dependent files should be authorised as groups (191+196 together, 193+194 together, 209+210+211 together, 210+212 together) or chain-head-first-then-rest.

**Stopping here per the owner's directive. Report follows below · no further work.**
