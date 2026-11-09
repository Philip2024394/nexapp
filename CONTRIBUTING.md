# Contributing to NEX

Thank you for considering a contribution. NEX is a pre-launch product with a single owner-maintainer; contributions are welcome but follow a strict review-and-authorise process because of the sealed security and architecture invariants.

**Read first:**
- [`CLAUDE.md`](CLAUDE.md) · NEX Safety Constitution (§1-8)
- [`SECURITY.md`](SECURITY.md) · responsible disclosure policy
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- [`docs/doctrine/nex-launch-readiness-audit-2026-11-09.md`](docs/doctrine/nex-launch-readiness-audit-2026-11-09.md) · what state NEX is in
- [`docs/doctrine/nex-launch-readiness-checklist-2026-11-09.md`](docs/doctrine/nex-launch-readiness-checklist-2026-11-09.md) · what state NEX needs to be in before public launch

---

## How to propose a change

1. **Open an issue first** (use the bug / feature / security template). The owner will triage and tell you if the change is in scope.
2. **Fork** the repository and create a branch off `main`:
   - `fix/<short-description>` for bug fixes
   - `feat/<short-description>` for features
   - `docs/<short-description>` for documentation
   - `test/<short-description>` for test-only changes
3. **Make your change** on your branch. Keep each PR focused on one concern.
4. **Test locally** (see "Testing" below).
5. **Open a PR** using the [pull request template](.github/pull_request_template.md).
6. **Owner review** · the [CODEOWNERS](.github/CODEOWNERS) routing requests the owner's review automatically. Expect iteration.
7. **Merge is owner-only** per constitution §4.

---

## What you CANNOT do without owner authorisation

- Push to `main`
- Merge any PR (owner does this)
- Deploy to Vercel (any project · including preview)
- Apply any migration to any Supabase project (sandbox or production)
- Modify any file under:
  - `src/app/nex-native/*/page.tsx` (founder-built UI)
  - `CLAUDE.md` (constitution)
  - `nex-supabase/migrations/*.sql` (schema)
  - Any `sealed-*` file
- Add third-party dependencies that are not already in `package.json`
- Change Stripe · Vercel · Supabase configuration

If your PR touches any of the above, the owner MUST authorise the specific change in the PR conversation before merge.

---

## Sealed invariants

Six invariants govern NEX's device-only private chat architecture · see the Phase 2 doctrine. Any PR that would weaken any of these is **auto-rejected**:

- **I-1** No private message content (bodies / ciphertext / attachment bytes / sensitive structured metadata) retained by NEX servers
- **I-2** No offline-delivery queue · no transient encrypted stash · no store-and-forward
- **I-3** No plaintext exception for business chat / NEX Official / HQ Direct Channel
- **I-4** No historical deletion without separate explicit owner authorisation
- **I-5** No rollback restores private message content
- **I-6** No public device-only-privacy claim until independently verified across every applicable surface atomically

The PR template asks you to self-check these. Be honest — the owner will verify.

---

## Testing

Before opening a PR:

```sh
npm install
npm run typecheck   # tsc --noEmit
npm run test        # vitest run (unit tests)
```

For E2E tests (requires dev server running on :3008):

```sh
npm run dev
# in a second terminal
npx playwright test tests/e2e/<specific-spec>.spec.ts
```

Current test state:
- Unit tests · 1067 files · ~14 known broken imports (see CLAUDE.md note) · do not fix in bulk
- E2E · 62 Playwright spec files · founder-authored for mobile Chromium Pixel 7

---

## Commit message style

Clear, imperative subject under 72 characters:

```
fix: closing modal race on /nex-native/vault

Describe WHY the change was needed. Describe WHAT changed only if the
diff is not self-evident. Reference the launch-readiness row this
advances · e.g. "Advances row G-3 (failure-injection tests)."

Close #123
```

Do NOT:
- Include secret material in commits (keys · tokens · passwords · PII)
- Use force-push to shared branches
- Rebase or squash a commit series the owner has already reviewed
- Add emoji to code or commit messages unless the owner has asked

---

## Where to ask questions

- **Bug report:** open an issue using the bug template
- **Feature idea:** open an issue using the feature template
- **Security:** email **security@nex.app** _(PENDING owner-supplied support email)_ · do NOT use GitHub issues
- **Anything else:** open a discussion

---

## Attribution

NEX is built by Philip O'Farrell with engineering assistance from Claude (Anthropic). See commit co-author lines for machine-authored contributions.
