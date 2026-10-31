# NEX · Owner Decisions · Short List · 2026-10-31

**Purpose**: the minimum set of decisions that genuinely need the owner before further engineering can meaningfully advance toward LIVE country apps. Everything else can proceed autonomously.
**Current engineering state** (round 9 build directive · commit WIP): identity resolver + SET LOCAL middleware + preview-DB guard + HQ service-role guard + env-first chrome switch all BUILT + TESTED locally. Vercel CLI logged in as `asknexapp-9176`. 7 migrations drafted + guarded. Nothing applied, nothing pushed, nothing deployed.

---

## 1 · Decisions that unblock the next engineering step

| # | Decision | Blocks | Minimum answer needed |
|---|---|---|---|
| **D-A · Ireland domain** | What domain should NEX Ireland serve from? | Vercel production domain binding + legal copy localisation | `nex.ie`, `nexapp.ie`, `ireland.nex.app`, or "I'll purchase one — defer to Q2" |
| **D-B · HQ domain** | HQ subdomain + whether to IP-allowlist | HQ production deployment | e.g. `hq.nex.app` + allowlist/no-allowlist |
| **D-C · Current Indonesia domain** | What URL does Indonesia production serve from today? | WebAuthn continuity analysis (CP-2) · Indonesia DNS cutover plan | the exact hostname |
| **D-D · Preview DB target** | Create a dedicated Supabase sandbox project? OR allow preview deployments to read production (writes blocked by G-PREVIEW-ISOLATION) OR other mechanism | G-PREVIEW-ISOLATION gate · all preview deployments | "create sandbox project" / "read-only against production" / "defer and keep preview deployments off" |
| **D-E · Vercel project creation authority** | May I run `vercel link` / `vercel` deploy using the logged-in `asknexapp-9176` account to create `nex-ireland-preview`, `nex-indonesia-preview`, and (not yet) `nex-hq-preview` projects? | First real Vercel preview deployment | yes / no / specify a different Vercel account |

---

## 2 · Decisions that only block LATER stages (not the next step)

| # | Decision | Blocks | Latest-safe-answer-time |
|---|---|---|---|
| D-F · WebAuthn domain strategy | Keep existing Indonesia domain to preserve credentials OR issue re-enrolment flow | Indonesia DNS cutover (JC-5) | After continuity shadow test |
| D-G · Payment adapters per country | Stripe / Midtrans / other for each | Pre-launch readiness · soft-launch viable without | Pre-launch |
| D-H · Legal review schedule | Privacy / ToS / DPA per country | Pre-launch | Pre-launch |
| D-I · Supabase tier verification | PITR enabled? Pool size adequate? | G-245-FORWARDFIX recovery evidence | Before Migration 245 shadow test |
| D-J · Signed-URL policy at Migration 248 | Strict / Dual-serve N days / Full revocation | G-STORAGE-URL-POLICY | Before Migration 248 apply |
| D-K · HQ moderation audit migration timing | When to draft + apply `nex_hq_moderation_audit` | Before any privileged moderation ships to prod | Before privileged moderation UI goes live |

---

## 3 · What I will NOT ask you to decide

Everything that is already approved in the plan or is a routine engineering choice. Specifically:
- The deployment-identity env var names (`NEX_APP_IDENTITY`, `NEX_APP_COUNTRY`) · settled.
- Three Vercel projects / one repo · settled (D-10).
- Ireland first / Indonesia second · settled (D-11).
- No global identity switch · settled (D-12).
- HQ independent / cannot flip identity globally · settled (D-13).
- RLS + storage + server enforcement · settled (D-14).
- Rev A plan structure + 26 gates · the plan is the plan.
- The 7 migration DRAFTs stay guarded until individual approval · settled.
- HQ ordinary-admin vs privileged-moderation separation · settled (RV-A8).

---

## 4 · What I CAN do without any of the above

- Build the Rev A plan's remaining safety fixes (Rev B · PITR target restriction, pre-state SQL fix, canary prohibition, expanded CP matrix).
- Produce the Migration 245 Rev B SQL + `245b` forward-fix template (DRAFT only, guarded).
- Produce the Migration 244c pre-state DRAFT (guarded).
- Produce the moderation-audit migration DRAFT (guarded).
- Add more connection-pool leakage tests.
- Expand the CP-13..CP-21 shadow test harness (code only, not run against production).
- Write the HQ permission matrix as code + table.
- Write the first privileged moderation server action as a template.
- Produce a Playwright acceptance suite that covers Ireland + Indonesia chrome + sidebar + HQ.

I will do these next unless the owner redirects.

---

*Shortlist 2026-10-31 · 5 decisions block next engineering step · 6 decisions block only later stages · 9 later-only decisions.*
