// src/lib/nex-native/__tests__/fan-out-planner.test.ts
//
// NEX device-key chat · fan-out planner unit tests.
// Owner-authorised 2026-11-10.
// -----------------------------------------------------------------
// Covers:
//   1. single recipient + single device · exactly 1 row
//   2. N recipient devices · exactly N peer rows
//   3. sender self-echo · current sender device excluded; siblings
//      included
//   4. deterministic ordering · sort by recipient_device_id,
//      peer rows before self rows

import { describe, expect, it } from "vitest";
import { planFanOut, type FanOutDevice } from "../crypto/fan-out-planner";

function device(
  account_id: string,
  device_id: string,
  public_key: string,
): FanOutDevice {
  return { account_id, device_id, public_key };
}

describe("planFanOut", () => {
  it("produces exactly one row for a single-recipient single-device send", () => {
    const plan = planFanOut({
      sender_account_id: "acct-s",
      sender_device_id: "s-dev-1",
      peer_devices: [device("acct-p", "p-dev-1", "pk-p1")],
      sender_devices: [device("acct-s", "s-dev-1", "pk-s1")],
    });
    expect(plan.rows).toHaveLength(1);
    expect(plan.peer_row_count).toBe(1);
    expect(plan.self_row_count).toBe(0);
    expect(plan.rows[0]).toEqual({
      role: "peer",
      recipient_account_id: "acct-p",
      recipient_device_id: "p-dev-1",
      recipient_public_key: "pk-p1",
    });
  });

  it("produces one row per recipient device for N recipients", () => {
    const plan = planFanOut({
      sender_account_id: "acct-s",
      sender_device_id: "s-dev-1",
      peer_devices: [
        device("acct-p", "p-dev-1", "pk-p1"),
        device("acct-p", "p-dev-2", "pk-p2"),
        device("acct-p", "p-dev-3", "pk-p3"),
      ],
      sender_devices: [device("acct-s", "s-dev-1", "pk-s1")],
    });
    expect(plan.peer_row_count).toBe(3);
    expect(plan.self_row_count).toBe(0);
    const ids = plan.rows.map((r) => r.recipient_device_id);
    expect(ids).toEqual(["p-dev-1", "p-dev-2", "p-dev-3"]);
  });

  it("excludes the sender's current device from self-echo and includes siblings", () => {
    const plan = planFanOut({
      sender_account_id: "acct-s",
      sender_device_id: "s-dev-1",
      peer_devices: [device("acct-p", "p-dev-1", "pk-p1")],
      sender_devices: [
        device("acct-s", "s-dev-1", "pk-s1"), // current · excluded
        device("acct-s", "s-dev-2", "pk-s2"),
        device("acct-s", "s-dev-3", "pk-s3"),
      ],
    });
    expect(plan.peer_row_count).toBe(1);
    expect(plan.self_row_count).toBe(2);
    const selfRows = plan.rows.filter((r) => r.role === "self");
    expect(selfRows.map((r) => r.recipient_device_id)).toEqual([
      "s-dev-2",
      "s-dev-3",
    ]);
    // Current device never appears.
    expect(plan.rows.some((r) => r.recipient_device_id === "s-dev-1")).toBe(
      false,
    );
  });

  it("orders deterministically · peer rows first, each block sorted by device_id", () => {
    const plan = planFanOut({
      sender_account_id: "acct-s",
      sender_device_id: "s-dev-1",
      // Intentionally unsorted input to prove the function sorts.
      peer_devices: [
        device("acct-p", "p-zulu", "pk-pz"),
        device("acct-p", "p-alpha", "pk-pa"),
        device("acct-p", "p-mike", "pk-pm"),
      ],
      sender_devices: [
        device("acct-s", "s-dev-1", "pk-s1"), // excluded
        device("acct-s", "s-zulu", "pk-sz"),
        device("acct-s", "s-alpha", "pk-sa"),
      ],
    });
    const ids = plan.rows.map((r) => r.recipient_device_id);
    expect(ids).toEqual([
      // peer block sorted
      "p-alpha",
      "p-mike",
      "p-zulu",
      // self block sorted
      "s-alpha",
      "s-zulu",
    ]);
    // Role grouping is contiguous.
    expect(plan.rows[0].role).toBe("peer");
    expect(plan.rows[1].role).toBe("peer");
    expect(plan.rows[2].role).toBe("peer");
    expect(plan.rows[3].role).toBe("self");
    expect(plan.rows[4].role).toBe("self");
  });
});
