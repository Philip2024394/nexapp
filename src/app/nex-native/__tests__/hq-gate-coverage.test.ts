// src/app/nex-native/__tests__/hq-gate-coverage.test.ts
//
// NEX Security Programme · Item 3 · Fix 2 · order-aware HQ gate
// regression test. Owner directive 2026-11-07.
// -----------------------------------------------------------------------------
// Why this file exists · the pre-existing `admin-action-role-gates.test.ts`
// asserted only that `requireHqAdmin` appears somewhere in a function
// body. A refactor that imports the symbol but doesn't call it (or
// calls it AFTER a mutation) would still pass. This replacement
// verifies TWO stronger invariants for every HQ-privileged surface:
//
//   1. Presence  · the function body contains a call to one of the
//                  sealed gate helpers: `requireHqAdmin(...)`,
//                  `requireHqReviewer(...)`, or `assertHqAdmin()`.
//
//   2. Order     · the first occurrence of the gate call appears
//                  BEFORE the first occurrence of any mutation
//                  marker: `nexSupabaseAdmin`, `.update(`, `.insert(`,
//                  `.delete(`, `.upsert(`, `appendFile(`, `writeFile(`,
//                  `mkdir(`, `execp(`.
//
// Limitations acknowledged in writing (per owner directive):
//   · Static string analysis · a gate call inside a `//` comment ABOVE
//     the function body would NOT satisfy invariant 1 because we slice
//     only the body between `export async function <name>` and the
//     next `export async function` marker. Block comments inside the
//     body WOULD match, so comment-inside-body false-positives are
//     possible if someone mentions the gate name in a doc block
//     without actually calling it. The mitigation: invariant 2
//     (order) · a comment-only mention still has to appear before
//     any mutation marker, which is a weak signal but better than
//     nothing. Future upgrade: parse AST via typescript-eslint or
//     ts-morph to confirm the identifier is a call expression.
//
//   · Fixture coverage · the file list is explicit (not glob-walked
//     at runtime) so a new HQ page added to disk without updating
//     this test is NOT automatically checked. This is a deliberate
//     trade-off · a glob-walker would silently allow a brand-new
//     HQ route to pass by matching on its own gate call before any
//     mutation lines exist in a fresh skeleton. Explicit fixture
//     list makes the audit visible in code review.
//
//   · Reader functions listed in `src/app/nex-native/hq/pages/
//     _queue-readers.ts` are DELIBERATELY excluded from this test
//     because they are no longer exported as Server Actions (per
//     Item 3 · Fix 1). The module is imported only from server-side
//     callers that gate independently.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const REPO_ROOT = process.cwd();

// ─── Gate helpers + mutation markers ─────────────────────────────────

const GATE_CALL_PATTERNS: readonly RegExp[] = [
  /\brequireHqAdmin\s*\(/,
  /\brequireHqReviewer\s*\(/,
  /\bassertHqAdmin\s*\(/,
];

const MUTATION_MARKERS: readonly RegExp[] = [
  /\bnexSupabaseAdmin\b/,
  /\.update\s*\(/,
  /\.insert\s*\(/,
  /\.delete\s*\(/,
  /\.upsert\s*\(/,
  /\bappendFile\s*\(/,
  /\bwriteFile\s*\(/,
  /\bmkdir\s*\(/,
  /\bexecp\s*\(/,
];

function firstMatchIndex(src: string, patterns: readonly RegExp[]): number {
  let best = -1;
  for (const p of patterns) {
    const m = p.exec(src);
    if (m && m.index !== undefined) {
      if (best === -1 || m.index < best) best = m.index;
    }
  }
  return best;
}

interface GateCheckResult {
  readonly hasGateCall: boolean;
  readonly gateIndex: number;
  readonly hasMutation: boolean;
  readonly mutationIndex: number;
  readonly gateBeforeMutation: boolean;
}

function checkGateOrder(body: string): GateCheckResult {
  const gateIndex = firstMatchIndex(body, GATE_CALL_PATTERNS);
  const mutationIndex = firstMatchIndex(body, MUTATION_MARKERS);
  const hasGateCall = gateIndex >= 0;
  const hasMutation = mutationIndex >= 0;
  // No mutation = vacuously ok · still require gate presence.
  // Gate before mutation when both present = ok.
  const gateBeforeMutation = !hasMutation
    ? hasGateCall
    : hasGateCall && gateIndex < mutationIndex;
  return {
    hasGateCall,
    gateIndex,
    hasMutation,
    mutationIndex,
    gateBeforeMutation,
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────

// Format: [relative path, function name OR null for "default export of
// the file" (page.tsx), label].
type Fixture = {
  readonly file: string;
  readonly functionName: string | null;
  readonly label: string;
  readonly expectedGate: "admin" | "reviewer" | "either";
};

const HQ_PAGE_FIXTURES: ReadonlyArray<Fixture> = [
  {
    file: "src/app/nex-native/hq/page.tsx",
    functionName: "HqHomePage",
    label: "HQ home page",
    expectedGate: "admin",
  },
  {
    file: "src/app/nex-native/hq/harvest/page.tsx",
    functionName: "HarvestDashboardPage",
    label: "HQ harvest page",
    expectedGate: "reviewer",
  },
  {
    file: "src/app/nex-native/hq/chat-themes/page.tsx",
    functionName: "HqChatThemesPage",
    label: "HQ chat-themes page",
    expectedGate: "admin",
  },
  {
    file: "src/app/nex-native/hq/communities/page.tsx",
    functionName: "HqCommunitiesPage",
    label: "HQ communities page",
    expectedGate: "admin",
  },
  {
    file: "src/app/nex-native/hq/communities/[zoneId]/page.tsx",
    functionName: "HqCommunityDetailPage",
    label: "HQ community detail page",
    expectedGate: "admin",
  },
  {
    file: "src/app/nex-native/hq/pages/page.tsx",
    functionName: "HqPagesPage",
    label: "HQ pages dashboard",
    expectedGate: "admin",
  },
];

const HQ_ACTION_FIXTURES: ReadonlyArray<Fixture> = [
  {
    file: "src/app/nex-native/hq/chat-themes/_actions.ts",
    functionName: "hqRenameChatThemeAction",
    label: "HQ chat-theme rename action",
    expectedGate: "admin",
  },
  // Mutating actions in hq/pages/_actions.ts · each uses `assertHqAdmin()`.
  {
    file: "src/app/nex-native/hq/pages/_actions.ts",
    functionName: "queueDeletionAction",
    label: "HQ queue deletion action",
    expectedGate: "admin",
  },
  {
    file: "src/app/nex-native/hq/pages/_actions.ts",
    functionName: "unqueueDeletionAction",
    label: "HQ unqueue deletion action",
    expectedGate: "admin",
  },
  {
    file: "src/app/nex-native/hq/pages/_actions.ts",
    functionName: "renameRouteAction",
    label: "HQ route rename action",
    expectedGate: "admin",
  },
  {
    file: "src/app/nex-native/hq/pages/_actions.ts",
    functionName: "toggleLockAction",
    label: "HQ route lock toggle action",
    expectedGate: "admin",
  },
  {
    file: "src/app/nex-native/hq/pages/_actions.ts",
    functionName: "inspectRouteAction",
    label: "HQ route inspection action",
    expectedGate: "admin",
  },
  {
    file: "src/app/nex-native/hq/pages/_actions.ts",
    functionName: "countCallersAction",
    label: "HQ caller-count action",
    expectedGate: "admin",
  },
  // Admin-tier actions mixed into the catch-all _actions.ts file.
  {
    file: "src/app/nex-native/_actions.ts",
    functionName: "adminSetAccountTierAction",
    label: "Admin · set account tier",
    expectedGate: "admin",
  },
  {
    file: "src/app/nex-native/_actions.ts",
    functionName: "adminCreateChatThemeAction",
    label: "Admin · create chat theme",
    expectedGate: "admin",
  },
];

// ─── Body extraction ─────────────────────────────────────────────────

function readFile(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}

/** Slice the body of `export async function <name>` up to the next
 *  `export async function `, `export function `, `function ` at the
 *  module top-level, or end of file. */
function sliceFunction(src: string, name: string): string {
  const open = src.indexOf(`export async function ${name}`);
  if (open < 0) {
    const openFn = src.indexOf(`async function ${name}`);
    if (openFn < 0) {
      throw new Error(`cannot find function '${name}' in source`);
    }
    return sliceFromIndex(src, openFn);
  }
  return sliceFromIndex(src, open);
}

function sliceFromIndex(src: string, start: number): string {
  const nextMarkers = [
    "\nexport async function ",
    "\nexport function ",
    "\nasync function ",
    "\nfunction ",
  ];
  let nextIndex = src.length;
  for (const m of nextMarkers) {
    const idx = src.indexOf(m, start + 1);
    if (idx > 0 && idx < nextIndex) nextIndex = idx;
  }
  return src.slice(start, nextIndex);
}

// ─── The actual tests ───────────────────────────────────────────────

describe("HQ gate coverage · order-aware regression (Item 3 · Fix 2)", () => {
  describe("HQ pages", () => {
    for (const fx of HQ_PAGE_FIXTURES) {
      test(`${fx.label} (${fx.file}) has gate before any mutation`, () => {
        const src = readFile(fx.file);
        const body = fx.functionName
          ? sliceFunction(src, fx.functionName)
          : src;
        const result = checkGateOrder(body);
        expect(result.hasGateCall, `${fx.label} missing gate call`).toBe(true);
        expect(
          result.gateBeforeMutation,
          `${fx.label} · gate at ${result.gateIndex} should precede first mutation at ${result.mutationIndex}`,
        ).toBe(true);
      });

      test(`${fx.label} calls the expected gate role (${fx.expectedGate})`, () => {
        const src = readFile(fx.file);
        const body = fx.functionName
          ? sliceFunction(src, fx.functionName)
          : src;
        if (fx.expectedGate === "admin") {
          expect(/\brequireHqAdmin\s*\(/.test(body) || /\bassertHqAdmin\s*\(/.test(body)).toBe(
            true,
          );
        } else if (fx.expectedGate === "reviewer") {
          expect(/\brequireHqReviewer\s*\(/.test(body)).toBe(true);
        }
      });
    }
  });

  describe("HQ server actions", () => {
    for (const fx of HQ_ACTION_FIXTURES) {
      test(`${fx.label} (${fx.functionName}) gates before mutation`, () => {
        const src = readFile(fx.file);
        const body = sliceFunction(src, fx.functionName!);
        const result = checkGateOrder(body);
        expect(result.hasGateCall, `${fx.label} missing gate call`).toBe(true);
        expect(
          result.gateBeforeMutation,
          `${fx.label} · gate at ${result.gateIndex} should precede first mutation at ${result.mutationIndex}`,
        ).toBe(true);
      });
    }
  });

  // ─── Deny-mode consistency (Item 3 · Fix 3) ─────────────────────────

  describe("HQ page denial mode · non-revealing notFound() (Item 3 · Fix 3)", () => {
    const EXPECT_NOTFOUND: ReadonlyArray<string> = [
      "src/app/nex-native/hq/page.tsx",
      "src/app/nex-native/hq/harvest/page.tsx",
      "src/app/nex-native/hq/chat-themes/page.tsx",
      "src/app/nex-native/hq/communities/page.tsx",
      "src/app/nex-native/hq/communities/[zoneId]/page.tsx",
      "src/app/nex-native/hq/pages/page.tsx",
    ];
    for (const f of EXPECT_NOTFOUND) {
      test(`${f} uses notFound() on HqAuthorizationError`, () => {
        const src = readFile(f);
        // Every HQ page MUST import + call notFound(). Any lingering
        // redirect("/nex-native") on an HqAuthorizationError branch is
        // a Fix 3 regression.
        expect(src).toMatch(/notFound\s*\(\s*\)/);
        // Negative assertion · no HqAuthorizationError → redirect leak.
        expect(src).not.toMatch(
          /HqAuthorizationError.*\n[\s\S]{0,200}?redirect\s*\(\s*["']\/nex-native["']\s*\)/,
        );
      });
    }
  });

  // ─── Reader-function containment (Item 3 · Fix 1) ──────────────────

  describe("queue readers are NOT exported as Server Actions (Item 3 · Fix 1)", () => {
    test("_queue-readers.ts does NOT carry the 'use server' pragma", () => {
      const src = readFile(
        "src/app/nex-native/hq/pages/_queue-readers.ts",
      );
      // The first non-whitespace content must not be "use server".
      // A simple contains-check is sufficient · the pragma is always
      // a top-level directive.
      expect(src.slice(0, 200)).not.toMatch(/"use server"/);
      // It MUST carry the server-only guard.
      expect(src).toMatch(/import ["']server-only["']/);
    });

    test("_actions.ts does NOT re-export the reader functions from _queue-readers", () => {
      const src = readFile("src/app/nex-native/hq/pages/_actions.ts");
      // Re-exporting from a 'use server' file would turn the re-export
      // into a Server Action (same failure mode Fix 1 addresses).
      expect(src).not.toMatch(
        /export\s*\{[^}]*(readDeletionQueue|readRenameQueue|readLockOverrides)[^}]*\}\s*from\s*["']\.\/_queue-readers["']/,
      );
    });
  });
});
