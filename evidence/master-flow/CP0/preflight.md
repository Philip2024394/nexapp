# CP0 — Preflight

Date: 2026-11-15
Repo: C:/Users/Victus/nexapp
Operator: Claude (integration lead) — no human sub-agents available

## 1. Repository baseline (unchanged)

| Item | Value |
|---|---|
| Branch | `release-audit-v1-2026-11-14` |
| HEAD (start) | `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b` |
| Remote | `https://github.com/Philip2024394/nexapp.git` (fetch + push) |
| predev guard | `scripts/assert-nexapp-cwd-and-remote.mjs` — passed |
| Dev server | `next dev -p 3008`, Next 16.3.8 (Turbopack), ready 2.4s |
| Local URL | `http://localhost:3008` |
| LAN URL | `http://192.168.1.3:3008` (phone-reachable on same LAN; no tunnel) |
| Env sources loaded | `.env.development.local`, `.env.local` |

## 2. Unrelated dirty-file baseline (do NOT touch)

- ` M data/nex-jobs/jobs.jsonl`
- ` M data/real-repo-audit-a-plus-b-2026-09-15/findings.json`
- ` M evidence/real-email-journey/02-post-submit.png`
- ` M next-env.d.ts`
- ` M scripts/.phase12-audit-test/data/programmer-execution/command_audit.jsonl`
- `?? .tmp/`

Any CP0–CP7 work must preserve these as-is and remain uncommitted. Start HEAD = End HEAD.

## 3. Supabase target — VERIFIED (sandbox)

Corrected 2026-11-15 after reading repo-local `CLAUDE.md` §8 (sealed 2026-10-12) and re-grepping with key-name filters.

Per §8 the NEX application code reads Supabase via the **NEX-prefixed** env keys. The unprefixed `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` are documented-stale legacy — the NEX code routes around them. Verifying the actually-used keys:

| Env key (role) | Project ref | Target class |
|---|---|---|
| `NEXT_PUBLIC_NEX_SUPABASE_URL` — app read/write | `kdstoyyeygcopkogqsyv` | Sealed sandbox ✅ |
| `NEX_SUPABASE_SERVICE_ROLE_KEY` | JWT for same project | Sealed sandbox ✅ |
| `DATABASE_URL` — DB tooling | `kdstoyyeygcopkogqsyv` | Sealed sandbox ✅ |
| `NEX_POSTGRES_URL` — directory read path | `kdstoyyeygcopkogqsyv` | Sealed sandbox ✅ |
| `SANDBOX_SUPABASE_URL` / `SANDBOX_DATABASE_URL` | `kdstoyyeygcopkogqsyv` | Sealed sandbox ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | `msdonkkechxzgagyguoe` | Documented-stale (not active; cosmetic cleanup per §8) |
| `NEX_TAXONOMY_POSTGRES_URL` | `localhost` | Local dev only |
| Prod ref `ijvqdvsvwtwxzcqmoqit` | Not active | Commented-out lines only |

Master-prompt §2 sandbox-verification requirement: **satisfied**. The running UI at `localhost:3008` writes to sealed sandbox `kdstoyyeygcopkogqsyv`.

### Doctrine conflict to reconcile later (not a CP1 blocker)

Repo CLAUDE.md §8 (sealed 2026-10-12) still names `ijvqdvsvwtwxzcqmoqit` as the single NEX Supabase project. The newer master prompt and 2026-11-09/10 sealed memory classify `ijvqdvsvwtwxzcqmoqit` as **prod (forbidden)** and `kdstoyyeygcopkogqsyv` as the sandbox. Master prompt is treated as the superseding authority for this pass; repo §8 wording has not been updated. Flagged for owner reconciliation.

## 4. Founder-visible identity — UNVERIFIED

Per §3 I cannot read session cookies, storage, or copy credentials. The visible name/handle currently signed in on `http://localhost:3008` is unknown to me. Needs owner declaration.

## 5. Disposable-account tooling audit

| Script | Target | Status |
|---|---|---|
| `scripts/seed-test-env-e2e.mjs` | `TEST_SUPABASE_URL` (separate E2E project); refuses `ijvqdvsvwtwxzcqmoqit` | Candidate path — needs `TEST_SUPABASE_URL` provided and target verified |
| `scripts/seed-dev-mock-accounts.mjs` | Requires `ijvqdvsvwtwxzcqmoqit` (prod) | FORBIDDEN by §2 |
| `scripts/seed-mock-contacts-for-99901.mjs` | Sandbox `kdstoyyeygcopkogqsyv`; modifies nex-99901 fixture | FORBIDDEN by §2 (fixture protection) |

UI-signup via SMTP real email is covered by §8 final gates and would need its own authorisation (not CP1 scope).

## 6. Agent / independence disclosure (§1)

No separate human agents are available. "Buyer agent", "Seller agent", "Builder" and "Independent QA" roles are all me. Any sub-agent I spawn via the `Agent` tool is Claude under the same weights operating in an isolated context — useful for parallel exploration, NOT independent QA in the strong sense §1 requires. All verification labels in later checkpoints will include method and will not claim independent QA.

## 7. Physical-phone access (§4)

No device access from this environment. LAN URL `http://192.168.1.3:3008` is reachable from phones on the same LAN without any tunnel or trusted-origin change. Phone operation requires the founder.

Phone criterion for CP1–CP7 = **BLOCKED pending founder-assisted test** unless the owner authorises otherwise.

## 8. Protected fixtures (reminder, §2)

Do not touch: nex-99901 (Hammerex Products), nex-99903 (Rosa), CK5 fixtures, or any already-landed unrelated data. All disposable accounts/businesses must be fresh and visibly named as such.

## 9. Secrets handling note

During the preflight grep of `.env.local`, tool output surfaced commented-out credential lines. No evidence file contains any of those values and they will not be repeated in any subsequent output. Further grepping of env files will use key-only filters.

## 10. Owner inputs still required before CP1 can start

1. Visible name/handle currently signed in on `localhost:3008`? (§3 — I will not read cookies.)
2. Disposable-account path for CP1+? (`seed-test-env-e2e.mjs` with `TEST_SUPABASE_URL` pointing at sandbox, UI-signup via authorised SMTP per §8, or another approved mechanism)
3. Is the founder willing to operate a phone against `http://192.168.1.3:3008` for CP1–CP7, or does the physical-phone criterion stay BLOCKED for this pass?
4. (Non-blocking) Which doctrine wins on the §8-vs-master-prompt Supabase classification? Treating master prompt as authoritative for this pass.

Start HEAD still `132bc24d…`. No commits, no pushes, no production activity.
