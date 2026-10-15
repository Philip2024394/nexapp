// src/lib/nex-native/__tests__/vault-lock-and-leave-recover.test.ts
//
// 2026-10-15 · deterministic regression suite for the shared Vault
// lock-and-leave header, its hook, and the recover-page integration.
//
// WHAT THIS SUITE PROVES vs DOES NOT PROVE
//   This test file is 100% source-structure (fs.readFileSync + regex).
//   It locks in the sealed invariants of the code pattern · the double-
//   click guard, the post-lock snapshot verification, the unmount
//   cleanup, the honest error state, the integration into recover.
//
//   It does NOT run React, does NOT render a browser, does NOT fire
//   actual click events against a mocked lockVault, and does NOT
//   observe real timer behaviour. A true behavioural test of the hook
//   would require @testing-library/react which this project's test
//   suite does not currently use. If browser verification is needed
//   as a separate step, Playwright can simulate: enter recover ·
//   click Home · observe overlay for 3s · observe navigation to
//   /nex-native/home · observe no Vault content exposed.
//
// Mirrors the test pattern established by vault-persistence.test.ts
// and vault-p1b-partial-move-preservation.test.ts.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const F = {
  shared: path.join(
    REPO_ROOT,
    "src/app/nex-native/vault/_lock-and-leave-header.tsx",
  ),
  recoverClient: path.join(
    REPO_ROOT,
    "src/app/nex-native/vault/recover/_recover-unlock-client.tsx",
  ),
  recoverPage: path.join(
    REPO_ROOT,
    "src/app/nex-native/vault/recover/page.tsx",
  ),
  // Sealed · must remain unchanged by this gate.
  setupClient: path.join(
    REPO_ROOT,
    "src/app/nex-native/vault/setup/_setup-client.tsx",
  ),
  shellHeader: path.join(
    REPO_ROOT,
    "src/app/nex-native/vault/_vault-shell-header.tsx",
  ),
  // Sealed primitives the hook reuses · must still be callable.
  unlockOrchestrator: path.join(
    REPO_ROOT,
    "src/lib/nex-native/vault/client/unlock-orchestrator.ts",
  ),
  lockSweep: path.join(
    REPO_ROOT,
    "src/lib/nex-native/vault/client/lock-sweep.ts",
  ),
  vaultSession: path.join(
    REPO_ROOT,
    "src/lib/nex-native/vault/client/vault-session.ts",
  ),
};

const src = {
  shared: fs.readFileSync(F.shared, "utf-8"),
  recoverClient: fs.readFileSync(F.recoverClient, "utf-8"),
  recoverPage: fs.readFileSync(F.recoverPage, "utf-8"),
  setupClient: fs.readFileSync(F.setupClient, "utf-8"),
  shellHeader: fs.readFileSync(F.shellHeader, "utf-8"),
  unlockOrchestrator: fs.readFileSync(F.unlockOrchestrator, "utf-8"),
  lockSweep: fs.readFileSync(F.lockSweep, "utf-8"),
  vaultSession: fs.readFileSync(F.vaultSession, "utf-8"),
};

// ─── A · shared file exports + sealed-primitive imports ─────────────

describe("A · shared lock-and-leave file · exports + sealed-primitive imports", () => {
  test("exports useLockAndLeave + VaultLockAndLeaveHeader + LockingVaultOverlay", () => {
    expect(src.shared).toMatch(/export function useLockAndLeave\(/);
    expect(src.shared).toMatch(/export function VaultLockAndLeaveHeader\(/);
    expect(src.shared).toMatch(/export function LockingVaultOverlay\(/);
  });

  test('is "use client" (uses React hooks + router + window.setTimeout)', () => {
    expect(src.shared.trimStart()).toMatch(/^"use client"/);
  });

  test("imports the sealed lockVault from unlock-orchestrator", () => {
    expect(src.shared).toMatch(
      /import \{[\s\S]+?lockVault,?[\s\S]+?\} from "@\/lib\/nex-native\/vault\/client\/unlock-orchestrator"/,
    );
  });

  test("imports the sealed lockVaultEverywhere from lock-sweep", () => {
    expect(src.shared).toMatch(
      /import \{\s*lockVaultEverywhere\s*\} from "@\/lib\/nex-native\/vault\/client\/lock-sweep"/,
    );
  });

  test("imports the sealed readVaultSessionSnapshot from vault-session", () => {
    expect(src.shared).toMatch(
      /import \{\s*readVaultSessionSnapshot\s*\} from "@\/lib\/nex-native\/vault\/client\/vault-session"/,
    );
  });

  test("does NOT re-implement any sealed lock primitive", () => {
    // The shared file must not define its own clearVmk / lockVault /
    // lockVaultEverywhere · it reuses the sealed primitives verbatim.
    expect(src.shared).not.toMatch(/function clearVmk\(/);
    expect(src.shared).not.toMatch(/function lockVault\(/);
    expect(src.shared).not.toMatch(/function lockVaultEverywhere\(/);
  });

  test("reuses existing sealed i18n keys (vault.setup.header.*, vault.setup.lockOverlay.*)", () => {
    for (const key of [
      "vault.setup.header.homeLabel",
      "vault.setup.header.lockIndicator",
      "vault.setup.header.settingsLabel",
      "vault.setup.lockOverlay.title",
      "vault.setup.lockOverlay.subtitle",
    ]) {
      expect(src.shared).toContain(key);
    }
  });
});

// ─── B · useLockAndLeave hook · sealed behavioural contract ─────────

describe("B · useLockAndLeave · double-click + verify + unmount cleanup", () => {
  test("has a double-click guard (activeRef) that gates re-entry", () => {
    expect(src.shared).toMatch(/activeRef = useRef\(false\)/);
    expect(src.shared).toMatch(/if \(activeRef\.current\) return;/);
  });

  test("calls lockVaultEverywhere() FIRST inside a try/catch", () => {
    // The sealed local lock must happen before anything else in the
    // trigger · verify the ordering.
    expect(src.shared).toMatch(
      /try \{\s*lockVaultEverywhere\(\);\s*\}[\s\S]+?catch \{[\s\S]+?local_lock_threw/,
    );
  });

  test("VERIFIES the post-lock snapshot before showing the overlay (owner safeguard)", () => {
    // The owner's rule: "the 1.6-second animation and three-second
    // navigation delay are not themselves proof that locking has
    // completed." The snapshot IS proof.
    expect(src.shared).toMatch(
      /const snap = readVaultSessionSnapshot\(\);\s*if \(snap\.unlocked\)/,
    );
    expect(src.shared).toMatch(/post_lock_still_unlocked/);
  });

  test("surfaces honest error states · never pretends locked when it is not", () => {
    // Both failure branches set state kind "error" and return BEFORE
    // showing the "locking" overlay.
    const trigger = src.shared.match(
      /const trigger = useCallback\([\s\S]+?\[destinationHref, router\]\)/,
    )?.[0] ?? "";
    // Error paths come before the setState({ kind: "locking" }).
    const lockingIdx = trigger.indexOf('setState({ kind: "locking" })');
    const errorPathIdx = trigger.indexOf('setState({ kind: "error"');
    expect(errorPathIdx).toBeGreaterThan(-1);
    expect(lockingIdx).toBeGreaterThan(errorPathIdx);
  });

  test("fires lockVault() fire-and-forget AFTER local lock + verify", () => {
    // The server POST happens only once we have confirmed locally
    // locked. It is best-effort · its result is intentionally
    // discarded with .catch(() => undefined).
    expect(src.shared).toMatch(
      /void lockVault\(\)\.catch\(\(\) => undefined\)/,
    );
  });

  test("navigation uses router.push with the destinationHref · 3-second delay", () => {
    expect(src.shared).toMatch(
      /navTimeoutRef\.current = setTimeout\(\(\) => \{[\s\S]+?router\.push\(destinationHref\);\s*\}, 3000\)/,
    );
  });

  test("unmount cleanup clears any pending navigation timeout", () => {
    // Prevents stale navigation after the user has moved on via
    // another route (e.g. back button).
    expect(src.shared).toMatch(
      /useEffect\(\(\) => \{\s*return \(\) => \{\s*if \(navTimeoutRef\.current !== null\) \{\s*clearTimeout\(navTimeoutRef\.current\);/,
    );
  });

  test("exposes a reset() the caller can wire to a Dismiss affordance", () => {
    expect(src.shared).toMatch(/const reset = useCallback\(/);
    expect(src.shared).toMatch(/activeRef\.current = false;\s*setState\(\{\s*kind:\s*"idle"\s*\}\)/);
  });

  test("the LockAndLeaveState union includes idle / locking / error", () => {
    expect(src.shared).toMatch(/kind:\s*"idle"/);
    expect(src.shared).toMatch(/kind:\s*"locking"/);
    expect(src.shared).toMatch(/kind:\s*"error";[\s\S]+?reason:/);
  });
});

// ─── C · overlay + header · ARIA + no bypass ────────────────────────

describe("C · overlay + header · accessible + Home is a button not a link", () => {
  test("LockingVaultOverlay has role=status + aria-live=polite", () => {
    expect(src.shared).toMatch(
      /data-nex-vault-locking-overlay[\s\S]+?role="status"[\s\S]+?aria-live="polite"/,
    );
  });

  test("header Home control is a <button>, NOT a <Link>", () => {
    // A Link would bypass the lock-and-leave hook. Home MUST be a
    // button that invokes onHome which the caller wires to
    // lockAndLeave.trigger.
    const header = src.shared.match(
      /export function VaultLockAndLeaveHeader\([\s\S]+?return \([\s\S]+?\n\}/,
    )?.[0] ?? "";
    expect(header).not.toMatch(/<Link /);
    expect(header).toMatch(/<HeaderIcon\s+onClick=\{onHome\}/);
  });

  test("header does NOT import next/link", () => {
    expect(src.shared).not.toMatch(/from "next\/link"/);
  });

  test("overlay still uses the sealed cyan secure palette (visual continuity with setup)", () => {
    expect(src.shared).toMatch(/NEX_PALETTE\.secure/);
    expect(src.shared).toMatch(/NEX_PALETTE\.textPrimary/);
  });
});

// ─── D · recover client integration ─────────────────────────────────

describe("D · recover client uses the shared lock-and-leave on both branches", () => {
  test("imports useLockAndLeave + VaultLockAndLeaveHeader + LockingVaultOverlay", () => {
    expect(src.recoverClient).toMatch(
      /import \{[\s\S]+?useLockAndLeave,[\s\S]+?VaultLockAndLeaveHeader,[\s\S]+?LockingVaultOverlay,[\s\S]+?\} from "\.\.\/_lock-and-leave-header"/,
    );
  });

  test("instantiates useLockAndLeave with destination /nex-native/home", () => {
    expect(src.recoverClient).toMatch(
      /useLockAndLeave\("\/nex-native\/home"\)/,
    );
  });

  test("renders VaultLockAndLeaveHeader with onHome bound to lockAndLeave.trigger (recoveryConfigured branch)", () => {
    expect(src.recoverClient).toMatch(
      /data-nex-vault-recover[\s\S]+?<VaultLockAndLeaveHeader[\s\S]+?onHome=\{lockAndLeave\.trigger\}/,
    );
  });

  test("renders VaultLockAndLeaveHeader on the recovery-not-configured branch too", () => {
    expect(src.recoverClient).toMatch(
      /data-nex-vault-recover-missing[\s\S]+?<VaultLockAndLeaveHeader[\s\S]+?onHome=\{lockAndLeave\.trigger\}/,
    );
  });

  test("renders LockingVaultOverlay only while state is 'locking'", () => {
    const occurrences = src.recoverClient.match(
      /lockAndLeave\.state\.kind === "locking" \? <LockingVaultOverlay/g,
    );
    expect(occurrences?.length ?? 0).toBe(2); // once per branch
  });

  test("renders an honest error banner (role=alert) when state is 'error'", () => {
    expect(src.recoverClient).toMatch(
      /function LockAndLeaveErrorBanner\([\s\S]+?role="alert"[\s\S]+?aria-live="assertive"/,
    );
    // The banner must only render when state is "error" · no false
    // positive on idle or locking.
    expect(src.recoverClient).toMatch(
      /if \(state\.kind !== "error"\) return null/,
    );
  });

  test("error banner does NOT falsely claim the Vault is secure (text + reason tag)", () => {
    // Positive: the banner carries an honest "we failed" message.
    expect(src.recoverClient).toMatch(/Could not lock Vault cleanly/);
    // Reason tag is exposed via data-* for test / telemetry inspection.
    expect(src.recoverClient).toContain(
      "data-nex-vault-recover-lock-error={state.reason}",
    );
    // No false success claims. Patterns are specific enough to avoid
    // false-positives on legitimate uses like "lock-and-leave",
    // "lockVault(call)", or the "LockingVaultOverlay" component name.
    expect(src.recoverClient).not.toMatch(
      /is\s+(now\s+)?locked\b|successfully\s+locked|is\s+secure|now\s+secure|is\s+safe/i,
    );
  });

  test("removes the duplicate inline brand chip from both branches", () => {
    expect(src.recoverClient).not.toContain("data-nex-vault-brand");
    expect(src.recoverClient).not.toContain("brandStyle(skin)");
  });

  test("recovery form state and sealed security flow are UNCHANGED", () => {
    // The recovery passphrase submission must still go through the
    // sealed unlockWithRecovery service · we do not want to find a
    // reimplementation or a bypass.
    expect(src.recoverClient).toMatch(/unlockWithRecovery\(\{ passphrase \}\)/);
    expect(src.recoverClient).toMatch(/PASSPHRASE_MIN_LENGTH/);
    expect(src.recoverClient).toContain("rateLimited");
    expect(src.recoverClient).toContain("recovery_not_configured");
    expect(src.recoverClient).toContain("wrong_passphrase");
  });

  test("'Back to PIN unlock' / 'Back to Vault' affordances still link to /vault entry (unchanged)", () => {
    const matches = src.recoverClient.match(
      /router\.push\("\/nex-native\/vault"\)/g,
    );
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

// ─── E · recover PAGE sealed guards unchanged ───────────────────────

describe("E · recover page.tsx · sealed server guards unchanged", () => {
  test("still requires authenticated session · redirects otherwise", () => {
    expect(src.recoverPage).toMatch(
      /if \(!session\)[\s\S]+?redirect\("\/nex-native\/sign-in\?next=\/nex-native\/vault\/recover"\)/,
    );
  });

  test("still queries nex_vault_setup for recovery_configured_at", () => {
    expect(src.recoverPage).toMatch(/\.from\("nex_vault_setup"\)/);
    expect(src.recoverPage).toMatch(/recovery_configured_at/);
  });

  test("still passes recoveryConfigured prop to the client (no bypass)", () => {
    expect(src.recoverPage).toMatch(/recoveryConfigured=\{recoveryConfigured\}/);
  });

  test("page is server-side force-dynamic · no cached auth state", () => {
    expect(src.recoverPage).toMatch(/export const dynamic = "force-dynamic"/);
  });
});

// ─── G · Fix A + B + C · recovery-race defences (2026-10-15) ────────
//
// Owner-authorised race-defence pass covering three concurrent paths
// where a late-arriving VMK installation could expose unlocked Vault
// content after the user has pressed Home:
//   Fix A · just-before-navigation defensive re-lock + verify
//   Fix B · conditional unmount cleanup (ONLY when activeRef = true)
//   Fix C · recover handler clears VMK when Home is in-flight and
//           skips the vault/home navigation
//
// IMPORTANT · these are source-structure tests. They lock in the code
// pattern that implements the defences. They do NOT prove browser
// timing behaviour · a Playwright pass against an authenticated
// account with a configured recovery passphrase would be required to
// exercise the actual race.

describe("G · Fix A · defensive re-lock just before navigation", () => {
  test("setTimeout callback fires lockVaultEverywhere() before router.push", () => {
    expect(src.shared).toMatch(
      /navTimeoutRef\.current = setTimeout\(\(\) => \{[\s\S]+?lockVaultEverywhere\(\);[\s\S]+?router\.push\(destinationHref\);[\s\S]+?\}, 3000\)/,
    );
  });

  test("setTimeout callback wraps lockVaultEverywhere() in try/catch and HONESTLY surfaces failure", () => {
    expect(src.shared).toMatch(
      /navTimeoutRef\.current = setTimeout\([\s\S]+?try \{\s*lockVaultEverywhere\(\);\s*\}\s*catch \{[\s\S]+?setState\(\{\s*kind:\s*"error",\s*reason:\s*"local_lock_threw"[\s\S]+?return;[\s\S]+?\}, 3000\)/,
    );
  });

  test("setTimeout callback re-verifies readVaultSessionSnapshot before navigating", () => {
    expect(src.shared).toMatch(
      /navTimeoutRef\.current = setTimeout\([\s\S]+?const snap = readVaultSessionSnapshot\(\);\s*if \(snap\.unlocked\) \{[\s\S]+?setState\(\{\s*kind:\s*"error",\s*reason:\s*"post_lock_still_unlocked"[\s\S]+?return;[\s\S]+?\}, 3000\)/,
    );
  });

  test("activeRef is NO LONGER cleared on error paths (sticky · Option α correction)", () => {
    // Option α 2026-10-15 · activeRef is intentionally sticky through
    // error states so Fix C's isActive() guard fires even when the
    // hook couldn't complete the lock-and-leave cleanly. The timer
    // block's error branches must NOT contain `activeRef.current =
    // false` · the stickiness is enforced by test H as well.
    const timerBlock =
      src.shared.match(
        /navTimeoutRef\.current = setTimeout\([\s\S]+?\}, 3000\)/,
      )?.[0] ?? "";
    const clearedRefs = timerBlock.match(/activeRef\.current = false/g);
    expect(clearedRefs?.length ?? 0).toBe(0);
    // The error states themselves ARE still set · just without
    // touching activeRef.
    expect(timerBlock).toMatch(
      /setState\(\{\s*kind:\s*"error",\s*reason:\s*"local_lock_threw"/,
    );
    expect(timerBlock).toMatch(
      /setState\(\{\s*kind:\s*"error",\s*reason:\s*"post_lock_still_unlocked"/,
    );
  });
});

describe("G · Fix B · unmount cleanup is CONDITIONAL on an active operation", () => {
  test("unmount cleanup gates the defensive lock on activeRef.current (NOT unconditional)", () => {
    expect(src.shared).toMatch(
      /useEffect\(\(\) => \{\s*return \(\) => \{[\s\S]+?clearTimeout\(navTimeoutRef\.current\);[\s\S]+?if \(activeRef\.current\) \{\s*try \{\s*lockVaultEverywhere\(\);/,
    );
  });

  test("unmount cleanup still clears any pending navigation timeout unconditionally", () => {
    expect(src.shared).toMatch(
      /return \(\) => \{\s*if \(navTimeoutRef\.current !== null\) \{\s*clearTimeout\(navTimeoutRef\.current\);\s*navTimeoutRef\.current = null;\s*\}/,
    );
  });

  test("defensive lock is wrapped in try/catch (best-effort during cleanup)", () => {
    expect(src.shared).toMatch(
      /if \(activeRef\.current\) \{\s*try \{\s*lockVaultEverywhere\(\);\s*\}\s*catch \{/,
    );
  });
});

describe("G · Fix C · recover handler respects Home mid-recovery", () => {
  test("recover client imports lockVaultEverywhere for the defensive clear", () => {
    expect(src.recoverClient).toMatch(
      /import \{\s*lockVaultEverywhere\s*\} from "@\/lib\/nex-native\/vault\/client\/lock-sweep"/,
    );
  });

  test("onSubmit uses lockAndLeave.isActive() (NOT state.kind) AFTER unlockWithRecovery returns", () => {
    // Option α (2026-10-15) · the guard now reads the imperative
    // ref-based `isActive()` instead of the render-time `state.kind`.
    // This closes the stale-closure defect the pre-commit review
    // identified: a Home activation that fires DURING the await would
    // not propagate into the stale `state` captured in the running
    // onSubmit's closure.
    expect(src.recoverClient).toMatch(
      /const result = await unlockWithRecovery\(\{ passphrase \}\);[\s\S]+?if \(lockAndLeave\.isActive\(\)\) \{[\s\S]+?lockVaultEverywhere\(\);[\s\S]+?return;/,
    );
    // The stale closure read MUST be gone.
    expect(src.recoverClient).not.toMatch(
      /if \(lockAndLeave\.state\.kind !== "idle"\)/,
    );
  });

  test("the guard fires BEFORE the result.ok router.push to /vault/home", () => {
    const onSubmitBlock =
      src.recoverClient.match(
        /async function onSubmit\([\s\S]+?setBusy\(false\);\s*\}/,
      )?.[0] ?? "";
    const guardIdx = onSubmitBlock.indexOf("lockAndLeave.isActive()");
    const pushIdx = onSubmitBlock.indexOf('"/nex-native/vault/home"');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(pushIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(pushIdx);
  });

  test("guard covers BOTH success and failure outcomes · isActive() reads sticky activeRef", () => {
    // The hook's activeRef is sticky through error states (owner-
    // authorised 2026-10-15 Option α). isActive() reads this ref so
    // the guard fires for either the "locking" or "error" state ·
    // AND for a late recovery completion AFTER unmount, since the
    // ref persists in the hook instance's closure.
    expect(src.recoverClient).toMatch(/lockAndLeave\.isActive\(\)/);
  });

  test("existing recovery error paths preserved (wrong_passphrase, rateLimited)", () => {
    // The error string literals the client inspects on the result
    // object (snake_case error codes from the sealed service).
    expect(src.recoverClient).toContain('"wrong_passphrase"');
    expect(src.recoverClient).toContain('"recovery_not_configured"');
    // The client reads `result.rateLimited` (camelCase property on the
    // RecoveryUnlockResult shape) · verify both the property check
    // and the setRateLimited call are intact.
    expect(src.recoverClient).toMatch(/if \(result\.rateLimited\)/);
    expect(src.recoverClient).toMatch(
      /setRateLimited\(\{ retryAfterSeconds: result\.retryAfterSeconds \?\? 86400 \}\)/,
    );
  });

  test("existing busy-state behaviour preserved (setBusy(true) still fires at start)", () => {
    expect(src.recoverClient).toMatch(
      /async function onSubmit\([^)]+\)\s*\{[\s\S]+?setBusy\(true\);[\s\S]+?setError\(null\);/,
    );
  });

  test("the Fix C guard does NOT setBusy(false) · hook navigation takes over the UI", () => {
    const guardBlock =
      src.recoverClient.match(
        /if \(lockAndLeave\.state\.kind !== "idle"\) \{[\s\S]+?return;\s*\}/,
      )?.[0] ?? "";
    expect(guardBlock).not.toMatch(/setBusy\(false\)/);
  });
});

// ─── H · Option α · stale-closure fix for Fix C ─────────────────────
//
// Owner-authorised 2026-10-15 (Option α). Addresses the pre-commit-
// review finding that Fix C's `lockAndLeave.state.kind !== "idle"`
// check reads from the stale render-time closure captured by the
// recover client's onSubmit, so a Home activation that fires DURING
// the `await unlockWithRecovery(...)` would be missed.
//
// IMPORTANT · all tests here remain source-structure. They lock in the
// shape of the fix (isActive exported, used by the recover client,
// activeRef made sticky through error states) but do NOT exercise the
// React closure semantics at runtime. The project's test suite does
// not depend on @testing-library/react or any renderer; adding one
// would be scope expansion the owner has not approved. True
// behavioural proof of the race-closing property requires a Playwright
// pass against an authenticated account with configured recovery.

describe("H · Option α · isActive() reader + sticky activeRef", () => {
  test("useLockAndLeave return TYPE includes isActive: () => boolean", () => {
    expect(src.shared).toMatch(
      /export function useLockAndLeave\(destinationHref: string\)[\s\S]+?isActive:\s*\(\)\s*=>\s*boolean[\s\S]+?\}\s*\{/,
    );
  });

  test("useLockAndLeave RETURNS isActive alongside state/trigger/reset", () => {
    expect(src.shared).toMatch(
      /return \{\s*state,\s*trigger,\s*reset,\s*isActive\s*\}/,
    );
  });

  test("isActive is a useCallback reading activeRef.current (no deps, no stale closure)", () => {
    // The empty dep array keeps the function reference stable AND
    // reads the ref's current value at call time. If a future refactor
    // introduces deps or copies activeRef.current into state, the
    // stale-closure defect returns.
    expect(src.shared).toMatch(
      /const isActive = useCallback\(\(\) => activeRef\.current,\s*\[\]\)/,
    );
  });

  test("activeRef is NOT reset to false in any error branch (sticky semantics)", () => {
    // The hook body between the trigger declaration and the return
    // must contain exactly TWO `activeRef.current = …` assignments:
    //   · `activeRef.current = true;` inside trigger (set-on-entry)
    //   · `activeRef.current = false;` inside reset() (explicit reset)
    // Any additional assignment to `activeRef.current = false` would
    // undo the stickiness and re-open the Fix C race.
    const assignments = src.shared.match(/activeRef\.current\s*=\s*(true|false)/g) ?? [];
    expect(assignments).toContain("activeRef.current = true");
    const falseAssignments = assignments.filter((s) => /= false/.test(s));
    expect(falseAssignments.length).toBe(1); // ONLY the one in reset()
  });

  test("reset() is still the single clear path for activeRef", () => {
    expect(src.shared).toMatch(
      /const reset = useCallback\(\(\) => \{[\s\S]+?activeRef\.current = false;[\s\S]+?setState\(\{\s*kind:\s*"idle"\s*\}\)/,
    );
  });

  test("JSDoc explains the stale-closure contract and the sticky semantics", () => {
    expect(src.shared).toMatch(/stale-closure-safe reader/i);
    expect(src.shared).toMatch(/STICKY through error states/);
  });

  test("Fix A error branches still setState('error') · just no longer reset activeRef", () => {
    // The honest-failure semantics for Fix A are preserved · only the
    // ref assignment changed.
    expect(src.shared).toMatch(
      /setState\(\{\s*kind:\s*"error",\s*reason:\s*"local_lock_threw"\s*\}\)/,
    );
    expect(src.shared).toMatch(
      /setState\(\{\s*kind:\s*"error",\s*reason:\s*"post_lock_still_unlocked"\s*\}\)/,
    );
  });

  test("Fix B unmount guard unchanged · still gated on activeRef.current (now sticky)", () => {
    // With activeRef sticky through errors, the Fix B cleanup also
    // fires defensively on unmount if the user triggered Home and
    // then navigated away via back-button after an error. This is
    // intended behaviour · the user's intent to leave persists.
    expect(src.shared).toMatch(
      /if \(activeRef\.current\) \{\s*try \{\s*lockVaultEverywhere\(\);/,
    );
  });

  test("Fix C guard uses the imperative reader · stale .state check is gone", () => {
    expect(src.recoverClient).toContain("lockAndLeave.isActive()");
    expect(src.recoverClient).not.toContain('lockAndLeave.state.kind !== "idle"');
  });

  test("Option α notes do NOT claim to eliminate all VMK races · architectural scope preserved", () => {
    // The owner-authorised scope: close the recover-specific race
    // via a ref-based reader. The broader installVmk() session-
    // generation issue is explicitly OUT of scope for this gate.
    // The JSDoc / comments should NOT claim a universal fix.
    expect(src.shared).not.toMatch(
      /race-free|eliminates all|closes every|universally safe/i,
    );
  });
});

// ─── F · hard boundary · sealed files UNCHANGED by this gate ────────

describe("F · hard-boundary · sealed setup + shell header unchanged", () => {
  test("sealed _setup-client still carries its own local VaultSetupHeader (Option B · do NOT refactor)", () => {
    expect(src.setupClient).toMatch(/function VaultSetupHeader\(/);
    expect(src.setupClient).toMatch(/handleHomeLockAndLeave/);
    expect(src.setupClient).toMatch(/lockVaultEverywhere\(\)/);
    expect(src.setupClient).toMatch(/function LockingVaultOverlay\(/);
  });

  test("sealed _setup-client does NOT import from the new shared file", () => {
    // Option B explicitly: do NOT touch sealed setup. If a future
    // refactor migrates setup to use the shared file, that is a
    // separate authorisation.
    expect(src.setupClient).not.toContain("_lock-and-leave-header");
  });

  test("VaultShellHeader (simple-link variant) still used by non-lock-and-leave surfaces", () => {
    expect(src.shellHeader).toMatch(/export function VaultShellHeader\(/);
    expect(src.shellHeader).toMatch(/next\/link/);
    expect(src.shellHeader).not.toMatch(/useLockAndLeave|lockVault\(|lockVaultEverywhere/);
  });

  test("sealed lock primitives still exist and are unchanged (import contract)", () => {
    expect(src.unlockOrchestrator).toMatch(
      /export async function lockVault\(\): Promise<void>/,
    );
    expect(src.lockSweep).toMatch(
      /export function lockVaultEverywhere\(\): void/,
    );
    expect(src.vaultSession).toMatch(
      /export function readVaultSessionSnapshot\(\)/,
    );
    expect(src.vaultSession).toMatch(/export function clearVmk\(\): void/);
  });

  test("no new API routes added by this gate", () => {
    // The shared file + recover changes are purely client-side.
    expect(src.shared).not.toMatch(/\/api\/nex-native\//);
    expect(src.recoverClient).not.toMatch(/\/api\/nex-native\/vault\/[a-z]/i);
  });
});
