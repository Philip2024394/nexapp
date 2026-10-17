// src/lib/nex-native/__tests__/handle-reserved-names.test.ts
//
// Coherence tests for the reserved-name lists. The DB_SYSTEM_RESERVED
// set must stay in sync with the CHECK constraint in migration 204.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  DB_SYSTEM_RESERVED,
  APP_RESERVED,
  isReservedHandle,
} from "@/lib/nex-native/handle-reserved-names";

describe("reserved-name lists", () => {
  it("every DB-reserved name is lowercase (comparison is case-insensitive against lowercased input)", () => {
    for (const name of DB_SYSTEM_RESERVED) {
      expect(name).toBe(name.toLowerCase());
    }
  });
  it("every APP-reserved name is lowercase", () => {
    for (const name of APP_RESERVED) {
      expect(name).toBe(name.toLowerCase());
    }
  });
  it("DB-reserved and APP-reserved do not overlap", () => {
    for (const name of DB_SYSTEM_RESERVED) {
      expect(APP_RESERVED.has(name)).toBe(false);
    }
  });
  it("isReservedHandle returns true for DB-reserved and APP-reserved names", () => {
    for (const name of DB_SYSTEM_RESERVED) {
      expect(isReservedHandle(name)).toBe(true);
    }
    for (const name of APP_RESERVED) {
      expect(isReservedHandle(name)).toBe(true);
    }
  });
  it("isReservedHandle returns false for non-reserved names", () => {
    for (const name of ["lulu", "john smith", "hammerex products", "jose", "camel"]) {
      expect(isReservedHandle(name)).toBe(false);
    }
  });
});

describe("DB-reserved list matches migration 204 CHECK constraint", () => {
  it("every name in DB_SYSTEM_RESERVED is present in migration 204 SQL", () => {
    const migrationPath = path.join(
      process.cwd(),
      "nex-supabase",
      "migrations",
      "204_nex_account_chosen_handle.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    for (const name of DB_SYSTEM_RESERVED) {
      // Each reserved name should appear as a quoted string in the SQL.
      const quoted = `'${name}'`;
      expect(sql).toContain(quoted);
    }
  });
  it("migration 204 reserved list has no extras missing from DB_SYSTEM_RESERVED", () => {
    const migrationPath = path.join(
      process.cwd(),
      "nex-supabase",
      "migrations",
      "204_nex_account_chosen_handle.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    // Extract the CHECK's NOT IN (...) list and parse its quoted names.
    const checkMatch = sql.match(
      /chosen_handle_not_reserved[\s\S]*?NOT IN \(([\s\S]*?)\)/,
    );
    expect(checkMatch).not.toBeNull();
    const list = checkMatch![1]!;
    // Pull every single-quoted literal out of the list.
    const names = Array.from(list.matchAll(/'([^']*)'/g)).map((m) => m[1]!);
    const sqlSet = new Set(names);
    expect(sqlSet).toEqual(DB_SYSTEM_RESERVED);
  });
});
