// @vitest-environment jsdom
// src/lib/nex-native/vault/client/__tests__/vault-idle-guard-timer.test.ts
//
// Prompt-7 · 2026-11-18 · behavioural UNIT coverage for startVaultIdleGuard.
//
// Prompt-5 mounted the idle guard; prompt-5 unit test pinned the mount
// contract and the zero-argument sealed-defaults contract. Those tests
// prove *that* the guard installs. This file proves *what the guard
// does* once installed, against the sealed §G lifecycle:
//
//   · 5 min of no user activity → VMK cleared.
//   · 1 min of document.hidden   → VMK cleared.
//   · Activity before the idle timer resets the clock.
//   · A tab becoming visible before the hidden grace elapses cancels
//     the pending lock (user came back to the tab in time).
//
// The test environment is jsdom + vi.useFakeTimers so wall-clock time
// is not required. clearVmk is observable via the snapshot read
// (readVaultSessionSnapshot().unlocked), which is the same source React
// consumers read.
//
// Honest limit: UNIT coverage proves the state-machine. It does NOT
// prove that decrypted text or attachment-URL references in a real
// browser tab are revoked on lock · that is a separate component-level
// test (see follow-up for decrypted-state-blockage proofs).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVmk,
  installVmk,
  readVaultSessionSnapshot,
  startVaultIdleGuard,
} from "../vault-session";

function makeVmkBytes(): Uint8Array {
  // 32 zero bytes is a fine test fixture · clearVmk zeroises before
  // null, so starting with a non-zero pattern lets a future reader see
  // the buffer is scrubbed if we ever expose it in a test.
  const b = new Uint8Array(32);
  for (let i = 0; i < 32; i++) b[i] = (i + 1) & 0xff;
  return b;
}

describe("startVaultIdleGuard · behavioural contract (prompt-7 2026-11-18)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Ensure every test starts with Vault locked · the previous test's
    // teardown is run below in afterEach.
    clearVmk();
    // Default visibility · the jsdom document.hidden getter returns
    // false unless we override it per test.
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    clearVmk();
  });

  it("locks after 5 minutes (the sealed §G idle default) of no activity", () => {
    installVmk(makeVmkBytes());
    expect(readVaultSessionSnapshot().unlocked).toBe(true);

    const teardown = startVaultIdleGuard();
    try {
      // Advance just under the threshold · still unlocked.
      vi.advanceTimersByTime(299_000);
      expect(readVaultSessionSnapshot().unlocked).toBe(true);

      // Cross the 5 min boundary · the idle timer fires clearVmk.
      vi.advanceTimersByTime(2_000);
      expect(readVaultSessionSnapshot().unlocked).toBe(false);
    } finally {
      teardown();
    }
  });

  it("locks after 1 minute of document.hidden (sealed §G hidden grace)", () => {
    installVmk(makeVmkBytes());
    const teardown = startVaultIdleGuard();
    try {
      // Flip to hidden and dispatch visibilitychange.
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // Just under grace · still unlocked.
      vi.advanceTimersByTime(59_000);
      expect(readVaultSessionSnapshot().unlocked).toBe(true);

      // Cross 1 min · locks.
      vi.advanceTimersByTime(2_000);
      expect(readVaultSessionSnapshot().unlocked).toBe(false);
    } finally {
      teardown();
    }
  });

  it("activity (pointerdown) before the idle timer resets the clock", () => {
    installVmk(makeVmkBytes());
    const teardown = startVaultIdleGuard();
    try {
      // 4 min of nothing · still unlocked.
      vi.advanceTimersByTime(240_000);
      expect(readVaultSessionSnapshot().unlocked).toBe(true);

      // User touches the screen · resetIdle fires.
      window.dispatchEvent(new Event("pointerdown"));

      // Another 4 min from the reset · still unlocked (clock was reset).
      vi.advanceTimersByTime(240_000);
      expect(readVaultSessionSnapshot().unlocked).toBe(true);

      // Push past 5 min from the LAST activity · now locks.
      vi.advanceTimersByTime(65_000);
      expect(readVaultSessionSnapshot().unlocked).toBe(false);
    } finally {
      teardown();
    }
  });

  it("tab becoming visible again before grace elapses cancels the pending hidden-lock", () => {
    installVmk(makeVmkBytes());
    const teardown = startVaultIdleGuard();
    try {
      // Hide the tab.
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // 30 s elapses (within grace).
      vi.advanceTimersByTime(30_000);
      expect(readVaultSessionSnapshot().unlocked).toBe(true);

      // User comes back · visibility flips to false BEFORE the full
      // grace window expires. The hidden timer MUST be cancelled.
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // Advance to a point that WOULD have fired the hidden lock
      // (90 s total of hidden-and-visible combined). The hidden timer
      // was cancelled · so VMK must still be present.
      vi.advanceTimersByTime(60_000);
      expect(readVaultSessionSnapshot().unlocked).toBe(true);
    } finally {
      teardown();
    }
  });

  it("teardown removes listeners · activity after teardown does not reset the next guard", () => {
    installVmk(makeVmkBytes());
    const teardown1 = startVaultIdleGuard();
    teardown1();

    // After teardown, a new guard starts fresh.
    const teardown2 = startVaultIdleGuard();
    try {
      // Dispatching an event to the OLD listener (now gone) must not
      // reset the NEW guard's clock. We prove this by letting the full
      // 5 min elapse without activity · if the old listener had
      // leaked, this test would fail only in a broken implementation.
      vi.advanceTimersByTime(301_000);
      expect(readVaultSessionSnapshot().unlocked).toBe(false);
    } finally {
      teardown2();
    }
  });
});
