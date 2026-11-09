# Pull Request · NEX

## Summary

<!-- What does this PR do, in one paragraph? Mention the user-visible
     outcome, the specific launch-readiness row(s) advanced, and the
     reason for the change. -->

## Change category

<!-- Tick one. -->

- [ ] 🐛 Bug fix (non-breaking · fixes an issue)
- [ ] ✨ Feature (non-breaking · adds functionality)
- [ ] 💥 Breaking change (API surface or user-visible behaviour change)
- [ ] 🔒 Security fix
- [ ] 🧪 Test · CI · tooling only (no production behaviour change)
- [ ] 📚 Documentation only
- [ ] 🧹 Refactor (no behaviour change)

## Sealed-invariant impact

<!-- Does this PR touch anything governed by I-1..I-6? If no, say
     "No · touches no sealed invariant surface." If yes, explain
     which invariant and how the PR stays compliant. -->

## Testing

- [ ] Unit tests added/updated (if logic changed)
- [ ] Playwright/E2E spec added/updated (if a user flow changed)
- [ ] Manual verification done · describe below
- [ ] Not applicable · explain below

<!-- If manual verification: what did you click, in which browser,
     at which viewport? -->

## Database / migration

- [ ] No migration
- [ ] Sandbox-only migration (apply-migration-NNN-sandbox.mjs attached)
- [ ] Rollback script included
- [ ] I-5 CHECK in rollback (refuses to restore private content)

## Deployment impact

- [ ] Feature flag · default OFF
- [ ] Config change only · no code behaviour
- [ ] Vercel build will change (frontend)
- [ ] Vercel server-runtime will change (API routes)
- [ ] Env var required · list below
- [ ] None (test · doc · ci)

## Launch readiness

<!-- Which row(s) of docs/doctrine/nex-launch-readiness-checklist-2026-11-09.md
     does this PR advance? Reference section + row number. -->

## Checklist

- [ ] I have run `npm run test` locally (or justified skipping)
- [ ] I have run `npm run typecheck` locally (or justified skipping)
- [ ] I have reviewed `git status` · no unrelated files are included
- [ ] I have not committed secrets · env files · or large binaries
- [ ] If this PR is a security fix · I have NOT included PoC for the
      vulnerability in the commit message
- [ ] If this PR modifies a sealed-invariant surface · the owner has
      authorised it

## Related

<!-- Issue number · prior PR · doctrine file · spec. -->

---

_By submitting this PR I confirm it respects the NEX Safety Constitution
(`CLAUDE.md` §1-8) and the sealed invariants I-1..I-6._
