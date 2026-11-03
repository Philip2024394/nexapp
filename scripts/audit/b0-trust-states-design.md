# Trust-state design · corrections 5 + 6

Owner-authorised 2026-11-03 (local design artefact only · no code shipped).

Supersedes section 5 of the earlier blueprint. Fixes two issues:

1. **A new device for an existing contact must not be treated the same as an existing device's key changing.** The previous design folded both into a single "CHANGED" state, which hid a meaningful distinction (adding a legitimate second device vs. an existing device suddenly presenting a different key).
2. **The user-facing copy must not rely on unsupported statistical claims or sweeping comparisons to other apps.** Trust claims should describe actual NEX behaviour.

## Four distinct trust states

Each contact's trust record is stored device-local in IndexedDB under `nex-native-crypto` → `trusted_contacts` (keyed by contact's account_id). The record carries:

```ts
type TrustedContact = {
  contact_account_id: string;
  verified_at: string | null;           // ISO timestamp OR null
  last_safety_number: string | null;    // 60-digit code at last verify
  known_devices: Array<{
    device_id: string;
    public_key_fingerprint: string;     // sha-256 of public_key, truncated
    first_seen_at: string;              // when we first saw this device
    verified: boolean;                  // was THIS device confirmed out of band
  }>;
};
```

### State · UNVERIFIED

| | |
|---|---|
| Trigger | First contact · we accepted the keys the server returned without out-of-band confirmation |
| UI badge | None (small ⓘ info line on contact profile only) |
| Send behaviour | Allowed · no banner |
| Risk statement shown on profile | *"The encryption keys for this contact haven't been verified. To raise the bar for sensitive conversations, read the safety number aloud with the other person over a different channel (voice, in person) and tap Verify."* |

### State · VERIFIED

| | |
|---|---|
| Trigger | User tapped Verify after reading the safety number aloud + confirming match |
| UI badge | Small ✓ next to contact's display name in the chat header |
| Send behaviour | Allowed · verified indicator persistent |
| What invalidates it | ANY change to the device list (new device, revoked device, replaced key) · reverts to a review state (NEW DEVICE or CHANGED) · requires re-verification to return to VERIFIED |

### State · NEW DEVICE

| | |
|---|---|
| Trigger | Server returned a device_id NEVER seen before for this contact · the account itself may be VERIFIED but this specific device is new |
| UI treatment | **Blue in-chat notice**: *"[Contact] has a new device · likely a new phone or laptop. If you're expecting this, it's fine. If not, verify with them in person before sending anything sensitive. [Verify safety numbers] [Dismiss]"* |
| Send behaviour | Allowed (not blocked), notice persists until user actions it |
| Priority | **Lower urgency than CHANGED** · adding a legitimate second device is a common user action |
| Resolution | User taps Verify + reads new safety number + confirms match → device gets `verified: true` + the contact-level `last_safety_number` updates; OR user dismisses the notice → device stays `verified: false` in trust record, future sends go to it anyway |

### State · CHANGED

| | |
|---|---|
| Trigger | Server returned a DIFFERENT public_key for a device_id we've seen before. The device fingerprint we remember no longer matches. |
| UI treatment | **Amber in-chat warning** (not blue · more urgent): *"[Contact]'s device key has changed. This happens if they rotated their keys or reinstalled the app · it also happens if someone has interfered with the connection. Verify with them before sending anything sensitive. [Verify safety numbers] [Dismiss]"* |
| Send behaviour | **NOT blocked by default** (owner can tighten later), but the warning is more prominent than NEW DEVICE |
| Priority | **Higher urgency than NEW DEVICE** · a known device changing its key is less common than a user adding a new one |
| Resolution | Same as NEW DEVICE: Verify to re-establish trust, or Dismiss to accept with warning |

## Important rules

1. **A new device never silently inherits verification from an existing device.** If the user has VERIFIED Bob's phone and Bob adds a laptop, the laptop appears as NEW DEVICE and must be re-verified independently.
2. **A verified contact does not stay verified after a device-list change.** The chat header's ✓ badge disappears whenever a new device appears OR an existing device changes its key, until the user re-verifies.
3. **Dismissing a notice does not mark the device as verified.** It only suppresses the notice banner · the trust record keeps `verified: false` for that device.
4. **Server-side action cannot upgrade trust.** Only an explicit user tap on Verify sets `verified: true` for a device.

## Honest safety-number explanation (user-facing copy)

Draft copy for the "What does Verified mean?" help panel. No unsupported statistical claims. No comparisons to other apps. Describes NEX behaviour directly.

> **About message privacy on NEX**
>
> Every message you send through NEX is encrypted on your device before it leaves. Only the recipient's devices can read it. NEX cannot read your messages.
>
> **For encryption to protect you, the keys your device uses to encrypt a message need to belong to the real person you're talking to.** The first time you contact someone, we accept the keys their devices give us. From then on, we remember those keys and warn you if they change.
>
> **"Verifying" a contact means confirming out of band that the keys we remember match what the other person's device also has.** You and the other person each read a 60-digit safety number aloud over a different channel · phone call, in person, voice note on another service. If the numbers match, tap Verify. From then on, NEX will tell you if the keys ever change.
>
> **An unverified contact is still encrypted · it just hasn't been independently confirmed.** For casual conversations this is usually fine. For sensitive conversations (financial, legal, confidential), take a minute to verify.
>
> **What NEX cannot protect against**
>
> - A device you've never seen before silently added to a contact: we warn you (NEW DEVICE notice).
> - A known device suddenly presenting different keys: we warn you (CHANGED notice).
> - Someone with access to your unlocked device: outside our control.
> - A browser extension or app on your device reading what's displayed: outside our control.
> - A compromised server at the very first moment of contact · we cannot retroactively tell if the first keys we received were legitimate · verification raises the bar from "trusts the server" to "I confirmed with the other person directly".
>
> If you lose all your trusted devices and haven't exported a backup, your chat history is gone. We don't keep a copy that could decrypt your messages.

## What this does NOT yet implement

- Automatic contact-level badge downgrade when ANY member device changes (needs client wiring in a future stage · B6)
- Push warning when a key change happens while the app is closed (needs a separate design)
- Multi-user group chat trust (NEX today is 1:1 · group chat is out of Option 2 scope)
- Hardware-backed key storage (WebAuthn · secure enclave) · browser-based for Option 2

## Owner decisions still open

1. **Should CHANGED block sending until re-verified** instead of "allow with warning"? The default proposed here is "allow with warning" (lower friction) · tightening to "block" would be more conservative.
2. **Should the Verified badge persist after a NEW DEVICE** if the contact-level `last_safety_number` is derived from the FULL device set? If a new device is added without re-verification, the safety number changes · we must either (a) show "no longer verified" or (b) keep showing ✓ while the new device is pending verification. Default proposed here: (a) · badge disappears.
3. **How many days before a dismissed-but-unverified NEW DEVICE re-surfaces the notice?** Default proposed: 14 days. The notice reappears so users can't permanently silence a warning they didn't actually resolve.
