// src/lib/nex-native/__tests__/open-shop-cookie.test.ts
//
// NEX · S9 · one-shot open-shop cookie tests.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Pins the four invariants the owner called out:
//
//   T9.1 · Set writes exact cookie key + exact whitelisted value +
//          sealed options (httpOnly / sameSite=lax / path=/ /
//          1h max-age).
//   T9.2 · Consume returns true + clears the cookie when value is
//          exactly "1".
//   T9.3 · Consume returns false when cookie absent · no delete call.
//   T9.4 · Tampered cookie value (anything other than "1") → consume
//          returns false AND clears the cookie (fail-closed, one-shot
//          contract: a bad cookie never gets a second chance to fire).

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const { cookiesGetMock, cookiesSetMock, cookiesDeleteMock, cookiesMock } =
  vi.hoisted(() => {
    const store = new Map<string, string>();
    const cookiesGetMock = vi.fn((name: string) => {
      const v = store.get(name);
      return v === undefined ? undefined : { name, value: v };
    });
    const cookiesSetMock = vi.fn(
      (
        name: string,
        value: string,
        _opts: Record<string, unknown>,
      ) => {
        store.set(name, value);
      },
    );
    const cookiesDeleteMock = vi.fn(
      (arg: string | { name: string; path?: string }) => {
        const name = typeof arg === "string" ? arg : arg.name;
        store.delete(name);
      },
    );
    const cookiesMock = vi.fn(async () => ({
      get: cookiesGetMock,
      set: cookiesSetMock,
      delete: cookiesDeleteMock,
    }));
    return {
      cookiesGetMock,
      cookiesSetMock,
      cookiesDeleteMock,
      cookiesMock,
      _store: store,
    };
  });

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import {
  OPEN_SHOP_SLIDER_COOKIE,
  OPEN_SHOP_SLIDER_VALUE,
  OPEN_SHOP_SLIDER_MAX_AGE_SECONDS,
  openShopSliderCookieOptions,
  setOpenShopSliderCookie,
  consumeOpenShopSliderCookie,
} from "../open-shop-cookie";

beforeEach(() => {
  cookiesGetMock.mockClear();
  cookiesSetMock.mockClear();
  cookiesDeleteMock.mockClear();
  cookiesMock.mockClear();
  // Flush any residual store entries.
  cookiesDeleteMock(OPEN_SHOP_SLIDER_COOKIE);
  cookiesDeleteMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("open-shop-cookie · constants + options", () => {
  test("cookie name + value + max-age are sealed", () => {
    expect(OPEN_SHOP_SLIDER_COOKIE).toBe("nex_open_shop_on_chat");
    expect(OPEN_SHOP_SLIDER_VALUE).toBe("1");
    expect(OPEN_SHOP_SLIDER_MAX_AGE_SECONDS).toBe(60 * 60);
  });

  test("options are httpOnly / sameSite=lax / path=/ / 1h max-age", () => {
    const opts = openShopSliderCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe("/");
    expect(opts.sameSite).toBe("lax");
    expect(opts.maxAge).toBe(60 * 60);
    expect(opts.secure).toBe(false); // vitest default NODE_ENV
  });
});

describe("open-shop-cookie · setOpenShopSliderCookie", () => {
  test("T9.1 · writes exact key + exact value + sealed options", async () => {
    await setOpenShopSliderCookie();

    expect(cookiesSetMock).toHaveBeenCalledTimes(1);
    const call = cookiesSetMock.mock.calls[0]!;
    expect(call[0]).toBe(OPEN_SHOP_SLIDER_COOKIE);
    expect(call[1]).toBe(OPEN_SHOP_SLIDER_VALUE);
    const opts = call[2] as Record<string, unknown>;
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe("/");
    expect(opts.sameSite).toBe("lax");
    expect(opts.maxAge).toBe(60 * 60);
  });
});

describe("open-shop-cookie · consumeOpenShopSliderCookie", () => {
  test("T9.2 · value='1' → returns true AND clears the cookie", async () => {
    await setOpenShopSliderCookie();
    cookiesSetMock.mockClear(); // isolate the delete-call count

    const result = await consumeOpenShopSliderCookie();

    expect(result).toBe(true);
    expect(cookiesDeleteMock).toHaveBeenCalledTimes(1);
    const deleteArg = cookiesDeleteMock.mock.calls[0]![0] as
      | string
      | { name: string; path?: string };
    const name =
      typeof deleteArg === "string" ? deleteArg : deleteArg.name;
    const path =
      typeof deleteArg === "string" ? undefined : deleteArg.path;
    expect(name).toBe(OPEN_SHOP_SLIDER_COOKIE);
    expect(path).toBe("/");
  });

  test("T9.3 · absent cookie → returns false · no delete call", async () => {
    const result = await consumeOpenShopSliderCookie();

    expect(result).toBe(false);
    expect(cookiesDeleteMock).not.toHaveBeenCalled();
  });

  test("T9.4 · tampered cookie value (not '1') → returns false AND clears", async () => {
    cookiesSetMock(OPEN_SHOP_SLIDER_COOKIE, "evil-redirect-payload", {});
    cookiesSetMock.mockClear();

    const result = await consumeOpenShopSliderCookie();

    expect(result).toBe(false);
    expect(cookiesDeleteMock).toHaveBeenCalledTimes(1);
  });

  test("T9.4b · tampered value 'true' is rejected (fail-closed)", async () => {
    cookiesSetMock(OPEN_SHOP_SLIDER_COOKIE, "true", {});

    const result = await consumeOpenShopSliderCookie();

    expect(result).toBe(false);
  });

  test("T9.4c · one-shot · a second consume after valid returns false", async () => {
    await setOpenShopSliderCookie();
    const first = await consumeOpenShopSliderCookie();
    expect(first).toBe(true);

    const second = await consumeOpenShopSliderCookie();
    expect(second).toBe(false);
  });
});

describe("open-shop-cookie · doctrine", () => {
  test("T9.5 · module imports NO business-service / cover persistence primitive", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const srcRaw = await fs.readFile(
      path.resolve(
        process.cwd(),
        "src/lib/nex-native/open-shop-cookie.ts",
      ),
      "utf8",
    );
    const srcCode = srcRaw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(srcCode).not.toMatch(/from\s+["'][^"']*business-service[^"']*["']/);
    expect(srcCode).not.toMatch(/\bupdateCoverLayoutId\s*\(/);
    expect(srcCode).not.toMatch(/\bcreateBusinessAction\s*\(/);
    expect(srcCode).not.toMatch(/\.(from|rpc)\s*\(\s*["']nex_business/);
    // This cookie is a one-shot UI signal · it must never write to
    // the pending-cover cookie or any theme-related store.
    expect(srcCode).not.toMatch(/writePendingCoverLayoutId/);
    expect(srcCode).not.toMatch(/updateChatTheme/);
  });
});
