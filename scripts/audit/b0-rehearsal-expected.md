# B0-C-light · expected results from the synthetic fixtures

If someone executes the rehearsal exactly as scripted (schema + fixtures + query), the query should return the following row.

## Fixture summary · what we seeded

### Accounts (10 total)

| account | has non-revoked device key? | device last_seen < 30d? | participates in recent conv? |
|---|---|---|---|
| alpha (001) | yes | yes (2d ago) | yes · in conv 001 + 003 |
| bravo (002) | yes | yes (5d ago) | yes · in conv 001 + 005 + 006 |
| charlie (003) | yes | yes (1d ago) | yes · in conv 002 |
| delta (004) | yes | yes (7d ago) | yes · in conv 002 |
| echo (005) | no (never provisioned) | n/a | yes · in conv 003 + 004 |
| foxtrot (006) | no | n/a | yes · in conv 004 |
| golf (007) | no (only revoked) | n/a | no |
| hotel (008) | no | n/a | yes · in conv 005 (as inactive participant) · also conv 007 (not recent) |
| india (009) | no | n/a | no (only in old conv 007) |
| juliet (010) | yes · but device stale (60d) | no | yes · in conv 006 |

### "Active" definition (query)

An account is active if EITHER:
- it has a non-revoked device_key row with `last_seen_at >= now() - 30 days`, OR
- it participates in a conversation with `last_message_at >= now() - 30 days`

That makes active = {alpha, bravo, charlie, delta, echo, foxtrot, hotel, juliet}  = **8 accounts**.
golf and india are not active · golf's only key is revoked and golf isn't in any recent conversation · india is only in an old conversation.

### Recent conversations (last_message_at within 30 days)

| conv | participants | most recent sender | both keyed? | sender keyed? | recipient keyed? | any inactive? |
|---|---|---|---|---|---|---|
| 001 | alpha + bravo | alpha | yes | yes | yes | no |
| 002 | charlie + delta | delta | yes | yes | yes | no |
| 003 | alpha + echo | alpha | no | yes | no | no |
| 004 | echo + foxtrot | echo | no | no | no | no |
| 005 | bravo + hotel | bravo | no (hotel has no key) | yes | no | hotel is inactive by key signal but IS active by conv signal · so classified as active for this fixture |
| 006 | bravo + juliet | bravo | yes (juliet has a non-revoked key, stale but counts) | yes | yes | no |

Conversation 007 (hotel + india) is NOT recent · outside the 30d window · ignored.

**Recent conversation total · 6.**

## Expected query output (one row, 10 columns)

| column | expected value | notes |
|---|---|---|
| `active_accounts_with_device_key` | **5** | alpha, bravo, charlie, delta, juliet |
| `active_accounts_without_device_key` | **3** | echo, foxtrot, hotel |
| `recent_conversations_both_keyed` | **3** | conv 001, 002, 006 |
| `recent_conversations_sender_keyed_recipient_not` | **2** | conv 003 (sender alpha keyed, echo not), conv 005 (sender bravo keyed, hotel not) |
| `recent_conversations_sender_not_keyed` | **1** | conv 004 (echo sends · no key) |
| `recent_conversations_participant_inactive` | **0** | all recent conv participants are active · hotel is active (in conv 005) · query's inactivity check uses UNION of both signals |
| `recent_conversations_total` | **6** | sanity: equals sum of (3 + 2 + 1 + 0) only if the four classification buckets are mutually exclusive, which they are per the WHERE clauses · if the owner wants overlap allowed, add a note |
| `active_accounts_total` | **8** | alpha, bravo, charlie, delta, echo, foxtrot, hotel, juliet |
| `run_at` | *(timestamptz · the moment of execution)* | not a count · present for traceability only |
| `device_keys_not_revoked_total` | **5** | alpha, bravo, charlie, delta, juliet · five rows with revoked_at IS NULL · golf's revoked row is excluded |

## Pass criteria

The rehearsal is a PASS if all 9 integer values match the expected table above when the query runs against the synthetic fixtures. If any value diverges, the discrepancy is logged (which bucket, expected vs actual) and the query is NOT recommended for production execution.

## Non-pass examples (what would surface design bugs)

- `recent_conversations_sender_keyed_recipient_not = 1` (instead of 2) · would indicate the query mis-handles conv 005 (bravo + hotel, hotel has no key)
- `active_accounts_total = 7` or `9` · would indicate the UNION of the two activity signals is off (golf would need to be excluded; hotel would need to be included)
- `device_keys_not_revoked_total = 6` · would mean golf's revoked row is incorrectly counted
- `recent_conversations_participant_inactive >= 1` · would be surprising given this fixture · hotel is inactive by key signal but ACTIVE by conv signal · worth owner review of whether the UNION-based "active" is the right definition
