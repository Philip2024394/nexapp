# NEX · Sandbox Supabase Project · Proposal · 2026-10-31

**Status**: proposal only · NOT CREATED · awaiting owner approval of name/region/tier/cost + synthetic-data policy before any Supabase API call.
**Driver**: owner-approved D-D · *"approve preparing a separate Supabase sandbox project with synthetic test data. It must be completely separate from the existing Indonesia production database. Do not copy private user data into it. Show me the project name, intended region, cost/tier and configuration before creating the project or incurring any charge."*

---

## 1 · Proposal

| Field | Value | Rationale |
|---|---|---|
| **Project name** | `nex-sandbox-previews` | Human-readable; clearly non-production; ties to the preview-deployment use case |
| **Supabase organisation** | `asknexapp@gmail.com` (same as production) | Simplifies ops; owner can see both in one dashboard; no cross-org access controls to maintain |
| **Region** | **`aws-eu-west-1` (Dublin)** | Matches production's region exactly (`aws-0-eu-west-1.pooler.supabase.com`). Same network latency profile; same PgBouncer configuration; same geo-residency class. Side-benefit: Ireland deployment preview tests have realistic latency |
| **Tier** | **Free** | Supabase Free: 500 MB DB · 1 GB storage · 50k monthly active auth users · 2 GB egress · 2 million Edge-fn invocations · $0/month |
| **Expected monthly cost** | **$0** | Free tier is sufficient for synthetic preview data at expected scale (dozens of synthetic rows, no real users) |
| **Projected growth** | Still free · zero paid upgrade authorised by this proposal | If sandbox usage grows past free limits (unlikely for preview-only), that is a SEPARATE owner decision |

---

## 2 · Synthetic data policy (D-D critical constraint)

**Owner rule verbatim**: *"Do not copy private user data into it."*

**What goes INTO the sandbox**:
- Schema from `nex-supabase/migrations/` applied in order (001 → 242 current). This is PUBLIC SCHEMA, no user data.
- Owner-authored dev personas (synthetic): `nex-99901..99905` style (which already exist in production as dev-mock-persona=true · the owner's sealed dev-impersonation set). These are personas, not real users.
- One or two synthetic Ireland businesses + products so Ireland preview tests have content to render.
- One or two synthetic Indonesia businesses + products so Indonesia preview tests have content.
- Zero rows copied from `nex_account`, `nex_message`, `nex_vault_*`, `nex_business`, `nex_product`, or any other production table that holds real user data.

**What is BANNED from the sandbox**:
- Any `pg_dump` of production.
- Any `supabase db dump` of production.
- Any INSERT ... SELECT ... FROM production.
- Any migration (244-248) applied to production.
- Any service-role key for the sandbox leaking to a non-sandbox env var.

**How the sandbox gets its data**: a dedicated seed script (`scripts/sandbox/seed-synthetic.ts`, not yet written) that INSERTs the synthetic personas + synthetic businesses + synthetic products from scratch. Re-runnable, idempotent. Does NOT touch production.

---

## 3 · Env-var plan (sandbox vs production isolation)

| Variable | Production value | Sandbox value |
|---|---|---|
| `NEXT_PUBLIC_NEX_SUPABASE_URL` | `https://ijvqdvsvwtwxzcqmoqit.supabase.co` | `https://<sandbox-project-id>.supabase.co` |
| `NEX_SUPABASE_URL` | same as above | same as sandbox |
| `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY` | production anon | sandbox anon |
| `NEX_SUPABASE_SERVICE_ROLE_KEY` | production service-role | sandbox service-role |
| `DATABASE_URL` | production pooler | sandbox pooler |
| `NEX_POSTGRES_URL` | current localhost/prod | sandbox |

**Preview Vercel projects (Ireland + Indonesia) will hold ONLY the sandbox values.** Never the production values. The G-PREVIEW-ISOLATION boot guard (already BUILT + TESTED in commit `357619c`) throws if a preview env is ever misconfigured with a production Supabase URL.

The production Vercel project (today's `nexapp`, to be renamed `nex-indonesia`) continues to hold production env vars.

---

## 4 · What creation requires from the owner

Three authorisations:

1. **Approve the project name + region + tier** in §1. Confirm sandbox is being created on your `asknexapp@gmail.com` org.
2. **Approve the synthetic-data policy** in §2 (nothing copied from production; seed script-based).
3. **Authorise the create step itself**: owner runs `supabase projects create` (owner has credentials) OR authorises me to run it via the Supabase CLI logged in as `asknexapp@gmail.com`.

**On creation**: I will NOT run any production migration against this sandbox without separate explicit approval. The first run is schema-only + synthetic seed.

---

## 5 · What this proposal does NOT authorise

- Applying the 7-migration DRAFT programme (244, 246, 247, 249, 251, 245, 248) to the sandbox or production.
- Copying ANY row from production.
- Using sandbox credentials in production env vars.
- Creating the Vercel preview projects (that is a separate step, conditional on this sandbox being up).
- Changing anything in the existing production Supabase (`ijvqdvsvwtwxzcqmoqit`).

---

## 6 · Verification checklist (post-creation · to be run before Vercel previews point here)

- [ ] `supabase projects list` shows `nex-sandbox-previews` under `asknexapp@gmail.com`.
- [ ] Project ID matches the one in the Vercel preview env vars.
- [ ] G-PREVIEW-ISOLATION boot guard tests pass against the sandbox URL (preview env + sandbox URL = safe).
- [ ] G-PREVIEW-ISOLATION boot guard throws when accidentally pointed at production URL.
- [ ] Seed script produces the synthetic personas + businesses + products.
- [ ] No row in sandbox `nex_account` has a non-synthetic email, handle, or user-identifier.

---

## 7 · Owner response needed

Reply with one of:
- **"Approved · create it"** — I run `supabase projects create nex-sandbox-previews --region=eu-west-1 --free-tier` via CLI logged in as `asknexapp@gmail.com`.
- **"Approved with changes"** — specify what changes (different name, different region, different data policy).
- **"I'll create it, give me the exact commands"** — I provide the exact CLI commands + env-var template; you execute.
- **"Hold"** — don't create.

Nothing happens until you reply.

---

*Proposal 2026-10-31. No Supabase API call made. No cost incurred. No preview project created. No existing production touched.*
