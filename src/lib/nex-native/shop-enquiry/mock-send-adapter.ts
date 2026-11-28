// src/lib/nex-native/shop-enquiry/mock-send-adapter.ts
//
// MockSendAdapter · test-only adapter that records the exact payload the
// shop-enquiry route sends and returns a programmable SendResult. Lives
// under the shop-enquiry folder because it is only used by the Rev 3
// guest-enquiry test suite · do NOT setDefaultAdapter() with it in any
// non-test boot path.
//
// Use in tests:
//   const mock = new MockSendAdapter({ mode: "delivered" });
//   setDefaultAdapter(mock);
//   ...run the endpoint...
//   expect(mock.calls).toHaveLength(1);
//   expect(mock.calls[0]!.to).toBe("merchant@example.invalid");
//
// Modes:
//   "dry_run"   · returns { ok: true, dry_run_reason: "mock-adapter dry run" }
//                 and is_dry_run=true. Simulates the default ConsoleAdapter.
//   "delivered" · returns { ok: true } and is_dry_run=false. Simulates an
//                 activated provider adapter.
//   "failed"    · returns { ok: false, error: <configurable> }.
//                 Simulates a provider rejection.
//   "throws"    · throws a configurable Error. Simulates provider SDK
//                 crashing inside the adapter.

import type {
  SendAdapter,
  SendPayload,
  SendResult,
} from "../email-send-adapter";

export type MockSendMode = "dry_run" | "delivered" | "failed" | "throws";

export interface MockSendOptions {
  readonly mode: MockSendMode;
  /** For "failed" mode: the error string returned. Default: "mock-adapter failure". */
  readonly errorMessage?: string;
  /** For "throws" mode: the thrown error message. Default: "mock-adapter boom". */
  readonly throwMessage?: string;
  /** Override the adapter name. Default: "mock-send-adapter". */
  readonly name?: string;
}

export class MockSendAdapter implements SendAdapter {
  readonly name: string;
  readonly is_dry_run: boolean;
  private readonly opts: MockSendOptions;
  readonly calls: SendPayload[] = [];

  constructor(opts: MockSendOptions) {
    this.opts = opts;
    this.name = opts.name ?? "mock-send-adapter";
    this.is_dry_run = opts.mode === "dry_run";
  }

  async send(payload: SendPayload): Promise<SendResult> {
    // Clone to defend against callers mutating after the call.
    this.calls.push({ ...payload });
    switch (this.opts.mode) {
      case "dry_run":
        return {
          ok: true,
          dry_run_reason: "mock-adapter dry run",
        };
      case "delivered":
        return { ok: true };
      case "failed":
        return {
          ok: false,
          error: this.opts.errorMessage ?? "mock-adapter failure",
        };
      case "throws":
        throw new Error(this.opts.throwMessage ?? "mock-adapter boom");
    }
  }
}
