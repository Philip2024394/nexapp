// Resend email adapter tests · no live network calls.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resendEmailAdapter } from "../resend_email";
import type { NotificationMessage } from "../../types";

const baseMsg: NotificationMessage = {
  channel: "email",
  kind: "transactional",
  to: [{ address: "user@example.com", name: "User" }],
  subject: "Hello",
  body: "Plain text body",
  html: "<p>HTML body</p>",
};

const ORIGINAL_ENV = { ...process.env };

function clearResendEnv(): void {
  delete process.env.RESEND_API_KEY;
  delete process.env.NEX_EMAIL_FROM;
}

function setResendEnv(): void {
  process.env.RESEND_API_KEY = "test_api_key_do_not_use";
  process.env.NEX_EMAIL_FROM = "NEX <no-reply@example.com>";
}

beforeEach(() => {
  clearResendEnv();
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("resendEmailAdapter.send", () => {
  it("returns resend_credentials_missing when env vars are absent · no fetch call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resendEmailAdapter.send(baseMsg);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("resend_credentials_missing");
      expect(result.provider).toBe("resend");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns resend_credentials_missing when only NEX_EMAIL_FROM is absent · no fetch call", async () => {
    process.env.RESEND_API_KEY = "test_api_key_do_not_use";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resendEmailAdapter.send(baseMsg);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("resend_credentials_missing");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ok:true with provider_message_id on 200 response", async () => {
    setResendEnv();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ id: "re_abc123" }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resendEmailAdapter.send(baseMsg);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test_api_key_do_not_use");
    expect(headers["Content-Type"]).toBe("application/json");
    const bodyJson = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(bodyJson.from).toBe("NEX <no-reply@example.com>");
    expect(bodyJson.to).toEqual(["user@example.com"]);
    expect(bodyJson.subject).toBe("Hello");
    expect(bodyJson.html).toBe("<p>HTML body</p>");
    expect(bodyJson.text).toBe("Plain text body");

    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.provider).toBe("resend");
      expect(result.provider_message_id).toBe("re_abc123");
      expect(typeof result.sent_at).toBe("string");
    }
  });

  it("returns ok:false with reason on non-2xx response", async () => {
    setResendEnv();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: async () => ({ statusCode: 422, message: "invalid_from_address", name: "validation_error" }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resendEmailAdapter.send(baseMsg);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.provider).toBe("resend");
      expect(result.reason).toContain("422");
      expect(result.reason).toContain("invalid_from_address");
      expect(result.retryable).toBe(false);
    }
  });

  it("marks 5xx responses as retryable", async () => {
    setResendEnv();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({ statusCode: 503, message: "temporarily down" }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resendEmailAdapter.send(baseMsg);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.retryable).toBe(true);
    }
  });
});
