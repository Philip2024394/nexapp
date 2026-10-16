// src/app/nex-native/settings/__tests__/_save-ui-honesty.test.ts
//
// F2 (follow-up 2026-10-16) · Honest-save regression anchor.
//
// Owner directive: "The UI cannot display a false saved/success state
// when persistence failed." When migrations 199/200/201 are missing,
// the preference services throw a fast error (verified at 262ms in the
// baseline investigation). Each save-UI component MUST roll back its
// optimistic update AND surface the error · no component may silently
// swallow a failed save and leave the user believing it stuck.
//
// This test is structural (fs.readFileSync + regex) because the project
// has no @testing-library/react dependency and the components use
// useTransition which is awkward to render in isolation. The structural
// pattern mirrors `_enforcement-anchors.test.ts`.
//
// A regression that removes a rollback branch · a `role="alert"` ·
// or the `previous` capture would break the honest-save contract
// documented in the sealed Settings doctrine (2026-10-15).

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

// Save-UI components with optimistic state (toggles + radios). The
// contract: capture previous value → optimistic flip → on failure roll
// back AND show an alert. If this contract is broken the user sees a
// false success state.
const OPTIMISTIC_SAVE_UIS: Array<{ file: string; name: string }> = [
  {
    file: "src/app/nex-native/settings/notifications/_toggle-row.tsx",
    name: "notifications · ToggleRow",
  },
  {
    file: "src/app/nex-native/settings/chat-settings/_boolean-toggle.tsx",
    name: "chat-settings · BooleanToggle",
  },
  {
    file: "src/app/nex-native/settings/chat-settings/_visibility-radio.tsx",
    name: "chat-settings · VisibilityRadio",
  },
  {
    file: "src/app/nex-native/settings/privacy/_privacy-radios.tsx",
    name: "privacy · Profile+WhoCanMessage radios",
  },
  {
    file: "src/app/nex-native/settings/data-usage/_data-usage-radios.tsx",
    name: "data-usage · AutoDownload+UploadQuality radios",
  },
];

// Destructive-action UIs (no optimistic state) still MUST surface the
// error · they just don't have a rollback to perform. UnblockButton
// is the current example · its row disappears on page revalidation,
// not via optimistic UI.
const DESTRUCTIVE_SAVE_UIS: Array<{ file: string; name: string }> = [
  {
    file: "src/app/nex-native/settings/blocked/_unblock-button.tsx",
    name: "blocked · UnblockButton",
  },
];

describe("F2 · Honest-save · optimistic UIs roll back on failure", () => {
  for (const { file, name } of OPTIMISTIC_SAVE_UIS) {
    describe(name, () => {
      const SRC = stripComments(read(file));

      test("has an `if (!result.ok)` rollback branch", () => {
        expect(SRC).toMatch(/if\s*\(\s*!\s*result\.ok\s*\)/);
      });

      test("captures the previous value before the optimistic update", () => {
        // The notifications ToggleRow uses `enabled` as both current
        // and rollback target · it does `setEnabled(enabled)` after
        // flipping to `next`. Other components use an explicit
        // `const previous = value`. Accept either sealed pattern.
        const sealedToggleRollback = /setEnabled\(\s*enabled\s*\)/.test(SRC);
        const explicitPrevious = /const\s+previous\s*=\s*value/.test(SRC);
        expect(sealedToggleRollback || explicitPrevious).toBe(true);
      });

      test("renders role='alert' so screen readers announce the failure", () => {
        expect(SRC).toMatch(/role\s*=\s*["']alert["']/);
      });

      test("error element only renders when the error state is truthy", () => {
        const hasErrorGate =
          /\{\s*error\s*&&\s*\(/.test(SRC) ||
          /\{\s*error\s*\?\s*\(/.test(SRC);
        expect(hasErrorGate).toBe(true);
      });

      test("does NOT silently swallow a failed save (every awaited action is checked)", () => {
        const callSites = [
          ...SRC.matchAll(
            /const\s+result[^=]*=\s*await\s+update[A-Za-z]+Action\(/g,
          ),
        ];
        for (const m of callSites) {
          const after = SRC.slice(m.index ?? 0, (m.index ?? 0) + 400);
          expect(after).toContain("result.ok");
        }
      });
    });
  }
});

describe("F2 · Honest-save · destructive actions still surface errors", () => {
  for (const { file, name } of DESTRUCTIVE_SAVE_UIS) {
    describe(name, () => {
      const SRC = stripComments(read(file));
      test("has an `if (!result.ok)` branch that sets error state", () => {
        expect(SRC).toMatch(
          /if\s*\(\s*!\s*result\.ok\s*\)[\s\S]{0,80}setError\(/,
        );
      });
      test("renders role='alert' error element", () => {
        expect(SRC).toMatch(/role\s*=\s*["']alert["']/);
      });
    });
  }
});

describe("F2 · each preference page surfaces a load-failed banner · never silently defaults", () => {
  // These are the four preference pages whose services call Supabase
  // with columns that may not exist yet (migrations 199/200/201). Each
  // page catches the service throw and MUST surface a visible banner
  // so the user knows the shown values are sealed defaults, not their
  // saved intent.
  const PAGES: Array<{ file: string; name: string }> = [
    {
      file: "src/app/nex-native/settings/notifications/page.tsx",
      name: "notifications",
    },
    {
      file: "src/app/nex-native/settings/chat-settings/page.tsx",
      name: "chat-settings",
    },
    { file: "src/app/nex-native/settings/privacy/page.tsx", name: "privacy" },
    {
      file: "src/app/nex-native/settings/data-usage/page.tsx",
      name: "data-usage",
    },
  ];

  for (const { file, name } of PAGES) {
    describe(name, () => {
      const SRC = stripComments(read(file));

      test("declares `prefsLoadFailed` boolean", () => {
        expect(SRC).toContain("prefsLoadFailed");
      });

      test("sets prefsLoadFailed in a catch block (the service throws when columns are missing)", () => {
        expect(SRC).toMatch(/catch[\s\S]{0,120}prefsLoadFailed\s*=\s*true/);
      });

      test("renders a role='alert' banner when prefsLoadFailed is true", () => {
        expect(SRC).toMatch(
          /\{\s*prefsLoadFailed[\s\S]{0,120}role\s*=\s*["']alert["']/,
        );
      });
    });
  }
});
