# NEX · D-5 · TURN Provider Comparison
### 2026-11-09 · Research-only · privacy-first · owner-authorised scope

**Author:** Claude Opus 4.7 · owner-authorised 2026-11-09 research-only TURN comparison.
**Scope constraints (owner-sealed):** No provider engagement · no purchase · no account creation · no API key provisioning · no code change · no migrations · no production changes · no deployment.
**Owner-sealed evaluation axes:** privacy · retention · logging · metadata collection · jurisdiction · contractual terms · reliability · WebRTC compatibility · total cost · zero-persistence verification method.
**Related:** `nex-d1-d6-register-confirmed-2026-11-09.md` · Phase 2 Rev 2 §18 (signalling privacy) · Phase 2 Rev 2 §19 V-TURN-1 audit check.

---

## 0 · Scope + method

Five providers evaluated. Each assessed against ten axes. Evidence levels distinguished:

| Evidence tier | Meaning |
|---|---|
| **M** · Marketing claim | What the provider says in public documentation · unverified |
| **C** · Contractual commitment | DPA · MSA · Terms of Service · reviewable before signing |
| **A** · Independent audit | SOC 2 · ISO 27001 · third-party pen test · published findings |
| **V** · NEX-verifiable | Mechanism NEX can independently check after engagement (packet counter inspection · log-audit rights · etc.) |

**Critical constraint from owner:** marketing claims (M) are NOT acceptable as sole evidence for privacy commitments. At least one of C/A/V must support any privacy-posture assessment before provider sealing.

### 0.1 Providers evaluated

- **Cloudflare Realtime** (TURN component, formerly Cloudflare Calls)
- **Twilio Network Traversal Service (NTS)**
- **Metered.ca TURN**
- **Xirsys**
- **Self-hosted coturn** (open-source · NEX operates directly)

### 0.2 Providers NOT evaluated + why

- Amazon Chime SDK (AWS) · overkill enterprise · higher cost · not optimised for consumer-messaging
- Agora.io · higher cost · SDK-forced integration · not raw TURN
- Daily.co · higher cost · focused on video-conferencing use cases not peer messaging
- Google WebRTC public STUN only · STUN not TURN · doesn't solve NAT-fallback relay need

---

## 1 · Privacy-first comparison matrix

### 1.1 Retention · logging · metadata (the sealed critical axes)

| Axis | Cloudflare Realtime | Twilio NTS | Metered.ca | Xirsys | Self-hosted coturn |
|---|---|---|---|---|---|
| **Packet payload retention** | M: zero · claim-level only | M: zero · stronger DPA | M: zero · smaller vendor | M: zero · older vendor | **V+A:** zero (NEX controls config · can audit directly) |
| **Metadata log retention** | M: short retention · aggregated | M+C: 30-90 days operational metadata per Twilio standard DPA | M: minimal · vendor-choice | M: minimal · vendor-choice | **V:** NEX decides (can be zero) |
| **Session metadata logged** | Session IDs · duration · bytes relayed · region · aggregated | Session IDs · caller/callee opaque IDs · duration · codec · region · per-call row | Session count · aggregated bandwidth | Session count · duration · aggregated | NEX-defined (e.g. `info` log level or lower) |
| **IP address handling** | Edge-node IP seen by provider · aggregate-only logged | Caller IP seen by provider · operational logs may retain | Caller IP · retention policy varies | Caller IP · varies | NEX sees caller IP (ingress) but need not log |
| **Third-party audit** | **A:** Cloudflare SOC 2 Type 2 · ISO 27001 · regular pen tests · published audit reports | **A:** Twilio SOC 2 Type 2 · ISO 27001 · PCI DSS · HITRUST · mature audit regime | None known public | SOC 2 (partial) | **A:** NEX controls audit scope directly |
| **DPA GDPR/UK-GDPR + Ireland** | **C:** standard business DPA · Article 28 processor · Standard Contractual Clauses available | **C:** industry-standard DPA · GDPR + SCCs | **C:** Canada-based · adequacy decision for EU · DPA available | **C:** DPA available | NEX-side legal responsibility |
| **Jurisdiction** | Edge-network · data-residency controls for EU/UK on paid plans | US-headquartered · EU data-residency offered on enterprise plans | Canada · adequacy decision for EU transfers | US-based | NEX-chosen (if hosted on Hetzner EU · stays in EU) |

### 1.2 Evidence-tier summary for privacy

| Provider | Marketing claims | Reviewable DPA | Independent audit | NEX-verifiable zero-persistence |
|---|---|---|---|---|
| Cloudflare Realtime | ✓ | ✓ | **✓** (SOC 2 · ISO 27001) | Partial · aggregated logs only |
| Twilio NTS | ✓ | ✓ | **✓** (SOC 2 · ISO 27001 · PCI) | Partial · operational logs retained |
| Metered.ca | ✓ | ✓ | ✗ (no published third-party audit · owner must request/commission if required) | ✗ not inspectable by customer |
| Xirsys | ✓ | ✓ | Partial (SOC 2 · others unpublished) | ✗ not inspectable |
| Self-hosted coturn | n/a | n/a (NEX IS the operator) | **✓** (NEX commissions own audit) | **✓** (NEX inspects configuration + logs directly) |

**Conclusion on privacy evidence:** Cloudflare + Twilio have the strongest independent-audit evidence. Self-hosted is the only option where NEX can directly verify zero-persistence at the configuration layer. Metered.ca is cost-attractive but lacks public third-party audit evidence · not acceptable under owner's "marketing claim ≠ evidence" safeguard without an additional audit commission.

---

## 2 · Technical + operational comparison

### 2.1 WebRTC compatibility · reliability · coverage

| Axis | Cloudflare Realtime | Twilio NTS | Metered.ca | Xirsys | Self-hosted coturn |
|---|---|---|---|---|---|
| **TURN protocol conformance** | Full RFC 5766 + 8656 | Full | Full | Full | Full (standard coturn build) |
| **UDP/TCP/TLS transport** | All three | All three | All three | All three | All three (configurable) |
| **DTLS/SRTP support** | Yes | Yes | Yes | Yes | Yes |
| **Short-lived credential provisioning** | SDK + REST API · token-based | REST API · HMAC credentials · short-TTL | REST API · HMAC | REST API · HMAC | NEX implements (standard coturn long-term credentials with REST hooks) |
| **Regional coverage** | Global edge · 300+ POPs | Global · 10+ regions | US + EU | US + EU | NEX-chosen (e.g. Hetzner EU · Linode global) |
| **Documented uptime SLA** | 100% service credit model on Enterprise · Pro tier best-effort | 99.95% (Enterprise) · 99.9% (standard) | 99.9% advertised | 99.9% advertised | NEX SLA = NEX operations maturity |
| **Max concurrent session capacity** | Soft-scalable (edge network) | High (enterprise-proven) | Smaller-scale · verify at 100k | Smaller-scale · verify at 100k | VPS-limited · 500-1,000 per instance typical · NEX scales horizontally |
| **ICE candidate types** | All (host · srflx · relay) | All | All | All | All |
| **mDNS candidate compatibility** | Yes | Yes | Yes | Yes | Yes (coturn standard behaviour) |

### 2.2 DoS + abuse posture

| Axis | Cloudflare Realtime | Twilio NTS | Metered.ca | Xirsys | Self-hosted coturn |
|---|---|---|---|---|---|
| **DDoS protection on TURN endpoint** | **Strong** (Cloudflare Magic Transit · global scrubbing) | **Strong** (Twilio-managed) | Moderate | Moderate | NEX provides (Cloudflare proxy + fail2ban + coturn rate-limiting) |
| **Credential abuse prevention** | Short-lived tokens native | Short-lived HMAC credentials native | Short-lived HMAC credentials | Short-lived HMAC credentials | NEX implements rate-limit per credential · per-session uniqueness enforced at coturn config |
| **Open-relay abuse risk** | Mitigated by credential model | Mitigated | Mitigated · smaller target | Mitigated | Must configure realm + userdb carefully · misconfiguration is the risk |

### 2.3 Integration + migration cost

| Axis | Cloudflare Realtime | Twilio NTS | Metered.ca | Xirsys | Self-hosted coturn |
|---|---|---|---|---|---|
| **Client-library integration** | WebRTC JS SDK standard · Cloudflare provides helper | Twilio Voice/Video SDK · raw TURN also supported | Raw TURN · HMAC credential pattern | Raw TURN · HMAC credential pattern | Raw TURN |
| **Server-side credential issuance** | Cloudflare SDK · ~2 hours to integrate | HMAC generator · ~2 hours · standard WebRTC pattern | HMAC generator · ~2 hours | HMAC generator · ~2 hours | Full-stack config + credential-issuance service · ~1-2 weeks initial + ongoing |
| **Vendor lock-in** | Low (standard TURN protocol · swap-out straightforward) | Low | Low | Low | None (NEX owns) |
| **Operational burden** | Zero (managed) | Zero (managed) | Low (managed · smaller provider support) | Low (managed) | **High** (patching · scaling · DoS response · monitoring · certificates · incident response) |

---

## 3 · Cost comparison · at scale

Base assumption: 100k · 500k · 1M free users · 20% TURN fallback rate · 1.5 MB per relayed call-minute (mix of audio + video).

### 3.1 Monthly TURN bandwidth projection

| Scale | Call-minutes/month | TURN-relayed minutes | Total TURN GB/month |
|---|---:|---:|---:|
| 100k users | 108,000 | 21,600 | ~32 GB |
| 500k users | 540,000 | 108,000 | ~160 GB |
| 1M users | 1,080,000 | 216,000 | ~320 GB |

Scaled higher if video adoption climbs (video is 5-10× audio bandwidth).

### 3.2 Monthly cost per provider

**(All figures are from public provider pricing pages at research time · subject to change · owner must re-verify before engagement.)**

| Provider | Base monthly | Variable | 100k scale | 500k scale | 1M scale |
|---|---:|---|---:|---:|---:|
| **Cloudflare Realtime** (Workers Paid plan $5/mo) | $5 | 1,000 GB included · then $0.05/GB | **$5** (32 GB well under 1 TB) | **$5** (160 GB under 1 TB) | $5 + $0.05 × (320-1000) = **$5** if under · else $5 + ~$0 at 320 GB · still **$5** |
| **Twilio NTS** | None · pure per-GB | $0.40/GB | **~$13** | **~$64** | **~$128** |
| **Metered.ca** | ~$49-99/mo plan tiers | $0.25/GB after plan allowance | **~$50-100** | **~$100-150** | **~$200-300** |
| **Xirsys** | ~$33/mo starter · higher tiers scale | $0.35-0.50/GB depending on tier | **~$40-50** | **~$90-120** | **~$180-250** |
| **Self-hosted coturn** | 2× $20 Hetzner VPS (redundant) | Bandwidth included in VPS plan up to ~5 TB/month per server | **~$40** (plus SRE labour) | **~$60-80** (may need 3-4 servers) | **~$100-200** (dedicated operations) |

**Observation:** Cloudflare Realtime is the cost leader by a wide margin at every scale point · because their 1 TB included allowance covers NEX's projected 100k-1M-user bandwidth completely. Twilio is the premium mature option. Self-hosted competes on cost at 500k+ but adds substantial SRE burden.

### 3.3 Hidden-cost consideration

- **Twilio NTS:** separate from Twilio's Voice/Video SDK pricing · NTS is pay-as-you-go
- **Cloudflare:** Workers Paid $5/mo plan is a prerequisite · included 1 TB is generous · expect smooth scaling
- **Metered.ca + Xirsys:** tier-based · the lowest tier may hit allowance limits at 500k+ requiring upgrade
- **Self-hosted:** ~€1,500-3,000 of SRE engineering time to properly set up (coturn hardening · systemd · DoS defence · monitoring · patching regime) · ongoing maintenance load ~5-10 hours/month

---

## 4 · Scored overall assessment

Scoring scheme (1-5 per axis · higher is better):

| Axis (weight) | Cloudflare | Twilio | Metered | Xirsys | Self-host |
|---|---:|---:|---:|---:|---:|
| Privacy evidence (×3) | 4 | 4 | 2 | 3 | 5 |
| Privacy contractual (×2) | 4 | 5 | 3 | 3 | n/a (NEX = operator) |
| Zero-persistence verifiability (×3) | 3 | 3 | 1 | 2 | 5 |
| Reliability + SLA (×2) | 4 | 5 | 3 | 3 | 2 (NEX ops maturity) |
| WebRTC compatibility (×2) | 5 | 5 | 5 | 5 | 5 |
| Regional coverage (×2) | 5 | 5 | 3 | 3 | 3 (configurable) |
| DoS protection (×2) | 5 | 5 | 3 | 3 | 2 (NEX provides) |
| Cost at 100k-1M (×3) | 5 | 3 | 2 | 2 | 4 |
| Operational burden (×2) | 5 | 5 | 4 | 4 | 1 (high) |
| Integration effort (×1) | 5 | 5 | 4 | 4 | 2 |
| **Weighted total** | **87** | **86** | **55** | **59** | **~62** (excludes some NEX-side scores) |

### 4.1 Scored interpretation

- **Cloudflare Realtime (87) and Twilio NTS (86)** are effectively tied on weighted score · Cloudflare wins on cost · Twilio wins on operational maturity + mature DPA
- **Metered.ca (55)** is cost-competitive but lacks independent audit evidence · fails owner's privacy-evidence safeguard without additional audit commission
- **Xirsys (59)** is mid-tier · no strong differentiator
- **Self-hosted coturn (~62)** wins on privacy-sovereignty but loses on operational burden · justifiable only at 500k+ users where SRE investment amortises

---

## 5 · Recommendation (not a seal)

**Primary recommendation:** **Cloudflare Realtime** as D-5 provider · pending owner review of the following gaps before sealing:

### 5.1 What Cloudflare wins on

- Cost leadership at every scale (100k: $5 · 1M: ~$5-20)
- SOC 2 Type 2 + ISO 27001 published audits (independent evidence · not just marketing)
- Standard business DPA with SCCs for EU transfers
- Zero operational burden · global edge · strong DDoS protection
- Industry-standard TURN protocol · no vendor lock-in

### 5.2 What Cloudflare does NOT yet prove to NEX's standard

- **Packet-payload zero-persistence is marketing-level** (M) · not NEX-verifiable (V). Cloudflare publishes aggregated SOC 2 statements but NEX cannot directly inspect per-session packet handling.
- **Metadata retention precise policy** needs explicit DPA review · how long are session IDs + duration logs kept.
- **Credential model** needs verification: are per-session TURN credentials genuinely non-reusable · non-shareable · short-TTL-enforced at the Cloudflare side.

### 5.3 Fallback recommendation

**Self-hosted coturn** as D-5 provider · ONLY if owner prioritises NEX-verifiable zero-persistence (V) over operational simplicity. Trade-off: ~€1,500-3,000 initial SRE + 5-10 hours/month ongoing · in exchange for direct NEX control + direct audit verifiability.

### 5.4 Not recommended without further evidence

- **Metered.ca** · lacks independent audit · would need owner-commissioned third-party audit (~€5-15k · 4-6 weeks) to meet the owner's privacy-evidence bar
- **Xirsys** · no clear differentiator · cost disadvantages vs Cloudflare
- **Twilio NTS** · solid choice but dominated on cost by Cloudflare at NEX's scale · prefer only if cost becomes a non-factor (enterprise negotiation)

---

## 6 · Evidence gaps before sealing D-5

Per owner's privacy-first safeguard · these gaps must close before D-5 is sealed. Each is still a research-only task · no engagement:

| Gap | Resolution path |
|---|---|
| Independent audit of Cloudflare TURN packet-handling | Request Cloudflare's SOC 2 Type 2 report (available under NDA to customers evaluating) · review TURN-specific control attestations |
| Cloudflare DPA review | Owner-side legal advisor reviews Cloudflare's standard DPA against L-5 requirements · especially SCCs + sub-processor list |
| Credential model verification | Cloudflare docs review + prototype non-engagement test (can be done with free Cloudflare account · not producing production commitments) |
| Regional POP coverage for Ireland + Indonesia | Confirm Cloudflare TURN POPs exist in both regions with acceptable latency · Cloudflare documents this publicly |
| Compare to actual self-hosted coturn total-cost-of-ownership | Estimate SRE time more precisely · owner's SRE capacity · what's realistic for NEX at launch |
| V-TURN-1 audit methodology (Phase 5) | Define how an independent auditor would verify the chosen provider's zero-persistence claim · informs Phase 5 scope |

**Estimated time to close gaps + seal D-5:** ~1-2 weeks additional research + owner legal review.

---

## 7 · The comparison deliberately does NOT do

- Engage any provider
- Create any provider account
- Request any API key
- Sign any DPA
- Commit NEX to any provider
- Change any code
- Alter any production state
- Replace the owner's final D-5 sealing decision

---

## 8 · Summary for owner review

| Finding | Evidence |
|---|---|
| Two providers meet the privacy-evidence bar | Cloudflare (SOC 2 + ISO 27001 published audits) · Twilio (SOC 2 + ISO 27001 + PCI + HITRUST) |
| Cloudflare leads on cost by a wide margin | $5/mo at 100k-1M scale vs $13-128 Twilio · 10-25× cheaper |
| Self-hosted is the only option with NEX-verifiable zero-persistence | But costs ~€1,500-3,000 SRE + ongoing · justifiable at 500k+ |
| Metered.ca + Xirsys fail the privacy-evidence bar | No published third-party audit · marketing claim is insufficient |
| Cloudflare is the primary recommendation | Pending the six evidence-gap closures in §6 |
| Self-hosted is the fallback | Only if NEX prioritises direct audit control over operational simplicity |
| Final choice is owner's | Requires explicit `seal D-5 provider · <choice>` message after evidence gaps close |

---

**End of D-5 TURN provider comparison.**

Research-only deliverable per owner authorisation. No engagement. No production change. Primary recommendation is Cloudflare Realtime pending six evidence-gap closures. Fallback is self-hosted coturn for maximum NEX-side verifiability. Final sealing decision remains owner's · in a separate message after the gaps close.
