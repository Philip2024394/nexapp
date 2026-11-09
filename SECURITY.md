# NEX Security Policy

**Last updated:** 2026-11-09

If you have discovered a security vulnerability in NEX, thank you for taking the time to report it responsibly.

## Reporting a vulnerability

- **Email:** security@nex.app _(PENDING owner-supplied canonical support email · interim placeholder)_
- **See also:** [`/.well-known/security.txt`](public/.well-known/security.txt) · RFC 9116

Please include:
- A description of the vulnerability
- Steps to reproduce (minimal · deterministic if possible)
- The affected version (commit hash on `main` if known)
- Impact assessment (what can an attacker do)
- Any proof-of-concept artefacts (screenshots · HTTP captures · scripts)

## What NEX commits to

- Acknowledge receipt within **72 hours**
- Triage severity using CVSS v3.1 within **5 working days**
- Keep you informed of progress at least every **10 working days**
- Credit you in any eventual disclosure if you want (or keep you anonymous · your call)

## What NEX asks in return

- Do not publicly disclose until a mitigation is live
- Do not access, modify, or exfiltrate data belonging to other users
- Do not degrade NEX service for other users (no DDoS · no load testing against production)
- Do not use social engineering against NEX staff or other users
- Act in good faith · we will act in good faith in return

## Scope

**In scope:**
- All `nex.app` domains · including Ireland + Indonesia + Worldwide regional deployments
- All `*.nex.app` subdomains operated by NEX
- The NEX mobile web app
- The NEX API endpoints at `/api/nex-native/*`
- The sealed Supabase project at `ijvqdvsvwtwxzcqmoqit.supabase.co` _(reports via its own RLS or API path only · do not attempt to access Supabase project admin)_

**Out of scope:**
- Third-party services NEX relies on (Supabase · Vercel · Stripe · Cloudflare) · report those to their respective programmes
- Vulnerabilities requiring physical access to a user's unlocked device
- Social engineering of individual users
- Known theoretical issues that NEX publicly accepts _(e.g. "device-only chat means NEX cannot moderate private messages" is by design · sealed invariant I-3 · not a vulnerability)_
- Issues on NEX preview branches that never reached production

## Severity classification

NEX uses CVSS v3.1 base scoring with the following response-time targets:

| Severity | CVSS score | Mitigation target |
|---|---|---|
| Critical | 9.0 - 10.0 | 24 hours |
| High | 7.0 - 8.9 | 7 days |
| Medium | 4.0 - 6.9 | 30 days |
| Low | 0.1 - 3.9 | 90 days |

Vulnerabilities that would break sealed invariants I-1..I-6 (device-only chat architecture) are treated as **Critical** regardless of CVSS base score.

## Hall of fame

_(Empty · NEX is pre-launch.)_

## Legal · safe harbour

Good-faith security research conducted under this policy will not result in legal action against you by NEX. This is NOT an official safe-harbour contract and NEX cannot bind third-party services or law enforcement. If you have doubts, ask us first.

## Policy document version

- **v1.0** · 2026-11-09 · initial publication

## Related

- [`/.well-known/security.txt`](public/.well-known/security.txt)
- [`docs/doctrine/nex-incident-response-observability-runbook-2026-11-09.md`](docs/doctrine/nex-incident-response-observability-runbook-2026-11-09.md)
