# NEX attachment migration · public → private ciphertext

Owner-authorised 2026-11-08 build.

## What it does

Moves the **ciphertext bytes** of legacy encrypted peer-chat
attachments from the public `nex-peer-chat-attachments` bucket to
the private `nex-peer-chat-ciphertext` bucket. The script copies
bytes unchanged · it does **not** decrypt, re-encrypt, or touch the
device-held encryption keys.

After migration the peer-message envelope gains a `storage_path`
field alongside the existing `storage_url`. The client prefers
`storage_path` (signed-URL flow) when present and falls back to
`storage_url` otherwise. Legacy clients continue to work.

## What it does NOT do

- Does **not** decrypt attachments.
- Does **not** access device-held encryption keys.
- Does **not** delete historical public objects. A separate opt-in
  cleanup pass (not shipped here) handles that after owner review.
- Does **not** target production without an explicit env opt-in.

## Usage

Dry-run against sandbox:

```bash
node scripts/attachment-migration/migrate-ciphertext.mjs --dry-run --limit 10
```

Real run against sandbox (bounded batch):

```bash
node scripts/attachment-migration/migrate-ciphertext.mjs --limit 100
```

Resume · the ledger at `scripts/attachment-migration/ledger.jsonl`
records every record's outcome. Re-running skips `status: "ok"`
records automatically.

Production (defence-in-depth gate):

```bash
MIGRATION_ALLOW_PRODUCTION=yes \
node scripts/attachment-migration/migrate-ciphertext.mjs --project production --dry-run --limit 10
```

The script refuses to touch production unless
`MIGRATION_ALLOW_PRODUCTION=yes` is set.

## Flags

- `--dry-run` · reports what would be migrated · no writes · no ledger `ok` rows
- `--limit N` · process at most N candidate records this run (default 100)
- `--project <sandbox|production>` · env selection (default: sandbox)
- `--ledger <path>` · override the ledger file path

## Per-record flow

1. SELECT candidate rows · `attachment_meta.envelope.storage_url` present AND `storage_path` absent
2. Parse the object path out of the public URL
3. Download ciphertext from public bucket via service_role · compute SHA-256
4. Upload ciphertext unchanged to private bucket at the same object path
5. Download back from private bucket · verify SHA-256 matches
6. UPDATE the row's `attachment_meta.envelope` adding `storage_path`
7. Append a `{status: "ok"}` row to the ledger

Any step failure writes a `{status: "fail", stage: ...}` ledger row
and moves on · the record is picked up on the next run.

## Safety invariants

- Hash verification BEFORE the envelope update · no record is marked
  migrated until bytes-on-destination equal bytes-on-source
- Envelope update preserves `storage_url` · legacy access unaffected
- Idempotent · SELECT filters out rows already marked with
  `storage_path` · ledger skips `ok` rows · upload step treats
  "already exists" as non-fatal and re-verifies
- Bounded · `--limit` caps batch size · operator decides the window
- Resumable · Ctrl-C safe · ledger is append-only JSONL

## Ledger format

One line per record · JSON object:

```jsonl
{"at":"2026-11-08T...","message_id":"uuid","status":"ok","path":"enc/.../...","bytes":12345,"src_hash":"..."}
{"at":"2026-11-08T...","message_id":"uuid","status":"skip","reason":"unparseable_url"}
{"at":"2026-11-08T...","message_id":"uuid","status":"fail","stage":"download_public","error":"..."}
```

## Rollback

There is no automated rollback. If a record was migrated and later
needs to be reverted:

1. Remove the `storage_path` field from the envelope manually
2. The legacy `storage_url` stays · the client falls back to it

The private-bucket copy stays in place · no data loss.

## When to run

- First · owner authorises the production private bucket + applies
  migration 295 to production
- Second · operator runs this script with `--project production --dry-run`
  and reviews the candidate count + sample
- Third · operator runs the real migration in bounded batches
  (`--limit 500` is a sane starting size)
- Fourth · after every candidate record shows `status: "ok"` in the
  ledger, owner decides whether to run the (separate) public-bucket
  cleanup pass
