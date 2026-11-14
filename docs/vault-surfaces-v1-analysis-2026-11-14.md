# NEX v1 · Vault Surfaces · Required-vs-Missing Analysis · 2026-11-14

**Scope:** identify which Vault surfaces the current `/nex-native/vault/home`
UI **advertises** but which are not present in the repo, and separate
them from surfaces that are speculatively tested but not advertised.

**Sealed context:** v1 scope (2026-11-06 Scope Reduction) ships "Shop
(bundles Vault)". The advertised Vault experience is defined by what
links and chrome the Vault routes render to the user today. Any link
that renders live but hits a 404 is a demonstrated v1 defect, not
test-ahead-of-impl.

---

## Shipping Vault routes (confirmed built)

- `/nex-native/vault` (door / landing)
- `/nex-native/vault/intro`
- `/nex-native/vault/setup`
- `/nex-native/vault/home` (room list)
- `/nex-native/vault/home/chats`
- `/nex-native/vault/home/chats/[conversationId]`
- `/nex-native/vault/home/plans`
- `/nex-native/vault/home/videos`
- `/nex-native/vault/home/archived`

## API surfaces (confirmed built)

- `/api/nex-native/vault/chat/attachment/preserve`
- `/api/nex-native/vault/device/*`
- `/api/nex-native/vault/lock`
- `/api/nex-native/vault/migration`
- `/api/nex-native/vault/recovery/*`
- `/api/nex-native/vault/rotate`
- `/api/nex-native/vault/setup`
- `/api/nex-native/vault/status`
- `/api/nex-native/vault/step-up`
- `/api/nex-native/vault/unlock` + `unlock-attempt` + `unlock-materials`

## Missing surfaces · DEMONSTRATED v1 defects (user-visible links that 404 today)

### M1 · Vault Contacts page

- **Link rendered in Vault Home:** `page.tsx:564-608` · `ContactsEntryTile`
  renders a clickable `<Link href="/nex-native/vault/home/contacts">` with
  tile chrome, icon, and copy. Clearly visible to the user.
- **Destination file:** `src/app/nex-native/vault/home/contacts/page.tsx`
  does NOT exist.
- **Behaviour today:** tapping the Contacts tile hits a Next.js 404 for
  every v1 user who installs the Vault.
- **i18n keys exist:** `vault.home.contacts.sectionTitle`, `rowTitle`,
  `rowBlurb`, `vaultBadge`; plus `vault.contacts.header.title`, `subtitle`,
  `backLabel`, `search.placeholder`, `search.ariaLabel`, `empty.noneTitle`,
  `empty.noneBody` (in `src/lib/nex/i18n/keys.ts:317-449` and English +
  Indonesian packs).
- **Test contract exists:** `src/lib/nex-native/__tests__/vault-contacts.
  test.ts` describes 32 expected behaviors (reuses friend-service,
  account-service, peer-conversation-service, vault-entry-service · no
  duplicate contacts table · action sheet behavior · backlink, etc.).
- **Required for advertised v1 experience:** **YES.**

### M2 · Vault Settings page

- **Link rendered in Vault Home:** `page.tsx:216-234` · the Settings
  icon in the header is a `<Link href="/nex-native/vault/settings">`
  tagged `data-nex-vault-settings-link`.
- **Destination file:** `src/app/nex-native/vault/settings/page.tsx`
  does NOT exist.
- **Referenced in chrome:** `_vault-shell-header.tsx:6` documents
  settings sub-routes (`/nex-native/vault/settings`, `.../settings/*` for
  devices / recovery / rotate). `_lock-and-leave-header.tsx:40`
  references `/vault/settings` in its sealed-exclusions list.
- **i18n key exists:** `vault.home.settingsLinkLabel` (="Vault settings"
  in EN, "Pengaturan Vault" in ID).
- **Behaviour today:** tapping the gear icon hits 404.
- **Test contract exists:** `vault-persistence.test.ts` reads
  `vault/settings/page.tsx` and expects the "honest-limits" disclaimer
  copy after P4 migration.
- **Required for advertised v1 experience:** **YES** (even if the only
  content is a stub explaining this is coming).

---

## Missing surfaces · architecture gap (not user-visible link, but sealed contract)

### M3 · Vault recover page + unlock client

- **Not currently linked from Vault Home**, but referenced in:
  - `_vault-shell-header.tsx` as `.../settings/*` subroute set (devices
    / recovery / rotate)
  - `vault-lock-and-leave-recover.test.ts:37,41` expects
    `src/app/nex-native/vault/recover/_recover-unlock-client.tsx` and
    `src/app/nex-native/vault/recover/page.tsx`
  - `/api/nex-native/vault/recovery/*` server routes are built
- **Behaviour today:** lock-and-leave flow has no dedicated recovery UI
  route; recovery goes through the general unlock path.
- **Required for advertised v1 experience:** likely YES if the
  advertised "recover your vault" path is to be a distinct UX (not just
  re-unlock). **Needs owner decision.** If owner declares recovery
  flows through the existing unlock surface (no separate `/recover`
  route), the test needs retiring or redirecting at the existing
  unlock page.

---

## Non-required surfaces (tests fixable without build)

### F1 · `chat/inbox/page.tsx` (vault-move test · fixed in this pass)

The vault-move test referenced `src/app/nex-native/chat/inbox/page.tsx`
which never shipped. The sealed inbox for vault chat is actually
`vault/home/chats/page.tsx`. Test updated to point at the correct
file. **Not a required build item.**

---

## Summary matrix

| Surface | Advertised in UI? | Test contract exists? | i18n keys? | v1-required? |
|---|---|---|---|---|
| `vault/home/contacts` | YES (Vault Home tile) | 32 tests | 10+ keys | **YES** |
| `vault/settings` | YES (Vault Home gear icon) | 1 file | 1 key | **YES** |
| `vault/recover` | not directly | 1 file | — | NEEDS DECISION |
| `chat/inbox` | no | fixed (now points at vault/home/chats) | — | NO |

---

## Recommended next steps (NOT performing without explicit authorisation)

Engineering can implement M1 + M2 against their sealed test contracts
WITHOUT inventing new feature scope · the contracts dictate the shape
(reuse existing services · no new tables · no duplicate conversations
· honest-limits disclaimer copy already drafted in P4 migration).

**Smallest viable build to close the advertised v1 experience:**

1. **M1** · `src/app/nex-native/vault/home/contacts/page.tsx` +
   `_contacts-client.tsx` + `_vault-contact-action-sheet.tsx` (paths
   from the sealed test contract). Must satisfy `vault-contacts.test.
   ts` (32 tests). Reuses `friendService`, `accountService`,
   `peerConversationService`, `vaultEntryService`.
2. **M2** · `src/app/nex-native/vault/settings/page.tsx`. Must contain
   the P4 honest-limits disclaimer copy per `vault-persistence.test.ts`
   §E. Even a shell page with the disclaimer closes the 404.
3. **M3** · Owner decision: build `vault/recover/page.tsx` +
   `_recover-unlock-client.tsx` per the sealed test, OR retire the
   test with `describe.skip` + sealed-decision rationale, OR redirect
   the test to point at the existing unlock surface.

**Implementation is NEW FEATURE work · needs explicit founder
authorisation beyond "triage the failures".** This document identifies
the gap but does not fill it in this pass.

---

## What this analysis did NOT do

- Did not add any new page files.
- Did not stub the 404s with placeholder pages.
- Did not retire any failing test to hide the gap.
- Did not touch i18n packs.
- Did not change the sealed test contracts (they continue to describe
  what each missing surface must do when built).
