# Changelog

All notable changes to **nexapp** are recorded in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).

## Versioning policy

nexapp is pre-1.0. We use date-anchored release tags of the shape
`nexapp-vYYYYMMDD-N`, where `N` is a monotonically increasing per-day
counter starting at 1. This is semver-adjacent — breaking changes are
called out explicitly under a `Changed` or `Removed` heading — but we
do not promise a stable public API surface until a 1.0 tag is cut.

Each release tag is created by `scripts/release-tag.mjs` and is a plain
annotated git tag. Pushing the tag is a separate, owner-gated operation
(see `CLAUDE.md` §4).

Changes are grouped under:

- **Added** — new features or files
- **Changed** — alterations to existing behavior
- **Deprecated** — soon-to-be-removed features
- **Removed** — features removed in this release
- **Fixed** — bug fixes
- **Security** — supply-chain or vulnerability-related fixes

---

## [Unreleased]

_Nothing yet._

---

## [2026-11-23] — Perf regression blueprint + supply-chain safety

Retrospective entry covering the perf-fix Definition of Done (CLAUDE.md §10)
and the supply-chain safety workflows sealed on the same day.

### Added

- `src/app/api/nex-native/version/route.ts` — deployment-chain verification
  endpoint. Serves commit SHA via `x-nex-commit-sha` response header so
  external probes can confirm which commit the live Worker is serving.
- `tests/e2e/perf-regression-asset-budgets.spec.ts` — three-assertion
  regression test (600 KB preload budget, mobile skip proof, Supabase
  preconnect/dns-prefetch presence).
- `tests/e2e/perf-regression-deployment-chain.spec.ts` — opt-in
  deployment-chain check (requires `PREVIEW_URL` + `EXPECTED_COMMIT_SHA`);
  skipped-rather-than-silently-passing when unset.
- `.github/workflows/perf-regression.yml` — CI workflow running the
  Playwright perf regression suite (chromium-only, prod build on :3009)
  on every PR to `main` and `release-audit-v1-2026-11-14`.
- `CLAUDE.md §10` — non-negotiable Definition of Done for perf fixes:
  verified improvement + regression test + required CI enforcement +
  updated project record. All four or the fix is incomplete.

### Changed

- `src/app/nex-native/layout.tsx` — backdrop preload now mobile-gated with
  `media="(min-width: 500px)"` and `fetchPriority="low"`, saving ~2.1 MB
  on mobile viewports where the CSS backdrop rule never paints. Supabase
  preconnect + dns-prefetch hints added so signed-in routes no longer
  pay a cold-TLS round-trip before the first auth / data query.

---

<!-- Comparison links -->
[Unreleased]: https://github.com/Philip2024394/nexapp/compare/nexapp-v20261123-1...HEAD
[2026-11-23]: https://github.com/Philip2024394/nexapp/releases/tag/nexapp-v20261123-1
