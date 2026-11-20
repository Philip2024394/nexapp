// @vitest-environment jsdom
// src/app/nex-native/__tests__/vault-idle-guard-mount.test.tsx
//
// Prompt-5 · 2026-11-18 · pins the fix that mounts startVaultIdleGuard
// into the nex-native layout. Before this fix the library exported
// startVaultIdleGuard but no root provider called it, so the sealed §G
// idle-lock lifecycle was unenforced. This suite protects against a
// future drive-by that removes the mount or swaps it for a no-op.

import { describe, expect, it, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("VaultIdleGuard · prompt-5 2026-11-18 mount contract", () => {
  it("invokes startVaultIdleGuard on mount and the returned teardown on unmount", async () => {
    const teardown = vi.fn();
    const startSpy = vi.fn(() => teardown);

    vi.doMock("@/lib/nex-native/vault/client/vault-session", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/nex-native/vault/client/vault-session")
      >("@/lib/nex-native/vault/client/vault-session");
      return {
        ...actual,
        startVaultIdleGuard: startSpy,
      };
    });

    const { VaultIdleGuard } = await import("../_vault-idle-guard");

    const { unmount } = render(<VaultIdleGuard />);
    // React effect runs after commit; assert the spy was called exactly once.
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(teardown).not.toHaveBeenCalled();

    act(() => {
      unmount();
    });
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it("calls startVaultIdleGuard with NO argument overrides · sealed §G defaults", async () => {
    const startSpy = vi.fn(() => () => undefined);

    vi.doMock("@/lib/nex-native/vault/client/vault-session", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/nex-native/vault/client/vault-session")
      >("@/lib/nex-native/vault/client/vault-session");
      return {
        ...actual,
        startVaultIdleGuard: startSpy,
      };
    });

    const { VaultIdleGuard } = await import("../_vault-idle-guard");
    render(<VaultIdleGuard />);

    // Zero-argument call · the library's own sealed defaults (5 min
    // idle, 1 min hidden grace) are the policy. A future change that
    // smuggles an owner-overriding options object here must be
    // explicit and should break this pin.
    expect(startSpy).toHaveBeenCalledWith();
  });
});
