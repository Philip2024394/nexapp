# Production env vars inventory · Vercel scope

**Author:** Stream C · 2026-11-16
**Scope:** Document-only. No `.env.local` modifications. No Vercel access.
**Related:** `.env.example`, nexapp CLAUDE.md §8

---

## How to read this document

This is the comprehensive list of env vars the **Vercel production**
scope needs, grouped by subsystem. Owner reads this before
provisioning the production project. Cross-reference each entry
with the authoritative `.env.example` file for the full comment /
default / safe-defaults context.

Column semantics:

- **REQUIRED** — missing this blocks a production build or request.
- **CONDITIONAL** — required only when the owning subsystem ships.
- **OPTIONAL** — a sensible fallback exists in code.
- **FORBIDDEN** — must be ABSENT in prod (presence is a defect).

---

## A · Core (Supabase + session + encryption)

| Env name                              | Status      | Notes |
| ------------------------------------- | ----------- | ----- |
| `NEX_SUPABASE_URL`                    | REQUIRED    | Server admin writes. `https://ijvqdvsvwtwxzcqmoqit.supabase.co` |
| `NEX_SUPABASE_SERVICE_ROLE_KEY`       | REQUIRED    | **Secret.** Never log. Rotate on leak. |
| `NEXT_PUBLIC_NEX_SUPABASE_URL`        | REQUIRED    | Same URL, exposed to client. |
| `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY`   | REQUIRED    | Anon JWT for client SSR+realtime. |
| `NEX_SESSION_SECRET`                  | REQUIRED    | 32+ byte random. Signs cookies. |
| `ENC_KEY`                             | REQUIRED    | 32+ byte random. App-layer encryption. |
| `CRON_SECRET`                         | REQUIRED if any cron enabled in vercel.json | Vercel adds this header. |

## B · Push notifications

| Env name                              | Status      | Notes |
| ------------------------------------- | ----------- | ----- |
| `NEX_VAPID_PUBLIC_KEY`                | REQUIRED    | From `npx web-push generate-vapid-keys`. Same across environments sharing subscribers. |
| `NEX_VAPID_PRIVATE_KEY`               | REQUIRED    | **Secret.** Paired with public. |
| `NEX_VAPID_SUBJECT`                   | REQUIRED    | `mailto:…` or `https://…` |

## C · Public site URL (regional)

See `docs/doctrine/launch-infra-I9-2026-11-16.md` for detail.

| Env name                              | Status      | Notes |
| ------------------------------------- | ----------- | ----- |
| `NEX_PUBLIC_SITE_URL_IE`              | CONDITIONAL | REQUIRED if Ireland ships. |
| `NEX_PUBLIC_SITE_URL_WW`              | CONDITIONAL | REQUIRED if Worldwide or Indonesia ships. |
| `NEXT_PUBLIC_APP_BASE_URL`            | REQUIRED    | Canonical metadata base. |
| `NEX_APP_IDENTITY` / `NEX_APP_COUNTRY`| CONDITIONAL | Picks IE/WW/ID branch in site-url-resolver.ts. Per-Vercel-env value. |

## D · WebAuthn

See `docs/doctrine/launch-infra-I11-2026-11-16.md`.

| Env name                              | Status      | Notes |
| ------------------------------------- | ----------- | ----- |
| `NEX_WEBAUTHN_RP_ID`                  | REQUIRED    | Prevents Host-header spoofing. |
| `NEX_WEBAUTHN_ORIGIN`                 | REQUIRED    | HTTPS origin. |
| `NEX_WEBAUTHN_RP_NAME`                | OPTIONAL    | Defaults to "NEX". |

## E · Email (CONDITIONAL on sign-up emailing)

Pick ONE provider. Leave all others unset.

| Env name                              | Status      | Notes |
| ------------------------------------- | ----------- | ----- |
| `NEX_EMAIL_PROVIDER`                  | CONDITIONAL | `resend` / `mailgun` / `postmark` / `sendgrid` / `ses` / `smtp` |
| `RESEND_API_KEY`                      | CONDITIONAL | Only if provider=resend. |
| `NEX_DELIVERY_MAILGUN_*`              | CONDITIONAL | Only if provider=mailgun. |
| `NEX_DELIVERY_POSTMARK_*`             | CONDITIONAL | Only if provider=postmark. |
| `NEX_DELIVERY_SENDGRID_API_KEY`       | CONDITIONAL | Only if provider=sendgrid. |
| `NEX_DELIVERY_SES_*`                  | CONDITIONAL | Only if provider=ses. |
| `NEX_SMTP_*`                          | CONDITIONAL | Only if provider=smtp. |

## F · Launch flags

| Env name                              | Status      | Notes |
| ------------------------------------- | ----------- | ----- |
| `NEX_COMMERCE_ENABLED`                | OPTIONAL    | Default false per sealed 2026-11-06 Scope Reduction. |
| `NEX_SEARCH_ENABLED`                  | OPTIONAL    | Default false. Only flip when Supabase-REST or pooler Postgres is wired (see I22). |
| `NEX_CONTACTS_V2_ENABLED`             | OPTIONAL    | Default true (sealed 2026-11-11 flip). |
| `NEX_SAFECHAT_USER_FACING_ENABLED`    | FORBIDDEN unless SafeChat gate opened | Default false. |
| `NEX_EMERGENCY_HELP_ENABLED`          | FORBIDDEN unless emergency-help gate opened | Default false. |

## G · Alerts / observability

See `docs/doctrine/launch-infra-I20-2026-11-16.md`.

| Env name                              | Status      | Notes |
| ------------------------------------- | ----------- | ----- |
| `NEX_ALERTS_DISPATCH_ENABLED`         | REQUIRED for alerts | Set `"1"`. |
| `NEX_ALERTS_MIN_SEVERITY`             | OPTIONAL    | Default `"warning"`. |
| `NEX_ALERTS_SLACK_WEBHOOK_URL`        | CONDITIONAL | Set ONE channel (Slack, generic, or email). |
| `NEX_ALERTS_WEBHOOK_URL`              | CONDITIONAL | Generic webhook. |
| `NEX_ALERTS_EMAIL_FROM` / `_TO`       | CONDITIONAL | Email channel. |

## H · Postgres (NOT required for v1 if chat+themes only)

See `docs/doctrine/launch-infra-I22-2026-11-16.md`.

| Env name                              | Status      | Notes |
| ------------------------------------- | ----------- | ----- |
| `NEX_POSTGRES_URL`                    | FORBIDDEN if = localhost | Only set if Supabase pooler is used OR /search ships. |
| `NEX_CANONICAL_PG_URL`                | FORBIDDEN unless directory ships via raw PG | Same decision. |
| `DATABASE_URL`                        | CONDITIONAL | Pooler URL preferred. |

## I · Payments (Phase 2 · NOT configured)

Per .env.example section 5.1: zero STRIPE env is read in src/.
Setting any STRIPE_* in prod would have no effect in v1. Phase 2
scope.

## J · FORBIDDEN in prod (dev-only shortcuts)

See `docs/doctrine/launch-infra-I23-2026-11-16.md`.

| Env name                                      | Notes |
| --------------------------------------------- | ----- |
| `NEX_ALLOW_DEV_ADMIN`                         | Dev-only · currently unread by src but forbid regardless. |
| `NEX_DEV_ROUTES`                              | Exposes /dev routes. |
| `NEX_AGENT_INTERNET_FORCE_OFFLINE`            | Dev-only agent HTTP suppression. |
| `NEX_AGENT_INTERNET_FORCE_ONLINE`             | Dev-only agent HTTP coercion. |
| `NEX_LOCAL_ONLY`                              | Dev-only gate. |
| `NEX_LOCALPG_*`                               | Local Postgres creds. |
| `NEX_FOUNDER_MODE_*`                          | Only with sealed authorisation. |
| `NEX_CROSS_DB_RECONCILER_ENABLED`             | Only with sealed authorisation. |
| `NEX_FAMILY_SAFETY_ID_ADMIN_READER_TOKEN`     | Highly sensitive · only with sealed authorisation. |
| `NEX_DEV_IMPERSONATE_HANDLE`                  | Dev-only impersonation; dangerous in prod. |

## K · Feature-specific (set only if subsystem ships)

| Env name                              | Status      | Notes |
| ------------------------------------- | ----------- | ----- |
| `NEX_BACKPRESSURE_*`                  | OPTIONAL    | In-code defaults. |
| `NEX_AUTOSCALE_*`                     | OPTIONAL    | In-code defaults. |
| `NEX_WORKER_CIRCUIT_*`                | OPTIONAL    | In-code defaults. |
| `NEX_INPROCESS_LOAD_TIMEOUT_MS`       | OPTIONAL    | In-code default. |

## L · Phase 2+ (NOT required for v1 ship)

All Phase 2 workstreams listed at .env.example section 5. Setting
these would NOT make the corresponding features work because the
Phase 2 code paths are not wired. Leave unset.

---

## Reconciliation checklist (owner reads before prod deploy)

1. [ ] All of section A set, correct Supabase project ID.
2. [ ] Section B VAPID pair matches any existing push subscribers.
3. [ ] Section C IE or WW (or both) set per ship-list.
4. [ ] Section D WebAuthn pair set to the chosen production apex.
5. [ ] Section E provider pair set IFF sign-up sends email.
6. [ ] Section F flags all OFF except NEX_CONTACTS_V2_ENABLED.
7. [ ] Section G alerts channel picked and tested.
8. [ ] Section H left unset unless Directory ships via raw PG.
9. [ ] Section J env names all ABSENT (not just empty-string).
10. [ ] `vercel.json` cron secrets synchronised to section A.
11. [ ] Build succeeds. First request to `/` returns 200.
12. [ ] `/api/nex-native/health` (if exists) returns OK.

## Source

.env.example (all 548 lines) remains the authoritative source.
This document is a human-readable index; it does not replace the
in-file comments at each env name.
