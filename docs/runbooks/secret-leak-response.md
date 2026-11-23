# Runbook — Secret leak response

**Sealed:** 2026-11-23
**Trigger:** `scripts/security-ci/secret-scan.mjs` flags a candidate
leaked key · GitHub secret-scanning alert fires · a credential is known
to have left the private boundary by any other means (shared in a
screenshot, pasted in a public channel, etc.).
**Severity:** SEV-1 by default — a leaked credential is live user-harm
potential until rotated.

---

## Precondition — owner awareness

Unlike the other runbooks, the first four steps below are time-critical
and some are pre-authorized **at the provider level** because the
owner's standing instruction is that provider-side key rotation is
always preferable to a leaked key remaining valid.

Specifically:

- **Rotating a key at the provider's dashboard** is pre-authorized
  because the provider-side action does not modify the repository or
  the deployment project — it changes only the credential value.
- **Updating Cloudflare Workers settings or `.env.local`** with the new
  credential requires a fresh named authorization naming the
  environment (preview, prod) and the key name.
- **Everything else** (history rewrite, force-push, revoking from app
  code, admin grant change) requires a fresh named authorization per
  CLAUDE.md §3–§5.

If in doubt, email the owner at `asknexapp@gmail.com` with subject
`[SEV-1 nexapp] secret leak — <provider>` before any step.

---

## Immediate actions (within 15 minutes)

### Action 1 · Rotate the key at the provider

Open the provider's dashboard. Rotate the specific key that leaked —
do NOT rotate the entire project's key set unless the owner names that.

Providers in use at seal time (confirm against current `.env.local`
and Cloudflare Workers settings before acting):

| Provider | Rotation URL (approximate) | Env var name(s) |
|---|---|---|
| Supabase (prod `ijvqdvsvwtwxzcqmoqit`) | `https://supabase.com/dashboard/project/ijvqdvsvwtwxzcqmoqit/settings/api` | `NEX_SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_NEX_SUPABASE_URL` (URL does not rotate) |
| Supabase (sandbox `kdstoyyeygcopkogqsyv`) | `https://supabase.com/dashboard/project/kdstoyyeygcopkogqsyv/settings/api` | same shape |
| Stripe | `https://dashboard.stripe.com/apikeys` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| OpenAI / LLM providers | provider-specific | `OPENAI_API_KEY` and siblings |
| Brevo (email per 2026-11-21 stack seal) | `https://app.brevo.com/settings/keys/api` | `BREVO_API_KEY` |
| Cloudflare API tokens | `https://dash.cloudflare.com/profile/api-tokens` | account-level, not in `.env.local` |
| GitHub tokens | `https://github.com/settings/tokens` | PATs and app installations |

Record the exact time of the rotation — the window between leak and
rotation is the "exposure window" and is the single most important
field in the post-incident note.

### Action 2 · Update the new key in Cloudflare Workers settings AND `.env.local`

**This step requires a fresh named authorization** per the precondition
above. The authorization should name:

- The key's env var name (e.g. `NEX_SUPABASE_SERVICE_ROLE_KEY`).
- The environments to update (preview, prod).
- The provider rotation reference (so the two actions tie together in
  the audit trail).

Steps:

1. Copy the new key from the provider's dashboard.
2. In Cloudflare: **Workers & Pages → nexapp-preview → Settings →
   Variables and Secrets** → edit the variable → paste → Save.
3. Repeat for any other environment the key is deployed to.
4. Update local `C:/Users/Victus/nexapp/.env.local` with the new value.
   Do NOT commit `.env.local`.
5. Restart local dev (`npm run dev`) to confirm the new key loads.

If the Cloudflare update requires re-deploying the Worker to pick up
the new variable (depends on binding type), the re-deploy is a
separate owner-named authorization under CLAUDE.md §5.

### Action 3 · Do NOT force-push to "clean" the git history

The leaked key is already in:

- GitHub's internal history.
- GitHub's secret-scanning cache.
- Any clone (Cloudflare Workers Builds, developer machines, CI caches).
- Possibly the attacker's hands.

Force-pushing to erase the file from history:

- Violates Constitution §3 (destructive op without authorization).
- Does NOT invalidate the key — only provider rotation does that.
- Does NOT remove the key from GitHub's secret-scanning records.
- Breaks every clone that was already up to date, including CI builds.

The provider rotation in Action 1 is what makes the key safe. Nothing
else does.

### Action 4 · File an incident note

Create a new section in `docs/engineering/session-handoff.md`:

```
## [SEV-1] Secret leak — <provider> — <yyyy-mm-dd HH:MM UTC>

- Detected via: <secret-scan.mjs | GitHub secret-scanning | other>
- Key: <env var name> (do NOT paste the key itself)
- Exposure window: <time of first exposure> → <time of rotation>
- Rotated at provider: <time>
- Cloudflare + .env.local updated: <time> (auth quoted: "...")
- Commit introducing the leak (if identified): <sha>
- Action 5 history-rewrite requested? <yes/no> — if yes, pending
  owner-named authorization.
- Remaining risk: <summarize what the attacker could still do, if any>
```

Also update `docs/engineering/audit-log.md` (the generator in
`scripts/audit-log-build.mjs` picks up session-handoff automatically).

### Action 5 · (Optional, owner-authorized) BFG or git-filter-repo

The only way to hard-clean the key from repository history is a
history rewrite via `BFG Repo-Cleaner` or `git filter-repo`.

This is:

- **Destructive** (rewrites commit SHAs across the branch's history).
- **Does NOT invalidate the key** — Action 1 does that.
- **Does NOT remove GitHub's cached copy** of the key — GitHub Support
  can be asked to purge, but their default policy favors keeping the
  audit trail.
- **Requires a force-push** to replace the remote's history.

For all of the above reasons, this action requires a fresh
owner-named authorization of the form:

> "run git-filter-repo on `<branch>` to remove `<path>` across history
> and force-push to `Philip2024394/nexapp`"

The owner must also confirm they have notified any other developers or
CI systems that have a clone — those clones will need to re-clone
after the rewrite, or their next push will re-introduce the key.

If the key was already rotated (Action 1), the usual answer is: do NOT
do this step. The audit value of keeping the bad commit outweighs the
near-zero security benefit of removing it after rotation.

---

## Prevention — `scripts/security-ci/secret-scan.mjs` is the gate

The scanner at `scripts/security-ci/secret-scan.mjs` is the pre-commit
and CI line of defense. It must be:

- Current with new provider key prefixes (Stripe `sk_live_` /
  `rk_live_`, Supabase service-role JWT patterns, Brevo `xkeysib-`,
  Cloudflare `cfat_`-derived tokens, GitHub `ghp_` / `ghs_` / `gho_`,
  OpenAI `sk-`, etc.).
- Run on every commit (local pre-commit hook) AND in CI.
- Produce exit code 1 when it flags.

When a new provider is added to nexapp (post-2026-11-23), the first
commit for that integration must also extend `secret-scan.mjs`. If the
scanner was extended but not committed to CI, the integration is
INCOMPLETE per the pattern in CLAUDE.md §10.

---

## Reference — what counts as "a leak"

- Key value appears in a commit (even if subsequently reverted).
- Key value pasted in a GitHub issue, PR comment, or public chat.
- Key value appears in a screenshot that was shared outside the
  owner's control.
- Key value present on a lost / stolen developer machine that was not
  full-disk-encrypted.
- Key value shared with a third party who no longer has authorized
  access.

Suspicion of any of the above → treat as a leak. The cost of an
unnecessary rotation is minutes; the cost of an unrotated real leak is
unbounded.

---

## Explicitly NOT in scope for this runbook

- Investigating whether the leak was exploited — that requires
  provider-side access logs and is owner-driven.
- Legal / disclosure obligations — owner decision, not runbook action.
- Revoking end-user sessions as a consequence of an auth-token leak —
  requires a separate authorization naming the user cohort.
