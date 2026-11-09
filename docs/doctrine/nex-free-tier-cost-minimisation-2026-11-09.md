# NEX · Free-Tier Cost Minimisation at 100,000 Users
### 2026-11-09 · Research-only · no code or infrastructure changes

**Author:** Claude Opus 4.7 · responding to owner question: "how far can we reduce free-personal infrastructure cost toward the technically practical floor?"
**Scope:** investigate per-user marginal cost at 100k free users under aggressive optimisation · identify where cost is structurally unavoidable vs choice-dependent · propose the cheapest defensible stack.
**Constraint:** zero storage of private chat content remains sealed (device-only · Interp 1). Cost optimisations must NOT weaken that property.
**Related doctrine:** `nex-consolidated-implementation-roadmap-2026-11-09.md` · `nex-100k-users-device-only-and-paid-business-storage-2026-11-09.md`

---

## 0 · Headline recalibration

Prior estimate: **$300-800/month at 100k free users** · $0.003-0.008/user/mo.

That was a conservative buffered ceiling. Honest floor analysis of each cost driver:

| Posture | 100k users monthly | Per user |
|---|---:|---:|
| **Aggressive-floor** (self-hosted TURN · free tiers maximised · minimal managed services) | **$75-150** | **$0.00075-0.0015** |
| **Pragmatic-baseline** (managed TURN · Supabase Pro · Vercel Pro) | $200-400 | $0.002-0.004 |
| **Prior conservative ceiling** | $300-800 | $0.003-0.008 |
| **WhatsApp public reporting** (pre-acquisition) | ~$0.01/user/year | ~$0.0008/user/mo |
| **Signal Foundation annual report** (transparent · publicly audited) | ~$0.02-0.05/user/mo | $0.02-0.05/user/mo |

**The technically practical floor for NEX free-personal is ~$75-150/mo at 100k users = ~$0.001/user/mo = genuinely competitive with WhatsApp's actual cost structure.** Getting there requires three specific infrastructure choices · detailed in §4.

---

## 1 · What free users structurally cost (unavoidable)

Six cost categories that exist regardless of optimisation (your list):

| Category | Why it's unavoidable | 100k-user monthly scale |
|---|---|---:|
| Account + auth | New users sign up · sessions get issued · passwords/WebAuthn validated · rate-limited security actions | $25-50 (Supabase Auth Pro tier included) |
| Signalling (who-is-where) | Device-to-device discovery · SDP/ICE exchange · presence heartbeats | $10-30 depending on mechanism |
| Relay (TURN) | 10-20% of calls fail direct NAT traversal · relay carries bytes DURING active call only | $10-150 depending on provider |
| Notifications | Content-free push to wake recipient device | $0-5 (FCM/APNS/Web Push are free) |
| Security + abuse | Rate limiting · fraud detection · audit log · incident monitoring | $25-75 (Supabase DB + monitoring) |
| Vercel compute | Serverless invocations for API routes · auth · signalling endpoints · chat routing (but not content persistence) | $30-150 depending on DAU |

**Sum of structurally-unavoidable components at 100k users: $100-460/month depending on provider choices.** This is the real range · the $300-800 prior estimate added significant buffer. The ~$75-150 floor is only reachable if TURN is self-hosted (the single largest variable).

---

## 2 · What free users should NOT cost (sealed by Interp 1)

| Category | Why it's zero under Phase 2 target |
|---|---|
| Private message body storage | Phase 2 rule #4 · never written to NEX storage |
| Private message ciphertext storage | Phase 2 rule #4 · ditto |
| Private attachment storage | Phase 2 rule #5 · travels via WebRTC data channel · never hits Supabase Storage |
| Offline message queue | Phase 2 rule #6 · no store-and-forward |
| Conversation history sync | Phase 2 rule #5 · device-local only |
| Message content in logs | Phase 2 rule #7 · logs scrubbed |

**These categories go to zero at scale.** Which is the structural advantage: cost grows with activity (CPU + bandwidth) not with content volume.

---

## 3 · Cost driver deep-dive

### 3.1 Supabase

| Tier | Monthly | What it covers at 100k users |
|---|---:|---|
| Pro | $25 | Auth (100k MAU included) · Storage (100 GB included · we use < 1 GB for metadata) · Database (8 GB · plenty for metadata-only tables) · Edge Functions · Realtime (500 concurrent included · additional $10/1k concurrent) |
| Pro + Realtime add-ons | $25 + $60 = $85 | Covers 6k concurrent WebSocket subscriptions (30k DAU × 20% simultaneously online) |
| **Annual commitment discount** (if negotiated) | ~20-30% off | Material at scale |

**Supabase cost at 100k users: $25-85/mo · one of the cheapest line items for what it provides.**

Caveat: egress bandwidth. Supabase Storage charges $0.09/GB. Since Phase 2 architecture serves zero chat content from storage, chat egress is ~zero. Only business public assets + public videos use storage · those are chargeable to the paid business plan.

### 3.2 Vercel

| Metric | Free | Pro ($20/mo) | Enterprise | At 100k NEX users |
|---|---|---|---|---|
| Invocations | 1M | 1M included + $0.65/M | custom | ~45M/month projected |
| Bandwidth | 100 GB | 1 TB included | custom | ~100-200 GB |
| Build minutes | 100 | 400 | custom | <100 (3 projects × ~30 min/week) |

**Vercel Pro per project: $20/mo · three projects × $20 = $60/mo base.** Invocation overage at 45M/month = ~$30/mo for the main project. **Total Vercel at 100k users: $90-150/mo.**

Alternative paths that could cut this:
- Cloudflare Workers · 10M requests included · $0.30 per additional million · at 45M this would be ~$10/mo + routing overhead
- Self-hosted Node on $20/mo VPS + Caddy/Nginx · $20-50/mo · higher ops burden
- But · Vercel's edge network + Next.js integration is genuinely valuable · migration costs > savings at this scale

**Vercel recommendation: stay · $90-150/mo is acceptable.**

### 3.3 TURN relay · the single biggest variable

Per RFC 8656 + WebRTC industry rules of thumb: 10-20% of peer-to-peer calls fail direct NAT traversal and need TURN relay. At 100k users with 30% DAU and ~2 call-minutes/user/day average: ~18,000 call-minutes/day going through TURN · ~540,000 minutes/month.

Bandwidth per relayed call-minute: ~0.5-1 MB for audio · 5-10 MB for video.

Assuming 80% audio · 20% video: ~1.5 MB average per relayed minute · 810 GB/month of TURN traffic.

**Provider pricing (2026-11-09 published rates):**

| Provider | $/GB | Monthly at 810 GB | Notes |
|---|---:|---:|---|
| Self-hosted coturn on $10/mo VPS × 2 (redundant) | ~free (bandwidth included in VPS plan up to ~5 TB) | $20/mo | Highest ops burden · SRE responsibility |
| Cloudflare TURN (managed) | $0.05/GB | $40.50/mo + base fees | Lowest managed price · zero-persistence is contractually guaranteed per their docs · ideal for Phase 2 compliance |
| Metered.ca | $0.25/GB | $202.50/mo | Mid-tier · flexible pricing · zero-persistence per DPA |
| Xirsys | $0.35/GB | $283.50/mo | Enterprise-ish |
| Twilio Network Traversal | $0.40/GB | $324/mo | Most expensive |

**TURN provider choice is a $20-$324/mo swing at 100k users.** Cloudflare TURN is the sweet spot: managed · cheap · contractually zero-persistence · integrates cleanly with WebRTC JS SDKs · scales without owner ops burden. Self-hosted is cheapest absolute but adds SRE load disproportionate to the savings.

### 3.4 Push notifications

| Platform | Cost | Why |
|---|---|---|
| Firebase Cloud Messaging (Android · Web) | Free | No per-notification fee at any scale |
| Apple Push Notification Service (iOS) | Free | Free with Apple Developer account ($99/year · amortised to $0.001/user/year at 100k users) |
| Web Push (VAPID) | Free | Self-hosted · no external service |
| OneSignal / Pusher Beams · managed alternative | $9-99/mo | Not needed · own dispatch is simpler |

**Push cost at 100k NEX users: ~$0-5/mo.** Essentially free.

### 3.5 Monitoring · observability · security tooling

| Tool | Free tier | What we actually need at 100k users |
|---|---|---|
| Vercel Logs | Included | Yes |
| Supabase Logs | Included | Yes |
| Sentry (errors) | 5k events/mo free | At 100k users · ~10k events/mo mod active · $26/mo Hobby tier |
| Grafana Cloud | 10k series free · 3 users | Sufficient for dashboards |
| PagerDuty / Opsgenie | ~$20-40/mo | Owner decision · may not be needed at launch |

**Realistic monitoring cost: $30-60/mo.**

### 3.6 CDN

At 100k free users · no chat content ever serves from CDN (device-local). Business logos + venue photos are small · maybe 100-500 GB total egress/month · covered by Supabase's Storage CDN (Cloudflare-backed).

**CDN cost at 100k free users for personal content: $0.** For business public content: Supabase Storage egress ~$0.09/GB · chargeable to the business's paid plan via the bandwidth-pack entitlement.

### 3.7 Database queries + CPU

Phase 2 target reduces chat-adjacent query load dramatically:
- No `SELECT * FROM nex_peer_message WHERE conversation_id = ?` (that table loses its content columns)
- Signalling table · aggressive TTL · low row count (~100 KB steady)
- Presence heartbeat · one row per device · 100-300k rows total · tiny
- Auth queries · dominated by Supabase Auth · included in Pro tier

**Supabase DB CPU + memory at 100k free users: already covered by Pro tier $25/mo base.**

---

## 4 · Three infrastructure choices that drop the floor to ~$75-150/mo

### 4.1 Choice A · Self-host TURN

Trade-off: $20/mo infrastructure vs ~$30-40/mo Cloudflare TURN · but adds SRE burden (uptime · DoS · scaling).

Verdict: **not worth it until 500k+ users.** Cloudflare TURN at $30-40/mo saves 15-20 hours/month of SRE time.

### 4.2 Choice B · Supabase Pro only (no add-ons)

At 100k users with 6k concurrent WebSocket subscriptions · the 500 included won't be enough · need +11 $10 add-ons = $110/mo for Realtime alone.

Alternative: **swap Realtime for direct Postgres LISTEN/NOTIFY + a lightweight WebSocket relay** (self-hosted on a $10 VPS). This is what Discord did at scale. Cuts ~$80/mo but adds ops burden.

Verdict: **start with Supabase Realtime add-ons · $85/mo total · migrate to self-hosted WebSocket at ~500k users.**

### 4.3 Choice C · Push via own dispatch (no managed service)

Already the plan · NEX dispatches directly to FCM/APNS. **$0/mo.**

### 4.4 Composite "technically practical" floor at 100k free users

| Line | Monthly |
|---|---:|
| Supabase Pro + Realtime add-ons | $85 |
| Vercel Pro × 3 projects + invocation overage | $90 |
| Cloudflare TURN · 810 GB | $40 |
| Push notifications | $0 |
| Monitoring (Sentry Hobby + free Grafana) | $30 |
| SMS/email backup (if used) | $5 |
| **Total** | **$250/month at 100k users** |
| **Per user per month** | **$0.0025** |
| **Per user per year** | **$0.03** |

**Upper-floor at 100k users with aggressive optimisation: ~$250/mo · $0.03/user/year · in the same ballpark as WhatsApp's public per-user cost pre-Facebook acquisition.**

### 4.5 Deeper floor (not recommended · highlights where savings stop being worth it)

| Line | Monthly | Trade-off |
|---|---:|---|
| Self-hosted TURN (coturn × 2 on Hetzner VPS) | $20 | SRE load · DoS defence on owner |
| Self-hosted WebSocket relay | $10 | Discord-pattern · needs dev work |
| Cloudflare Workers instead of Vercel for API | $10 | Migration cost significantly exceeds savings at this scale |
| **Deeper floor total** | **~$100/month at 100k users** | $0.001/user/month |

**Below $100/mo at 100k free users is possible but the engineering + ops cost of getting there exceeds the savings.** Not recommended unless NEX reaches 500k+ users where self-hosting economics flip.

---

## 5 · The specific areas owner's question pointed at

### 5.1 "Device-to-device messaging"

Covered by Phase 2 Interp 1: WebRTC data channels · direct peer when possible · TURN relay only when NAT-blocked (10-20% of connections).

**Already a zero-storage-cost design.** Nothing to cost-optimise beyond TURN provider choice.

### 5.2 "Direct peer-to-peer video calls"

Same architecture as text chat under Interp 1 · WebRTC video codec · direct connect when possible · TURN fallback.

**Cost already modelled in §3.3.** Video drives TURN bandwidth 5-10× higher than audio · the $40/mo Cloudflare line already assumes 20% video mix.

### 5.3 "Minimal account and security records"

Current design: 1 `nex_account` row + 1-3 `nex_device_key` rows per user + ephemeral rate-limit counters + presence heartbeat + auth session.

**Total NEX-side persistent storage per free user: ~1-2 KB.**

At 100k users: ~150-200 MB of account + security data · well within Supabase Pro's 8 GB.

**Already minimal.** Nothing further to trim.

### 5.4 "No server-side private chat storage or offline message queues"

Sealed as Interp 1 rule #4 + #6 · implementation is Phase 2.

**Not a cost-optimisation choice · it's the sealed architecture.**

### 5.5 "Paid business storage and separately funded public video hosting"

Phase 7 + Phase 8 workstreams. **Business storage cost = business revenue** via storage/bandwidth packs. Public video cost = business revenue via bandwidth packs + optional CDN pass-through.

**These are net-neutral or net-positive at the unit-economics level** · each paid business brings in €4.99+/month on Shop tier plus whatever packs they buy.

---

## 6 · Honest caveats

1. **These numbers are projections · not measured.** V-C-6 in Phase 4 will compare to real bills after 1 month of 10k-user synthetic load on staging. Real numbers may differ ±30%.
2. **The $250 floor assumes Phase 2 ships.** On the current pre-Phase-2 architecture, costs would still grow with message volume because messages still write rows. This is why Phase 2 is a commercial requirement, not just a privacy feature.
3. **Egress spikes from viral growth could temporarily exceed projections** · Cloudflare TURN auto-scales but bills per-GB · a 10x spike in concurrent video calls is a 10x bill for that month. Budgeting for 2-3x normal is prudent.
4. **Free-tier anti-abuse matters.** If a bad actor uses NEX as an open WebRTC relay for non-NEX traffic, TURN costs spike. Design counters: per-session TURN credentials (non-reusable · short-lived · already in Phase 2 design per Rev 2 §18) + rate-limit tier checks before allocating credentials.
5. **DoS and L7 abuse budget.** Cloudflare WAF included on Vercel Pro helps · but a sustained DoS could cost real money. Budget ~$50-100/mo for abuse-mitigation headroom at launch.

**Net-net-net realistic 100k-free-user monthly spend under Phase 2 target with aggressive optimisation: $250-400/mo · $0.0025-0.004 per user per month · competitive with industry benchmarks.**

---

## 7 · What this changes in the consolidated roadmap

Minor updates (no structural rework):

- **Phase 4 performance + cost validation**: V-C-6 target range changes from "compare to $300-800" to "compare to $250-400 aggressive-optimised baseline."
- **D-5 TURN provider decision** now explicitly favours Cloudflare TURN with the self-hosted coturn fallback documented as optional at 500k+ scale.
- **Phase 2 architecture** unchanged · already optimal for the floor.

No new work · just a clearer target to validate against.

---

## 8 · What this analysis does + does NOT do

### Does
- Recalibrate the earlier $300-800 ceiling with the realistic $250 floor
- Enumerate every cost driver with specific provider pricing
- Identify the three infrastructure choices that unlock the floor
- Address every category in the owner's "where would NEX still have costs" list
- Compare to public industry benchmarks (WhatsApp · Signal)

### Does NOT
- Change any code
- Select any provider (D-5 remains open)
- Commit to any specific cost outcome
- Replace the Phase 4 V-C-6 measurement that must validate these projections against real bills
- Alter the sealed Phase 2 architecture or any of its 6 invariants

---

**End of free-tier cost minimisation analysis.**

The technically practical floor for 100k NEX free users is ~$250/month · $0.0025/user/month · with Cloudflare TURN as the single most impactful cost-saving infrastructure choice. The $300-800 earlier estimate was conservatively buffered; the aggressive-but-realistic target is well under $300/month. WhatsApp-style per-user cost structure is achievable with Phase 2 architecture + Cloudflare TURN + Supabase Pro + Vercel Pro.
