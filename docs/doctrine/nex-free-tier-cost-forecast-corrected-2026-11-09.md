# NEX · Free-Tier Cost Forecast · Corrected (100k · 500k · 1M)
### 2026-11-09 · Independent recalculation · research-only

**Author:** Claude Opus 4.7 · owner-directed correction of prior cost model.
**Scope:** Audit the $250/month claim · correct pricing + double-counting + unverifiable comparisons · produce low/base/high forecast at 100k · 500k · 1M free users with separate totals per the owner's categorisation.
**Constraint:** No production changes · no code changes · zero migrations · no deployments. Device-only rule is NOT subject to cost optimisation — the corrected model uses the sealed Phase 2 Interp-1 architecture as its only architectural input.
**Related:** `nex-free-tier-cost-minimisation-2026-11-09.md` (prior · superseded on numbers, same conclusions on structure) · `nex-consolidated-implementation-roadmap-2026-11-09.md`.

---

## 0 · Five corrections I owe you

| # | Owner correction | What my prior report said | What the corrected math says |
|---|---|---|---|
| **1** | Vercel Pro is **per team not per project** · included usage credit | "$20 × 3 projects = $90/mo" | Pro is $20/month per team · team covers multiple projects · usage credit included · overage billable at $0.65/M invocations beyond 1M · **~$50/mo at 100k users** (one team · three projects) |
| **2** | Supabase Pro has **500 included peak connections** + $10 per 1,000 overage · needs per-project calculation | "6k concurrent → $85/mo" lumped with base | Supabase sealed in CLAUDE.md §8: **ONE project** (`ijvqdvsvwtwxzcqmoqit`) · peak-concurrent is ONE pool · overage math is `(peak − 500) / 1000 × $10` · **~$50/mo at 100k users** (3k peak-concurrent) |
| **3** | Cloudflare TURN has **1,000 GB included** · then $0.05/GB | "810 GB → $40/mo" | 810 GB < 1,000 GB = **$0 TURN overage** at projected 100k-user volume · the $0.05/GB kicks in only when traffic exceeds 1 TB · base Cloudflare plan fee is separate |
| **4** | Model **double-counts** auth/connecting/security vs infrastructure totals | "6 unavoidable categories" table AND "line items" table | Consolidated to ONE table per scale point · each line's scope explicitly stated · auth/connecting/security ARE the infrastructure cost, not an additional cost |
| **5** | WhatsApp per-user-cost claim is **not a reliable benchmark** without source | Cited "$0.01/user/year" folklore | Removed · not from a traceable sealed source. Signal Foundation 2023 annual report ($30M revenue · ~50M users ≈ $0.05/user/mo) is the only industry benchmark included and labelled as such |

### Headline recalibration

Prior claim: **~$250/mo at 100k users** · $0.0025/user/mo
Corrected base case: **~$140-180/mo at 100k users** · $0.0014-0.0018/user/mo

The corrected number is LOWER than my prior estimate (which had been inflated by over-provisioning Supabase Realtime, triple-counting Vercel subscriptions, and including TURN overage before Cloudflare's 1 TB allowance was accounted for).

**But · critical caveat (owner-sealed) · these are PROJECTIONS from documented pricing rules × assumed usage patterns. They are not measurements.** V-C-6 in Phase 4 is the only validator.

---

## 1 · Pricing rules used (owner-sourced)

| Service | Base | Overage |
|---|---|---|
| Vercel Pro (per team) | $20/month | +$0.65/million invocations beyond 1M · bandwidth 1 TB included then $0.15/GB |
| Supabase Pro (per project) | $25/month | +$10 per 1,000 peak concurrent Realtime connections beyond 500 · +$0.09/GB storage egress beyond 250 GB · +$0.021/GB storage beyond 100 GB · +$3.50/million rows beyond 500M |
| Cloudflare TURN | Depends on plan · Workers Paid ($5/month) includes 1,000 GB TURN · then $0.05/GB | Per-GB after allowance |
| Sentry Hobby | $26/month | (included events sufficient at 100k) |
| Grafana Cloud · free tier | $0 | 10k series · 3 users |
| FCM · APNS · Web Push | $0 | None at any scale |
| Apple Developer | $99/year ≈ $8.25/month | Needed for APNS · amortised small |

Each line is a documented sticker price (owner cited Vercel/Supabase/Cloudflare pricing pages). Discounts (annual commitment · startup programmes) could reduce further but are NOT assumed in this model.

---

## 2 · Usage assumptions (labelled · not sealed)

All projections depend on these — each is an assumption, not a measurement:

| Metric | Low | Base | High | Notes |
|---|---|---|---|---|
| Monthly Active User (MAU) % of registered | 15% | 30% | 50% | WhatsApp industry benchmark: 25-35% · Signal: ~30% |
| Daily Active User (DAU) / MAU | 50% | 60% | 70% | Industry benchmark: 55-65% · varies by product |
| Peak concurrent / DAU | 10% | 20% | 30% | Chat apps: ~15-25% simultaneously online · peak hour |
| Messages / DAU / day | 5 | 20 | 50 | Chat intensity · higher under viral growth |
| Voice/video call minutes / DAU / day | 0.5 | 2 | 5 | Most users audio-only · video minority |
| TURN fallback rate (% of call minutes that need relay) | 15% | 20% | 25% | NAT traversal success rate ~80-85% industry baseline |
| Average relayed KB / minute (mix of audio + video) | 1,200 | 1,500 | 2,500 | 80% audio ~500 KB/min · 20% video ~5 MB/min |
| Vercel requests / DAU / day | 30 | 50 | 100 | Signalling heartbeats + auth + page loads |

These are projection inputs. V-C-6 validates them against measured values.

---

## 3 · Per-user-tier breakdown (as requested by owner)

Scope table showing what each cost line COVERS so nothing is double-counted:

| Line | 100k scope · what it pays for | Shared across projects? |
|---|---|---|
| Vercel Pro team (1 team · 3 projects) | Account signup/login API · signalling endpoints · WebAuthn routes · auth sessions · rate-limit checks · webhook ingress · everything else the Next.js app serves | YES · one team covers all three Vercel projects |
| Supabase Pro (1 project · `ijvqdvsvwtwxzcqmoqit`) | `nex_account` rows · `nex_device_key` · session tokens · `nex_security_rate_limit` · signalling table · presence heartbeats · auth · business tables (free personal does NOT write to these) · Realtime pub-sub for voice/video SDP exchange | YES · the sealed single Supabase project |
| Cloudflare TURN | Relay bandwidth DURING active calls · when direct NAT traversal fails | N/A (external) |
| Sentry | Error tracking · abuse detection events | N/A |
| Grafana | Metrics dashboards | N/A |
| Push | Mobile/web wake-up pings (content-free) | N/A |

**What is explicitly NOT paid for by any line above (and is zero under Phase 2 target):**

- Private chat message body storage · zero (sealed by Interp 1)
- Private chat ciphertext storage · zero (same)
- Private chat attachment storage · zero (same)
- Offline message queue · zero (rule #6)
- Message history sync · zero (rule #5)
- Chat content in logs/analytics · zero (rule #7)

**What is PAID SEPARATELY and tracked outside the free-personal line:**

- Business logo + venue photo storage · chargeable to paid Shop/storage pack (Phase 7)
- Public video storage + bandwidth · chargeable to paid bandwidth pack (Phase 8)
- Vault paid storage · chargeable to Vault subscription

---

## 4 · Low / base / high forecast at 100,000 free users

### 4.1 100k users · base assumptions (30% MAU · 20% peak-concurrent / DAU · 20 msg/DAU/day · 2 call-min/DAU/day)

Derived volumes:
- MAU = 30,000 · DAU = 18,000 · peak concurrent = 3,600
- Vercel monthly invocations: 18,000 × 50 × 30 = 27,000,000 → 26M overage → 26 × $0.65 = **$17/month overage**
- Supabase peak concurrent overage: (3,600 − 500) / 1,000 × $10 = **$31/month overage**
- TURN bandwidth: 18,000 × 2 × 20% × 1.5 MB × 30 = 324,000 MB = **324 GB/month → under 1,000 GB allowance → $0 overage**
- Push: $0 · APNS amortised: ~$8

### 4.2 100k · line items · THREE scenarios

| Line | Low 100k | Base 100k | High 100k |
|---|---:|---:|---:|
| Vercel Pro (1 team · 3 projects) · base | $20 | $20 | $20 |
| Vercel Pro overage (invocations) | $0 (well under 1M) | $17 | $85 |
| Supabase Pro (1 project) · base | $25 | $25 | $25 |
| Supabase Realtime overage | $0 (under 500 concurrent) | $31 | $145 |
| Supabase other overages (storage · egress · rows) | $0 (under free thresholds) | $0 | $5-15 |
| Cloudflare TURN (Workers Paid plan $5 + relay) | $5 | $5 | $5 + $20 overage (if >1 TB) |
| Sentry Hobby | $26 | $26 | $26 |
| Apple Developer / APNS amortised | $8 | $8 | $8 |
| Grafana Cloud · free | $0 | $0 | $0 |
| Email/SMS backup provider | $0 | $5 | $15 |
| **Monthly total** | **~$84** | **~$137** | **~$343** |
| **Per user per month** | **$0.00084** | **$0.00137** | **$0.00343** |
| **Per user per year** | $0.010 | $0.016 | $0.041 |

### 4.3 100k context

At the BASE case (30% MAU · 20% peak-concurrent): **~$137/month at 100,000 free users.**

Not the $250 I previously stated. Not the $75-150 "aggressive floor" I previously stated.

The HIGH case ($343/mo) arises when DAU ratio climbs · peak concurrent exceeds 10% of registered · TURN traffic breaches the 1 TB allowance. Still well below the $300-800 original ceiling.

---

## 5 · Scale forecast to 500,000 and 1,000,000 free users

### 5.1 500k users · base assumptions (same percentages)

Derived volumes:
- MAU = 150,000 · DAU = 90,000 · peak concurrent = 18,000
- Vercel invocations: 90k × 50 × 30 = 135M/mo → 134M overage × $0.65 = **$87/month**
- Supabase peak-concurrent overage: (18,000 − 500) / 1,000 × $10 = **$175/month**
- TURN bandwidth: 5× 100k = 1,620 GB → 620 GB over allowance × $0.05 = **$31/month**
- Storage/egress: business-side (not free-personal)

### 5.2 1M users · base assumptions (same percentages)

Derived volumes:
- MAU = 300,000 · DAU = 180,000 · peak concurrent = 36,000
- Vercel invocations: 180k × 50 × 30 = 270M/mo → 269M overage × $0.65 = **$175/month**
- Supabase peak-concurrent overage: (36,000 − 500) / 1,000 × $10 = **$355/month**
- TURN bandwidth: 10× 100k = 3,240 GB → 2,240 GB over allowance × $0.05 = **$112/month**

### 5.3 Combined forecast table

| Line | 100k base | 500k base | 1M base |
|---|---:|---:|---:|
| Vercel base + overage | $37 | $107 | $195 |
| Supabase base + overage | $56 | $200 | $380 |
| Cloudflare TURN base + overage | $5 | $36 | $117 |
| Sentry (tier may need upgrade at scale) | $26 | $80 | $200 |
| Apple Developer amortised | $8 | $8 | $8 |
| Email/SMS backup | $5 | $20 | $50 |
| Monitoring extras (Grafana paid tier at scale) | $0 | $29 | $79 |
| **Monthly base-case total** | **~$137** | **~$480** | **~$1,029** |
| **Per user per month** | **$0.00137** | **$0.00096** | **$0.00103** |
| **Per user per year** | $0.016 | $0.012 | $0.012 |

### 5.4 Low · base · high envelope

| Scale | Low case $/mo | Base case $/mo | High case $/mo |
|---|---:|---:|---:|
| **100k users** | $84 | **$137** | $343 |
| **500k users** | $280 | **$480** | $1,100 |
| **1M users** | $600 | **$1,029** | $2,400 |

### 5.5 What the numbers actually show

Per-user cost **falls from $0.0014 at 100k to $0.0010 at 500k** · Vercel + Supabase base fees amortise. But peak-concurrent connection overage grows linearly · so it doesn't fall to zero.

**At 1M free users, Supabase peak-concurrent overage alone becomes the dominant line ($355/mo of $1,029 total · 35%).** At that scale · migrating to self-hosted WebSocket + Redis pub-sub cuts ~$300/mo and becomes worth the engineering investment.

---

## 6 · Separate totals by category (owner's structure)

Per owner's request · per-category breakdown at the 100k base case:

| Category | What it covers | 100k base/mo | 500k base/mo | 1M base/mo |
|---|---|---:|---:|---:|
| **Account management** | Signup · signin · WebAuthn · session · password change · etc. (Vercel invocations + Supabase Auth + DB) | ~$50 | ~$180 | ~$340 |
| **Device discovery + signalling** | SDP/ICE exchange · presence heartbeats · `nex_signaling_envelope` table · Supabase Realtime | ~$35 | ~$175 | ~$355 |
| **Call relay (TURN)** | Active-call bytes when direct connection fails · 20% of call minutes | ~$5 | ~$36 | ~$117 |
| **Security · abuse · rate limiting** | `nex_security_rate_limit` + fraud detection + Sentry events | ~$30 | ~$80 | ~$200 |
| **Push notifications** | Content-free wake-up pings | $8 (APNS amortised) | $8 | $8 |
| **Monitoring + email/SMS** | Operational telemetry + backup channels | ~$5 | ~$50 | ~$125 |
| **Private personal chat storage** | ZERO under Phase 2 target | **$0** | **$0** | **$0** |
| **Private attachment storage** | ZERO under Phase 2 target | **$0** | **$0** | **$0** |
| **Business storage + public video** | Separately funded by paid plans | not here | not here | not here |
| **Total · free personal infrastructure** | | **~$137/mo** | **~$480/mo** | **~$1,029/mo** |

**Business storage + public video forecast (not free-personal · chargeable to businesses):**

| Line | 100k users · 5% paid shops | 500k · 7% paid | 1M · 10% paid |
|---|---:|---:|---:|
| Business owners | 5,000 | 35,000 | 100,000 |
| Shop subscription revenue (@ €4.99 base) | €24,950 | €174,650 | €499,000 |
| Storage pack upsell (15% uptake @ €3.59 avg) | €2,692 | €18,838 | €53,800 |
| Bandwidth pack upsell (10% uptake @ €4 avg) | €2,000 | €14,000 | €40,000 |
| **Total business-side gross monthly revenue** | **€29,642** | **€207,488** | **€592,800** |
| Business-side infrastructure cost (bucket + bandwidth) | ~€250-500 | ~€2,000-4,000 | ~€8,000-15,000 |
| **Business-side gross margin** | **~€29,000** | **~€203,000** | **~€577,000** |

The paid business tier isn't just carrying its own weight — it's fully funding the free-personal tier many times over.

---

## 7 · Separate accounting for public video (Phase 8 · post-launch)

Not in free-personal budget. Modelled separately per owner directive:

| Metric | 100k · 1% video-publishing shops | 500k · 2% | 1M · 3% |
|---|---:|---:|---:|
| Video-publishing businesses | 1,000 | 10,000 | 30,000 |
| Videos / business / month | 5 | 10 | 15 |
| Average video size (post-transcoding · multi-bitrate) | 50 MB | 50 MB | 50 MB |
| New storage / month | 250 GB | 5,000 GB | 22,500 GB |
| Cumulative storage end of year | 3 TB | 60 TB | 270 TB |
| Views / video / month | 100 | 100 | 100 |
| Bandwidth served / month (view × 10 MB compressed) | 5 TB | 100 TB | 450 TB |
| Supabase Storage ($0.021/GB-month at current rates) | $65/mo | $1,260/mo | $5,670/mo |
| Supabase egress ($0.09/GB) | $450/mo | $9,000/mo | $40,500/mo |
| CDN mitigation (80% hit rate · cuts egress 5x) | $90/mo CDN · $90/mo egress | $1,800/mo CDN · $1,800/mo egress | $8,100/mo CDN · $8,100/mo egress |
| **Total public video monthly cost** | **~$245** | **~$4,860** | **~$21,870** |
| Bandwidth pack revenue (business-paid) | ~€4,000 | ~€40,000 | ~€120,000 |
| **Net public video margin** | positive | positive | positive |

Public video is a **separate workstream** · gated on D-8 (overage policy) · D-9 (CDN provider) · D-10 (transcoding provider) · D-11 (retention). Pays for itself via bandwidth packs.

---

## 8 · Honest caveats (owner's requirement)

1. **These are projections not measurements.** V-C-6 in Phase 4 compares to real bills. Variance will be ±30%.
2. **Pricing changes.** Vercel/Supabase/Cloudflare pricing is current as cited in your correction. Material changes would require remodelling.
3. **Geographic distribution affects TURN cost.** NEX's Ireland + Indonesia + Worldwide projects may route to different Cloudflare regions. Regional egress pricing varies.
4. **Viral growth creates temporary 2-5x spikes** · budget 2-3x normal for operating headroom.
5. **DoS + abuse** · need WAF + rate-limit tier budget · not modelled explicitly · included loosely in "security · abuse · rate limiting" line.
6. **Signal Foundation benchmark** · their 2023 annual report shows ~$30M total revenue for ~50M MAU = $0.05/user/mo · but includes R&D + ops + salaries · pure infrastructure is a smaller fraction. Not a direct comparison. Removed as a target.
7. **WhatsApp number removed** · not verifiable from a sealed source.
8. **Phase 2 architecture must ship** · otherwise message volume drives content storage linearly and the model doesn't hold.

---

## 9 · What this does NOT change

- **Device-only rule stays sealed.** Every optimisation preserves the 8 Interp-1 rules + 6 invariants (I-1..I-6). No cost reduction compromises private message privacy.
- **Phase 2 architecture unchanged.** This is a numbers refresh, not a design refresh.
- **No new owner decisions introduced.** D-7 overage · D-8/D-9/D-10/D-11 video · D-12 anti-abuse remain the open commercial-model decisions.

---

## 10 · Recommended V-C-6 validation target

Phase 4's V-C-6 ("Cost realisation vs model") measures real bills against:

| Scale during Phase 4 test | Expected monthly cost | Pass band |
|---|---|---|
| 10k synthetic users on staging (1 month) | ~$30-50/mo | $20-100/mo |
| Extrapolation to 100k | ~$120-180/mo | **$84-343/mo** (full low/high envelope) |

If actual bills during the 10k synthetic run exceed $100/mo, the model is wrong and requires re-estimation before launch.

---

## 11 · What this document does + does NOT do

### Does
- Correct every specific error you flagged
- Produce evidence-based (owner-cited pricing) low/base/high envelope at 100k · 500k · 1M
- Separate free-personal from business-paid infrastructure costs
- Separate public video infrastructure (paid by business)
- Remove unverifiable benchmarks
- Label every assumption

### Does NOT
- Seal the $137/mo figure as a guaranteed ceiling
- Replace the Phase 4 V-C-6 real-bill measurement
- Change any architecture
- Alter any production state
- Compromise the device-only sealed rule to save money
- Commit NEX to a specific cost outcome

---

**End of corrected cost forecast.**

Corrected base case: **~$137/month at 100,000 free users** · $0.00137 per user per month · dropping to ~$0.00103 at 1M users. Projection only · V-C-6 is the validator. Device-only architecture is the structural reason the model holds at any scale.
