# NEX Vault · trial-restart loophole · mitigation design

**Owner-authorised investigation** · 2026-11-07
**Status**: DESIGN ONLY · no implementation until owner picks an option
**Scope constraint**: no device fingerprinting, no personal-data tracking without separate approval

## The loophole · confirmed by audit

`vault-service.ts:41` · `activateVaultTrial(account)` checks `account.vault_trial_used_at` on the **current account only**. Zero cross-account signals. A user can:

1. Activate 7-day Vault trial
2. On day 7, delete account
3. Re-signup with any email
4. Activate trial again · loops indefinitely

Account deletion flow is not verified to wipe `vault_trial_used_at` (likely does, as part of cascading delete).

## Non-starters (per directive)

- Device fingerprinting (FingerprintJS · canvas/audio fingerprint · IP+UA hashing) — rejected · privacy concern · owner must approve separately
- IP tracking at account creation — rejected · GDPR Art. 6 would require legitimate-interest assessment
- Email matching on `+` aliases — low-signal · rejected as sole measure

## Mitigation options

Four options, trade-offs explicit. Owner picks one (or combination).

### Option A · Email-verified trial eligibility (weakest, simplest)

Add column: `nex_account.vault_trial_eligible_since TIMESTAMP`

Logic:
- Set at account creation
- Must be ≥ 30 days before trial can activate
- Deleting + re-signing up gives a fresh column on the new account but **the recipient address**-level check ...

Problem: email change loses the signal entirely. Weak.

### Option B · Phone-verified trial (stronger, higher friction)

Require phone verification BEFORE trial activation.
- NEX already has WhatsApp/SMS verification infra (per sealed `Shop Standard` chat memory)
- New column: `nex_phone_vault_trial_used(phone_hash, used_at)` · hash the phone number with pepper · 1 trial per phone number globally
- Phone numbers are harder to churn than emails

Trade-off: adds signup friction for all Vault trial users · blocks some users who don't have a phone handy
Privacy: SHA-256 with pepper is pseudonymous · under GDPR it's still personal data but minimal · needs DPO review

### Option C · Payment method required for trial (strongest, most friction)

Require card-on-file before Vault trial activation (not charged).
- Stripe Setup Intent (no charge, just payment method capture)
- Stripe enforces 1 card can't be used for repeat trials on same product
- Zero data NEX stores · Stripe handles the dedup

Trade-off: high friction · will suppress trial signups · but trials that do fire are high-quality leads
Risk: if you already offer €9.99/mo Vault as standalone, the trial becomes less useful · why trial when you can just subscribe?

### Option D · Remove the trial entirely

Vault is €9.99/mo from day 1. No trial. No loophole.
- Simplest. Zero code changes beyond deleting the trial activation path.
- Commercial impact: lower Vault conversion funnel · but also no loophole + no abuse path
- Aligns with the owner directive that Vault is "a standalone proposed product price pending final owner confirmation"

## Recommendation ladder

1. **Simplest · ship now**: **Option D** · remove the trial entirely while launching Vault. Revisit trial design after Vault has a stable paid base.
2. **Second**: **Option B** · phone-verified trial, but requires DPO review of the phone-hash storage.
3. **Weak**: **Option A** · email-eligibility window, provides minor friction only.
4. **High-friction**: **Option C** · card-on-file trial, best anti-abuse but suppresses funnel.

## Acceptance criteria for picked option

Whatever option is selected, the implementation must:
- Not introduce device fingerprinting
- Not log IP at account creation without GDPR assessment
- Not retain phone numbers in plaintext (hash + pepper if B)
- Document the mitigation in customer-facing privacy copy
- Be reversible (feature-flagged · owner can disable if it suppresses legitimate signups too hard)

## What this design does NOT do

- Fingerprint devices
- Log IPs
- Track user behaviour across accounts
- Store personal data beyond what's already in nex_account

## Owner decision needed

- [ ] A · email eligibility window
- [ ] B · phone-verified trial
- [ ] C · payment method required for trial
- [ ] D · remove trial entirely
- [ ] Combination (please specify)
- [ ] Hold · revisit when Vault has usage data
