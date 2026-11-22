# Gate 1 · Cloudflare API token setup · DRAFT 2026-11-21

Only the owner can open this gate. Claude cannot generate Cloudflare
credentials on your behalf — the token is issued by Cloudflare against
your logged-in dashboard session.

The `cfat_` prefixed string previously supplied is **not** an API
token. That prefix marks it as a Cloudflare Access (Zero Trust) client
credential, used for authenticating to applications behind Access
policies. It can never be accepted by `api.cloudflare.com`. Confirmed:

```
$ curl -s -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
    -H "Authorization: Bearer <redacted>" -H "Content-Type: application/json"
{"success":false,"errors":[{"code":1000,"message":"Invalid API Token"}],
 "messages":[],"result":null}
```

Raw credential string is deliberately omitted from this file so GitHub
secret-scanning does not block pushes; the full value was pasted into
the conversation with Claude and lives in that transcript only.

## Clickpath · issue a real API token

1. Open `https://dash.cloudflare.com/profile/api-tokens`
   (dashboard → avatar top-right → **My Profile** → **API Tokens** tab).
2. Click **Create Token**.
3. Scroll past the templates to **Custom token → Get started**.
4. **Token name**: `nexapp-cutover-2026-11` (anything meaningful; it is
   shown back to you in audit logs).
5. **Permissions** · add these four rows:

   | Section | Resource | Access |
   |---|---|---|
   | Account | **Cloudflare Pages** | Edit |
   | Account | **Workers Scripts** | Edit |
   | Account | **Account Settings** | Read |
   | Zone | **DNS** | Edit |
   | Zone | **Zone** | Read |

6. **Account Resources** · "Include → Specific account → *your account*"
7. **Zone Resources** · "Include → Specific zone → `nexcorner.com`"
8. **Client IP Address Filtering** · leave blank (optional; adds a
   whitelist layer if desired).
9. **TTL** · leave open-ended OR pick 30 days then re-issue. Short
   TTL is safer for a migration token that will be revoked after
   cut-over anyway.
10. **Continue to summary** → verify the list → **Create Token**.
11. Cloudflare shows the token ONCE. Copy it immediately. It is of
    the form `<base64url chunk>` with no `cfat_` prefix.

## Verify the token works

Run this locally. Replace `$TOKEN` with the string Cloudflare just
revealed.

```bash
curl -s "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

Expected on success:

```json
{"success":true,"errors":[],"messages":[{"code":10000,
"message":"This API Token is valid and active"}],
"result":{"id":"...","status":"active"}}
```

If the response has `"success":false`, the token is either malformed
or missing scopes. Re-issue — do not try to edit the scopes of a live
token.

## Hand-off to Claude

Once verified, provide the token to Claude in whatever channel you
prefer. Claude will:

1. Store it only in the current conversation (not written to any file
   or env).
2. Run exactly ONE `verify` round-trip to re-confirm.
3. Proceed to step 1 of `README.md` execution checklist (provision
   the Pages project).

Do NOT paste the token into any file in this repo. Do NOT commit it.
Do NOT paste the raw token into a GitHub issue, PR description, or
chat log that is later screenshotted.

## Revoke after cut-over

Once step 8 of `README.md` (24h observation complete) passes:

1. Return to `https://dash.cloudflare.com/profile/api-tokens`.
2. Find `nexapp-cutover-2026-11`.
3. Click **…** → **Delete**.
4. Any long-running CI should use a narrower, scoped token
   (deploy-only), not the full migration token.
