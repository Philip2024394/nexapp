# XRATEDBELTS.COM · Hosting Ireland DNS setup

**Authored 2026-11-28 · owner directive § 1 + § 10 "HOSTING IRELAND INSTRUCTIONS".**

---

## 0 · What you are configuring and why

You registered `xratedbelts.com` with Hosting Ireland
(`www.hostingireland.ie`). The NEX production Worker that currently
serves `nexcorner.com` (Ireland deployment identity, Cloudflare account
hosting the `nexapp` Worker) must also answer requests for
`xratedbelts.com` and `www.xratedbelts.com` and render the
`x-rated-tool-belts` shop as the customer-facing site.

The application-side wiring (middleware rewrite, routes block in
`wrangler.jsonc`, sitemap, robots) has already been built and
verified in preview. **Only the DNS side is still pending**, and only
you (the account holder for both Hosting Ireland and the NEX Cloudflare
account) can perform these steps.

Two clean options are below. Pick ONE; do not mix them.

- **Option A — Move the `xratedbelts.com` zone to Cloudflare.** This is
  the simplest reliable path, matches how `nexcorner.com` is already
  wired, and uses the `custom_domain: true` route binding that is
  already declared in `wrangler.jsonc`.
- **Option B — Keep DNS at Hosting Ireland.** This is possible but
  more fragile: you cannot use `custom_domain: true` through a
  CNAME-only Cloudflare Worker setup, so you will need to add the
  zone to Cloudflare in DNS-only mode and keep registrar DNS pointing
  at Cloudflare records. In practice this collapses back to Option A,
  so Option A is the recommended route.

**Recommended:** Option A.

---

## 1 · Pre-checks before changing anything

Before touching Hosting Ireland or Cloudflare, confirm the following
with your own eyes. **If any check fails, stop and fix that first.**

1. You can sign into **Hosting Ireland** at
   `https://www.hostingireland.ie` with the account that registered
   `xratedbelts.com`.
2. You can sign into **Cloudflare** at `https://dash.cloudflare.com`
   with the account that owns the `nexapp` Worker and the
   `nexcorner.com` zone.
3. In Cloudflare → `nexcorner.com` zone → DNS, you can see the records
   that currently point `nexcorner.com` at the `nexapp` Worker. You do
   **not** need to change any `nexcorner.com` records · you are only
   reading them to confirm you are in the right Cloudflare account.
4. In Cloudflare → Workers & Pages → `nexapp` production Worker, the
   **Triggers** / **Routes** tab currently lists no route for
   `xratedbelts.com`. (Routes will appear automatically once you
   deploy the new `wrangler.jsonc` with owner approval · you do NOT
   add them manually.)

If any of these checks is unexpected, stop · do not proceed with the
DNS changes until the right account is confirmed. (This mirrors
`CLAUDE.md` § 2 preflight · identity verification before destructive
changes.)

---

## 2 · Option A (recommended) · move the zone to Cloudflare

### 2.1 · Step 1 · add the zone to Cloudflare

1. In Cloudflare → **Websites** → **Add a site**, enter
   `xratedbelts.com`.
2. Choose the **Free** plan (same tier as `nexcorner.com` unless the
   owner decides otherwise).
3. Cloudflare will scan existing public DNS. There should be nothing
   to import because the domain has never been configured. If
   anything does appear (unexpected), screenshot it and stop · do
   not proceed. The expected state is an empty zone.
4. Cloudflare will present you with **two nameservers** that look
   like `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`. Copy
   both exactly as shown · they are specific to this zone.

### 2.2 · Step 2 · change nameservers at Hosting Ireland

1. Sign into Hosting Ireland (`www.hostingireland.ie`).
2. Open your **Client Area** / **Control Panel** and locate the
   domain management screen for `xratedbelts.com`. The exact label
   varies between Hosting Ireland revisions; typical paths are:
   - `Dashboard → Your Domains → xratedbelts.com`, or
   - `Domains → Manage Domains → xratedbelts.com → DNS / Nameservers`.
3. Open the **Nameservers** section for `xratedbelts.com`.
4. Switch from "Use default Hosting Ireland nameservers" (or any
   existing value) to **"Use custom nameservers"**.
5. Enter the two Cloudflare nameservers you copied in step 2.1.4.
   Replace both values · do not leave any Hosting Ireland nameservers
   in place.
6. Save the change.

Hosting Ireland may show a confirmation that nameserver changes can
take up to 24 hours to propagate. In practice this is usually a few
minutes to a couple of hours.

### 2.3 · Step 3 · wait for Cloudflare to confirm the zone is active

1. Return to Cloudflare → **Websites** → `xratedbelts.com` → **Overview**.
2. Wait until Cloudflare shows the zone as **Active** (it polls the
   authoritative nameservers for the domain and flips to Active once
   both match the Cloudflare pair).
3. Do not proceed to step 2.4 until the zone is Active. No Worker
   route will attach to an unverified zone.

### 2.4 · Step 4 · owner approval + production deploy

Once the zone is Active:

1. The owner authorises the production deploy (a
   `workflow_dispatch` on `.github/workflows/cloudflare-deploy.yml`
   with `environment=production`). This is a separate approval
   gate per `CLAUDE.md` § 5 and the "PRODUCTION APPROVALS" list in
   the companion report.
2. `wrangler deploy --env ""` reads the top-level `routes` block in
   `wrangler.jsonc`:
   ```jsonc
   "routes": [
     { "pattern": "xratedbelts.com", "custom_domain": true },
     { "pattern": "www.xratedbelts.com", "custom_domain": true }
   ]
   ```
3. Cloudflare automatically:
   - creates an A/AAAA record on the `xratedbelts.com` zone pointing
     the apex at the Worker,
   - creates a CNAME-flat record for `www`,
   - provisions Universal SSL certificates for both hostnames.
4. No additional DNS records need to be added by hand.

### 2.5 · Step 5 · verification once live

After deploy:

1. Browse `https://xratedbelts.com/` · expect the X-Rated Tool Belts
   shop home.
2. Browse `https://www.xratedbelts.com/` · expect a 308 redirect to
   the apex, then the shop home.
3. Browse `https://xratedbelts.com/our-story`,
   `https://xratedbelts.com/product/<id>`,
   `https://xratedbelts.com/cart`, `https://xratedbelts.com/sign-in` ·
   each should render the corresponding shop surface with the
   URL bar still on `xratedbelts.com` (rewrites, not redirects).
4. Browse `https://xratedbelts.com/sitemap.xml` · expect a short
   two-URL sitemap listing only `https://xratedbelts.com/` and
   `https://xratedbelts.com/our-story`.
5. Browse `https://xratedbelts.com/robots.txt` · expect the
   `Host:` line to read `https://xratedbelts.com` and the
   `Sitemap:` line to read `https://xratedbelts.com/sitemap.xml`.

If any of these fail, stop · do not attempt manual DNS edits on a
Worker-managed `custom_domain` zone. Report the failure to the owner
and we investigate from the deploy evidence.

---

## 3 · Option B (not recommended) · keep DNS at Hosting Ireland

Only consider this if you have a specific reason to leave the zone at
Hosting Ireland (for example, Hosting Ireland hosts email MX records
for `xratedbelts.com` that you do not want to migrate yet).

In that case:

1. Add `xratedbelts.com` to Cloudflare the same way as step 2.1, but
   choose **"CNAME Setup"** instead of changing nameservers (this
   feature requires a paid Cloudflare plan on the target zone; it is
   not available on Free). Confirm pricing with the owner before
   proceeding.
2. Keep Hosting Ireland as the authoritative DNS, but configure the
   registrar DNS to point the apex and www at the Cloudflare
   CNAME-flatten targets Cloudflare issues.
3. Workers `custom_domain: true` still needs the zone owned by the
   Cloudflare account · if you can only get a CNAME-setup zone, the
   `routes` entries must be rewritten to use host-matched patterns
   (e.g. `xratedbelts.com/*`) rather than `custom_domain`. This is a
   different `wrangler.jsonc` shape and has not been prepared or
   tested in this cycle.

**Because Option B requires a paid Cloudflare plan and a different
`wrangler.jsonc` shape that has not been built or tested, it is
explicitly NOT the authorised path for this deploy.** If you want to
pursue Option B, raise it as a separate directive and a new cycle
will build and verify the CNAME-setup / host-pattern variant.

---

## 4 · Things NOT to do

- **Do not** add any A, AAAA, CNAME or TXT records manually at
  Hosting Ireland that point at Cloudflare IPs. Once nameservers are
  changed, Hosting Ireland DNS is no longer authoritative; any records
  left there are ignored but can cause confusion later.
- **Do not** add DNS records in Cloudflare for `xratedbelts.com`
  manually before deploy. The `custom_domain: true` route binding
  manages those records automatically; manual records can conflict.
- **Do not** turn on Cloudflare "Always Use HTTPS" or "Automatic
  HTTPS Rewrites" until after Universal SSL has issued · if you do,
  the first few requests can 525 until the certificate is in place.
  Both are usually on by default at a sane time anyway.
- **Do not** attempt to manually attach a Worker route in the
  Cloudflare dashboard before deploy. The routes are declared in
  `wrangler.jsonc` and wrangler will create them on deploy. Hand-added
  routes drift from the config and are overwritten.

---

## 5 · If anything goes wrong

1. If Cloudflare never flips to Active after 24 hours, check at
   Hosting Ireland that the nameserver change was saved exactly (no
   typos, no trailing dots, no extra whitespace) and that both NS
   values point at Cloudflare.
2. If deploy succeeds but `https://xratedbelts.com/` returns a 522
   or 525 error, wait 5–10 minutes for Universal SSL to issue. If
   still failing after 30 minutes, report to the owner · do not
   attempt to "fix" by adding records.
3. If deploy succeeds but the browser shows the splash / country
   gate instead of the shop, that is a code-side bug in the
   vanity-domain rewrite, not a DNS problem · report with the exact
   URL hit, the response status and the first 500 bytes of HTML.

---

## 6 · Summary

| Step | Who | Where | Outcome |
|---|---|---|---|
| Add `xratedbelts.com` to Cloudflare | Owner | dash.cloudflare.com | Two Cloudflare nameservers issued |
| Change nameservers at Hosting Ireland | Owner | www.hostingireland.ie | `xratedbelts.com` uses Cloudflare NS |
| Wait for zone to go Active | Cloudflare (automatic) | dash.cloudflare.com | Zone shows Active |
| Dispatch production deploy | Owner | GitHub Actions `cloudflare-deploy.yml` | Worker routes attached, SSL issued |
| Verify live | Owner | Browser | Shop renders on `xratedbelts.com` |

Nothing in this document is authorised to be executed automatically.
Every row is an owner-performed action.
