# Runbooks — nexapp operational safety

**Sealed:** 2026-11-23
**Scope:** `C:/Users/Victus/nexapp` · branch `release-audit-v1-2026-11-14`
**Owner:** Philip · `asknexapp@gmail.com` (single contact — no fan-out)
**Supersedes:** nothing. New document.

---

## Purpose

These runbooks are how we respond when something is already broken. They
are NOT a shortcut around CLAUDE.md §3–§5. Every runbook step that would
change repository, deployment, database, or environment state **requires
a fresh named authorization from the owner** — even mid-incident.

If you are reading this because something is on fire: **take the first
three "Never do" actions below off the table immediately**, then read
the runbook that matches the surface.

---

## Runbook index — "when to use which"

| Runbook | Use when |
|---|---|
| [`worker-rollback.md`](./worker-rollback.md) | A Worker deployment on `nexapp-preview.nex-sandbox.workers.dev` (or future production Worker) is serving a broken build and you need to point traffic at an earlier version. |
| [`db-restore.md`](./db-restore.md) | A migration applied against sandbox (`kdstoyyeygcopkogqsyv`) or prod (`ijvqdvsvwtwxzcqmoqit`) produced a bad outcome — corrupted data, broken constraints, wrong RLS, etc. |
| [`secret-leak-response.md`](./secret-leak-response.md) | `scripts/security-ci/secret-scan.mjs` flags a leaked key, GitHub secret-scanning alerts, or a credential is otherwise known to have left the private boundary. |

If the incident does not match any of these, write up what happened in
`docs/engineering/session-handoff.md` and wait for the owner. Do not
improvise destructive actions.

---

## Severity definitions

These align with the HQ incident category model referenced in CLAUDE.md
and the 2026-11-08 Remediation Phase 1 severity discipline (P0-CURRENT
vs P0-GATE).

### SEV-1 — live user harm now

- Production (or active preview that end-users touch) is down, serving
  errors to real users, or leaking private data.
- Example triggers: 5xx rate > 10% sustained · chat decryption broken ·
  signed-URL mint returning other users' blobs · credential confirmed
  leaked AND in use against live infra · payment intents charging the
  wrong seller.
- Response window: immediate.
- Required artifact: `docs/engineering/session-handoff.md` entry + HQ
  incident row (DETECTED state) + owner notified at
  `asknexapp@gmail.com`.

### SEV-2 — reproducible defect affecting a surface

- A specific feature is broken for a specific audience, but the rest of
  the app is healthy; or a scheduled job has stopped; or a migration
  succeeded but downstream behavior is wrong.
- Example triggers: `/create-account` redirect broken on Ireland only ·
  one country's HQ alerts stopped polling · theme purchase fails but
  ownership rows unaffected.
- Response window: same session.
- Required artifact: handoff entry + HQ incident row (DETECTED) + a
  reproduction case written down before any code change.

### SEV-3 — degraded but tolerable

- Cosmetic bug · stale cache · non-critical background task flaked once
  and recovered · legacy term bleed-through that doesn't block a user.
- Response window: next planned work cycle.
- Required artifact: feature-ledger note. No incident row needed unless
  it recurs.

Promote severity up (SEV-3 → SEV-2 → SEV-1) if evidence appears. Never
demote without an evidence-based note from the owner.

---

## Escalation path

**Only one contact.** nexapp operates under the single-owner model
sealed in CLAUDE.md §8 and the user memory doctrine. There is no
on-call rotation, no team lead, no secondary. Do not invent one.

- Owner: Philip
- Email: `asknexapp@gmail.com`

For SEV-1: email subject should begin `[SEV-1 nexapp]` and include the
exact surface, time of first detection, the current user-visible
symptom, and a link to the relevant commit or HQ incident row.

For SEV-2: same format, `[SEV-2 nexapp]`. Can be bundled with other
work in the session-handoff.

For SEV-3: no email needed; record in the feature ledger.

**Do not escalate by changing anything.** Mid-incident, the instinct to
"just fix it" is exactly what Constitution §3–§5 forbids without a
fresh named authorization. Report first, change second — even for
SEV-1.

---

## Never do during an incident

These actions are prohibited even when something is actively broken.
Each requires a separate explicit authorization from the owner that
names the surface, the target, and the reason. There is no "emergency
exception."

- **No `git push --force` / `git push -f`** — history rewrites are
  destructive and bypass §3. If a bad commit landed, roll forward with
  a revert commit under a fresh authorization.
- **No `git reset --hard`** — against any branch, local or remote. If
  work needs to be undone, use `git revert` under authorization.
- **No `rm -rf`** — anywhere in the repo, ever, without an authorized
  path list. `safe-rm-log.md` captures authorized removals.
- **No production database migration** — the gate in CLAUDE.md §5
  applies even if the migration file is "just reverting" something.
  Migrations against `ijvqdvsvwtwxzcqmoqit` are their own named
  authorization, every time.
- **No sandbox migration without approval** — the same rule applies to
  `kdstoyyeygcopkogqsyv`. Sandbox is permissive for inspection, not
  for schema change.
- **No production environment variable change** — Cloudflare Workers
  settings, Supabase env, Stripe keys, etc. are owner-only.
- **No deploy** — `wrangler deploy`, Pages promotion, or any other
  action that moves bits to a user-facing surface requires explicit
  approval naming the target environment and SHA.
- **No admin grant / role change** — `support_admin_grant`,
  `hq_admin_grant`, Supabase role grants, or Cloudflare account
  members. Grants and revocations are their own authorization class.
- **No `BFG` / `git filter-repo`** — rewriting history to "clean up" a
  leaked secret is destructive AND ineffective (the key is already
  cached). Rotate at the provider first; history rewrite is a separate
  owner-named action.
- **No branch deletion** — especially not `release-audit-v1-2026-11-14`
  or `main`.
- **No `.env.local` commit** — even if the local file looks "clean."
- **No silently extending UI without DB wiring** — the 2026-11-12 rule
  still applies mid-incident.

If the fix for the incident genuinely requires one of the above, the
runbook will say so and the runbook will also say "owner must name
this authorization before you proceed." No exceptions.

---

## Reporting contract (post-incident)

After any incident, before closing:

1. Update `docs/engineering/session-handoff.md` with: what happened,
   when it was detected, what action was taken, what authorization was
   named, what evidence was captured, what remains blocked.
2. If a commit landed, list the SHA + range + files touched.
3. If a rollback script printed instructions (per `worker-rollback.md`),
   paste the log line from `docs/engineering/rollback-log.md`.
4. If the HQ incident row exists, update it from DETECTED to
   RECOVERY_ATTEMPTED (owner moves it to VERIFIED_RESOLVED separately).

Clearly distinguish completed actions from proposed actions and from
unverified assumptions, per §7 of the Constitution.
