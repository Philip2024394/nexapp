# NEX Unwired Inventory · 2026-10-29

**Status:** READ-ONLY AUDIT · No DB changes · no code changes. Owner picks items to execute from this register.

**Preflight (verified against prod `ijvqdvsvwtwxzcqmoqit` 2026-10-29):**

| Probe | Result |
|---|---|
| `nex_friend_request` | ✅ EXISTS (215 applied) |
| `nex_friend_request.intro_note` | ✅ COL EXISTS (220 applied) |
| `nex_uploaded_video` | ✅ EXISTS (223 applied) |
| `nex_uploaded_video.is_ai_generated` | ✅ COL EXISTS (221-b applied) |
| `nex_account.is_mock_persona` | ✅ COL EXISTS (224-a applied) |
| `nex_live_session` | ❌ MISSING (219 NOT applied) |
| `nex_live_participation` | ❌ MISSING (221-a NOT applied) |
| `nex_live_engagement` | ❌ MISSING (222 NOT applied) |
| `nex_emergency_profile` | ❌ MISSING (225 NOT applied) |
| `nex_discovery_signal` | ❌ MISSING (208 base NOT applied → 216 cannot apply) |
| `nex_watch_listing` + ×5 companions | ❌ MISSING (227-232 NOT applied) |
| `nex_live_post` | ✅ EXISTS (029 applied, 233 view NOT applied) |

**Migration-tracking table (`nex_migrations` / `schema_migrations`)**: not accessible via service role on prod. Applied state inferred from table/column probes only.

---

## §1 · Migrations 215-233 state register

| # | File | Status | Depends on | Risk | Recommended action |
|---|---|---|---|---|---|
| 215 | `nex_friend_request.sql` | ✅ APPLIED | — | — | — |
| 216 | `nex_discovery_signal_add_enquiry_cart_signals.sql` | ⏸ BLOCKED | **208 base MISSING** (`nex_discovery_signal` doesn't exist in prod) | HIGH · can't apply until 208 exists | **Investigate 208 status first.** Likely entire discovery-signal subsystem is unapplied in prod. Separate audit needed. |
| 217 | `nex_rls_helper_search_path_harden.sql` | ❓ UNKNOWN | — | LOW (helper fns) | Can be applied safely in isolation — review SQL first |
| 218 | `nex_rls_harden_peer_message_and_live_post.sql` | ❓ UNKNOWN | 217 | LOW · policy hardening | Apply AFTER 217 |
| 219 | `nex_live_session_and_featured_product.sql` | ❌ NOT APPLIED | — | MEDIUM · new tables, RLS | **Apply to make live-session persistence real** (today's broadcaster uses it when `dbSessionIdRef` set) |
| 220 | `nex_friend_request_intro_note.sql` | ✅ APPLIED | 215 | — | — |
| 221-a | `nex_live_participation.sql` | ❌ NOT APPLIED | 219 | MEDIUM · new table + unique index | Apply AFTER 219 · **DUPLICATE NUMBER with 221-b** → rename to 226 first |
| 221-b | `nex_uploaded_video_is_ai_generated.sql` | ✅ APPLIED | 223 | — | — |
| 222 | `nex_live_engagement.sql` | ❌ NOT APPLIED | 219 | MEDIUM · new table (like/comment/share aggregate) | Apply AFTER 219 · gates the `recordLiveEngagementAction` call to persist |
| 223 | `nex_uploaded_video.sql` | ✅ APPLIED | — | — | — |
| 224-a | `nex_account_is_mock_persona.sql` | ✅ APPLIED | — | — | — |
| 224-b | `nex_emergency_schema.sql` | ❓ UNKNOWN · **DUPLICATE NUMBER with 224-a** | — | HIGH · creates emergency subsystem | Rename to 226 (or 234) first · owner authorisation required |
| 225 | `nex_emergency_profile.sql` | ❌ NOT APPLIED · **SEALED HOLD** per sealed memory 2026-10-23 | 224-b | **HOLD** | Do not apply · sealed in doctrine |
| 227 | `nex_watch_listing.sql` | ❌ NOT APPLIED | — | MEDIUM · new table | Apply as block with 228-232 |
| 228 | `nex_watch_listing_entitlement.sql` | ❌ NOT APPLIED | 227 | MEDIUM | Apply after 227 |
| 229 | `watch_listing_directory_v.sql` | ❌ NOT APPLIED | 227 | LOW · view | Apply after 227 |
| 230 | `nex_watch_listing_search_tsv.sql` | ❌ NOT APPLIED | 227 | MEDIUM · tsvector + GIN index · may block briefly on backfill | Apply after 227 · acceptable with empty table |
| 231 | `nex_watch_listing_deletion_audit.sql` | ❌ NOT APPLIED | 227 | LOW | Apply after 227 |
| 232 | `nex_watch_listing_rate_limit.sql` | ❌ NOT APPLIED | — | LOW · new table | Apply any time |
| 233 | `nex_live_post_directory_v.sql` | ❓ UNKNOWN (view) | 029 | LOW | Can apply · verifies `nex_live_post` exists ✅ |

### §1.1 · Collisions to resolve BEFORE applying

| Collision | Files | Fix |
|---|---|---|
| `187_*` | `187_nex_source_registry_osm_products.sql` + `187_nex_world_country_us_au_seed.sql` | Already applied? Both are pre-215 but file order ambiguous. Verify applied state. If both applied, no action. |
| `221_*` | `221_nex_live_participation.sql` + `221_nex_uploaded_video_is_ai_generated.sql` | **221-b already applied.** Rename `221_nex_live_participation.sql` → `226_nex_live_participation.sql` before applying. |
| `224_*` | `224_nex_account_is_mock_persona.sql` + `224_nex_emergency_schema.sql` | **224-a already applied.** Rename `224_nex_emergency_schema.sql` → `234_nex_emergency_schema.sql` before applying (if emergency subsystem is authorised). |
| `999_WIP_*` | `999_WIP_add_canonical_business_id_to_nex_business.sql` | WIP · **do not apply** until renamed + reviewed. |

### §1.2 · Sealed holds (do NOT apply)

- **225** `nex_emergency_profile` — sealed per 2026-10-23 memory until Emergency doctrine signed off
- **145** `nex_account_social_intents` — sealed per memory (Socials interaction architecture frozen)
- **202** `nex_business_canonical_email_qualification` — sealed per memory (Postmark cron re-classified, not active prod problem)

### §1.3 · Recommended apply order (if owner authorises each group)

**Group A · Live session persistence** (unblocks today's broadcaster real-persistence)
1. Rename `221_nex_live_participation.sql` → `226_nex_live_participation.sql`
2. Apply 219 (live_session + featured_product)
3. Apply 226 (ex-221-a · live_participation)
4. Apply 222 (live_engagement)
5. Apply 233 (live_post_directory_v)

**Group B · RLS harden** (safe, isolated)
6. Apply 217 (helper harden)
7. Apply 218 (peer_message + live_post RLS)

**Group C · Watches catalogue** (blocks nothing today, unlocks `/watches/*` surface)
8. Apply 227 → 228 → 229 → 230 → 231 → 232 in order

**Group D · Jail Phase B** (NEW — not yet drafted)
9. Draft `234_nex_live_jail.sql` with:
   - `viewer_id uuid NOT NULL REFERENCES nex_account(id)`
   - `broadcaster_id uuid NOT NULL REFERENCES nex_account(id)`
   - `started_at timestamptz NOT NULL`
   - `ends_at timestamptz NOT NULL`
   - `released_at timestamptz NULL`
   - UNIQUE (viewer_id, broadcaster_id, started_at)
   - Index on (viewer_id, ends_at) for the comment+DM gate lookup
   - RLS: viewer sees own rows, broadcaster sees rows they issued
10. Apply 234 (jail)
11. Wire server-side gates (see §2)

**Group E · Discovery signal subsystem** (needs full audit)
12. Investigate why `nex_discovery_signal` (208) is missing in prod · likely entire ladder 208 → 216 needs re-sequencing. Separate scope.

**Groups A + B + C + D together** = ~15 migrations · each needs owner approval before I run it against prod · separate deployment reminder: migrations don't deploy on their own.

---

## §2 · Hendra DM-gate during jail (Phase B · UNBUILT)

**Today's state:** jail overlay fires client-side on the jailed viewer. Server-side has ZERO enforcement — a jailed viewer can bypass by hitting the comment-send API directly, OR by DM-ing Hendra via peer-chat.

**Design to make it real (requires migration 234 above):**

### §2.1 · Schema
```sql
CREATE TABLE nex_live_jail (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id    uuid NOT NULL REFERENCES nex_account(id),
  broadcaster_id uuid NOT NULL REFERENCES nex_account(id),
  session_id   uuid NOT NULL,  -- nex_live_session.id when 219 is applied
  started_at   timestamptz NOT NULL DEFAULT now(),
  ends_at      timestamptz NOT NULL,
  released_at  timestamptz NULL,  -- early release (future · owner lifts jail)
  CHECK (ends_at > started_at),
  UNIQUE (viewer_id, broadcaster_id, started_at)
);
CREATE INDEX idx_nex_live_jail_viewer_active
  ON nex_live_jail (viewer_id, ends_at)
  WHERE released_at IS NULL;
```

### §2.2 · Gate helper
`src/lib/nex-native/live-broadcast/jail-list-service.ts`:
```ts
export async function isAccountJailedByBroadcaster(
  viewerAccountId: NexUuid,
  broadcasterAccountId: NexUuid,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from('nex_live_jail')
    .select('id')
    .eq('viewer_id', viewerAccountId)
    .eq('broadcaster_id', broadcasterAccountId)
    .gt('ends_at', now)
    .is('released_at', null)
    .limit(1);
  if (error) throw new Error(`jail-list.isJailed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
```

### §2.3 · Gate points (3 server-action edits)

| Call site | File | Current behaviour | New behaviour |
|---|---|---|---|
| **Jail issue** | `broadcaster-live-room/_actions.ts` (new action) | — | `INSERT nex_live_jail` after `jailChannelRef.jail()` fires |
| **Comment send** | `sendLiveCommentAction` (exists?) | — | Call `isAccountJailedByBroadcaster(session.account.id, broadcasterId)` · if true → `{ok:false, reason:'jailed'}` |
| **DM send to broadcaster** | `peer-message-service.ts::sendPeerMessage` | Accepts any peer | If recipient is a broadcaster of a session where sender is jailed → reject with `{ok:false, reason:'jailed'}` |

### §2.4 · Client surfaces
- Composer gate on viewer surface: when jail event received, composer disabled with "🔒 Comments turned off · M:SS remaining" (Phase A2 — not yet built)
- DM chat surface: when attempting to send DM to a broadcaster who has jailed you, show same locked state

### §2.5 · Auto-release
Not a cron; **lazy release**: the `isJailed` helper only returns true when `ends_at > now()`. No explicit release job needed in the pilot. The jail row stays in the table forever (audit log) with `released_at` NULL — it just no longer gates.

**Phase B total scope:** ~3 hours (migration draft + apply, service helper, 3 gate edits, viewer composer state, tests).

---

## §3 · Other unwired features (quick survey)

| Area | Status | Why unwired | Needs |
|---|---|---|---|
| **LiveFinishedRecap stats** | UI mock | Peak-viewer is live client-tracked (max 10), likes + comments not aggregated server-side | Phase B of jail design is needed first for comment counts; likes could be aggregated from existing `recordLiveEngagementAction` once 222 applied |
| **Live session heartbeat** | Wired but 219 unapplied | DB-side persistence stub silently fails | Apply 219 |
| **Mock viewers (Siti/Bayu/Melati) in presence** | Client-only mock | Realtime presence channel doesn't carry them (just injected in client state) | Not a bug · intentional dev-only mock |
| **Watches entire surface** | Full UI + API + service built | Migrations 227-232 unapplied | Apply 227-232 as block |
| **Emergency-help** | Full scaffold | Migrations 224-b + 225 sealed hold | Owner authorisation + rename collision |
| **Friend-request** | Partially wired | 215 applied, 220 applied · but FE surfaces may be incomplete | Separate audit |
| **Community notice** | Mock | Needs full schema review (not in this batch) | Separate authorisation |
| **Vault** | UI complete | Explicitly **LOCKED** per 2026-10-20 sealed decision | Blocked by sealed doctrine |

---

## §4 · Deployment gate (NO ACTION TAKEN)

The commit `c089c513` is **pushed to origin/main** but:
- Vercel linkage not verified in this audit
- No manual deploy triggered
- If Vercel auto-deploys on push, a build may have fired — **inspect at Vercel dashboard before trusting production**
- Production env vars not changed in this session

Per CLAUDE.md §5: *"Do not manually deploy, change Vercel project linkage, change production branches, alter production environment variables, or apply database migrations without separate explicit approval."*

---

## §5 · What I recommend for your NEXT ask

**One ask at a time, in this order:**

1. **"Apply Group A migrations"** (219, 221-a→226, 222, 233) · unblocks Live persistence. Need owner to confirm rename of 221-a. I'll apply each + report receipts.
2. **"Draft the Jail Phase B migration 234"** · I write the SQL · you review · you say apply.
3. **"Apply Group B RLS harden"** (217, 218) · safe, isolated.
4. **"Apply Group C watches"** (227-232) · unlocks watches surface. Need owner confirmation.
5. **"Wire Jail Phase B gates"** (comment-send, DM-send) · after 234 applied.
6. **"Audit discovery_signal subsystem"** · figure out why 208 base is missing in prod before 216 can land.

Each step is reversible on its own. Each needs explicit approval. No autonomous "wire everything."
