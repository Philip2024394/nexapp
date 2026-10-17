// src/app/nex-native/contacts/__tests__/header-mounted.test.ts
//
// Owner-authorised 2026-10-17 · the standalone /nex-native/contacts
// route is retired · consolidated onto /nex-native/chat?tab=friends.
// This file was originally a header-mount guardrail. It now
// enforces the inverse: the Contacts page is a pure redirect ·
// nothing is rendered here · the shared header is NOT mounted here
// (it would be a duplicate of the one on /chat where the Contacts
// experience actually lives).
//
// Static-source only · no React render.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.join(
  process.cwd(),
  "src/app/nex-native/contacts/page.tsx",
);
const SOURCE = fs.readFileSync(PAGE_PATH, "utf8");

describe("contacts page · redirect to /chat?tab=friends", () => {
  it("imports the next/navigation `redirect` helper", () => {
    expect(SOURCE).toMatch(/import\s*\{\s*redirect\s*\}\s*from\s*["']next\/navigation["']/);
  });

  it("default export calls redirect to /nex-native/chat?tab=friends", () => {
    expect(SOURCE).toMatch(
      /export\s+default\s+function\s+\w+\(\)[\s\S]{0,200}redirect\(\s*["']\/nex-native\/chat\?tab=friends["']\s*\)/,
    );
  });

  it("does not mount NexPageHeader (the one and only Contacts surface is /chat?tab=friends)", () => {
    expect(SOURCE).not.toMatch(/NexPageHeader\b/);
  });

  it("does not render any JSX (no visual drift · pure redirect)", () => {
    // The default export signature should be `() => never` because
    // next/navigation `redirect()` throws · never returns. Any JSX
    // return would indicate the redirect is bypassable.
    expect(SOURCE).toMatch(/\):\s*never\b/);
    expect(SOURCE).not.toMatch(/return\s*\(/);
  });

  it("does not call any Supabase client / server action / DB code (zero side-effects)", () => {
    expect(SOURCE).not.toMatch(/supabase/i);
    expect(SOURCE).not.toMatch(/resolveNexAppSession/);
    expect(SOURCE).not.toMatch(/\.insert\(/);
    expect(SOURCE).not.toMatch(/\.update\(/);
    expect(SOURCE).not.toMatch(/\.delete\(/);
  });
});
