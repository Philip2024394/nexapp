<!--
  nexapp pull-request template
  Sealed: 2026-11-23

  Fill every section honestly. Blank sections do not pass review.
  See CLAUDE.md §3/§4/§5 for the push and deploy gates.
-->

## Summary

<!-- One or two sentences: what is this PR, and why now? -->

## Linked issue

<!-- GitHub issue, memory entry, or doctrine doc. Use "none" if truly standalone. -->

## Changes

<!-- Bullet list of the concrete changes. Keep it tight. -->

-

## Regression tests added?

- [ ] Yes — a new or updated automated test reproduces the original failure
      mode against observable behavior (not a source-code grep).
- [ ] No — explain below why a test is not applicable.

<!-- If "No", explain here: -->

## Blueprint maps regenerated?

- [ ] Yes — relevant files in `docs/map/*.md` updated to match this change.
- [ ] No — no blueprint impact.
- [ ] N/A — no `docs/map/*.md` exists for this surface.

## Migration applied?

- [ ] No migration in this PR.
- [ ] Yes — sandbox only (`kdstoyyeygcopkogqsyv`); production (`ijvqdvsvwtwxzcqmoqit`) NOT touched.
- [ ] Yes — sandbox AND production, under separate explicit authorisation (quote it below).
- [ ] Ref-check printed in the apply script output? (required — see `CLAUDE.md §8`).

<!-- Quote the owner authorisation for prod apply, if applicable: -->

## Security review needed?

- [ ] No — purely internal refactor / docs / test.
- [ ] Yes — touches auth, RLS, secrets, crypto, chat privacy, or payments.
      Flag `@Philip2024394` and wait for review before merging.

## Reviewer checklist

Reviewer, confirm:

- [ ] Scope matches title + summary; no drive-by edits.
- [ ] `CODEOWNERS` (if present) lists the right reviewer(s) for touched paths.
- [ ] All required CI checks are green (CodeQL, lockfile integrity, perf
      regression if applicable, SBOM for protected branches).
- [ ] No `D:/trades` / `Philip2024394/trades` string anywhere in the diff
      (nexapp supply-chain ban, MEMORY entry 2026-11-21).
- [ ] No `-A` / `--force` / destructive git ops referenced in scripts.
- [ ] Push and deploy to live are called out as separate owner-gated
      follow-up steps, not performed by this PR.
