# Architecture Decision Records

Short, numbered records of consequential architecture decisions. Each ADR
captures: context, decision, alternatives, consequences, and when it was
superseded.

New ADRs: `NNNN-short-topic.md`. Four-digit zero-padded. Never renumber
accepted ADRs.

| ID | Title | Status | Decision date | File |
|---|---|---|---|---|
| ADR-0001 | Data export architecture | DECISION-READY · implementation NOT YET AUTHORISED | 2026-10-15 | [../data-export-phase-2.md](../data-export-phase-2.md) |
| ADR-0002 | (reserved) `nex_peer_message.body` schema reconciliation under device-only E2E doctrine | DRAFT · to be authored | — | pending |
| ADR-0003 | (reserved) P2P fallback feasibility for peer messaging | DRAFT · to be authored | — | pending |

## Historical context

**ADR-0001** was authored at `docs/architecture/data-export-phase-2.md` on
2026-10-15 before this folder existed. We keep its original path (git history
preservation) and link it from this index.

## When to write an ADR vs a requirement

- Requirement (`docs/product/requirements/NEX-NNN.md`): **what** a feature
  must do for the user.
- ADR (`docs/architecture/decisions/NNNN.md`): **how** we decided to build
  it when the decision has long-lived consequences, picks between real
  alternatives, or interacts with doctrine (encryption, retention, pricing,
  deployment infrastructure).

A single-screen UI change typically needs neither.
