// src/app/nex-native/settings/see-my-theme/__tests__/_badge-truth.test.ts
//
// Defect 1 fix · badge-truth regression anchor · sealed 2026-10-16.
//
// Owner directive: "Make the badge reflect effective mutual visibility,
// not just the current user's toggle." Also: "If optimistic updates
// are supported, calculate the effective state correctly using both
// participants' preferences."
//
// Repo-wide pattern: no @testing-library/react dependency is installed,
// so component behaviour is pinned via structural (fs.readFileSync +
// regex) assertions. The sealed `_save-ui-honesty.test.ts` file in the
// same folder follows the same pattern and is the canonical reference.
//
// What we guard:
//   1. ContactListEntry carries BOTH actor_toggle_on AND other_shares_theme.
//   2. The badge is derived from the AND of actor-toggle AND other-shares,
//      not from actor-toggle alone.
//   3. The optimistic-update override map updates ONLY the actor's state;
//      the other-party's flag stays as rendered (correct · the actor's
//      toggle cannot change the other party's flag).
//   4. The server page passes `other_shares_theme` to the client (via
//      `getOtherToggleState`) · the client never fabricates the other
//      party's preference.
//   5. The rollback branch restores the previous actor state AND surfaces
//      a role="alert" (unchanged from previous sealed save-UI pattern).
//   6. The dead `mutually_visible` field is removed from the entry shape
//      (no stale server-rendered mutual-state leaks into optimistic UI).

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../../..");
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

const CLIENT_SRC = stripComments(
  read(
    "src/app/nex-native/settings/see-my-theme/_contact-list-client.tsx",
  ),
);
const PAGE_SRC = stripComments(
  read("src/app/nex-native/settings/see-my-theme/page.tsx"),
);
const SERVICE_SRC = stripComments(
  read("src/lib/nex-native/relationship-service.ts"),
);

describe("Defect 1 fix · badge reflects effective mutual visibility", () => {
  test("ContactListEntry carries other_shares_theme (needed to compute mutual)", () => {
    expect(CLIENT_SRC).toMatch(
      /readonly\s+other_shares_theme:\s*boolean/,
    );
  });

  test("ContactListEntry no longer carries the stale `mutually_visible` field", () => {
    // `mutually_visible` was dead data in the pre-fix client · it was
    // computed server-side but never consumed, so any optimistic flip
    // of actor_toggle_on would NOT re-derive the badge. Removing it
    // forces the client to compute from (actor_toggle_on &&
    // other_shares_theme) via the live state above.
    expect(CLIENT_SRC).not.toMatch(/readonly\s+mutually_visible:/);
  });

  test("badge is derived from EFFECTIVE visibility, not just actor toggle", () => {
    // The regression this guards: `const badge = isOn ? ... : ...`
    // which silently ignored the other party's state. The sealed shape
    // now reads `isOn && other_shares_theme`.
    expect(CLIENT_SRC).toMatch(
      /const\s+effectivelyVisible\s*=\s*isOn\s*&&\s*e\.other_shares_theme/,
    );
    expect(CLIENT_SRC).toMatch(
      /const\s+badge\s*=\s*effectivelyVisible/,
    );
    // Negative guard · the pre-fix pattern must not reappear.
    expect(CLIENT_SRC).not.toMatch(
      /const\s+badge\s*=\s*isOn\s*\?\s*props\.visibleBadge\s*:\s*props\.hiddenBadge/,
    );
  });

  test("optimistic override map updates ONLY the actor's state (not the other party's)", () => {
    // The override state is keyed by otherId → boolean (the actor's
    // flip). The other party's flag is preserved from server-render.
    expect(CLIENT_SRC).toMatch(
      /setOverrides\(\(prev\)\s*=>\s*\(\{\s*\.\.\.prev,\s*\[otherId\]:\s*next\s*\}\)\)/,
    );
    // Confirm the actor-only override shape · overrides are Record<id, boolean>.
    expect(CLIENT_SRC).toMatch(
      /useState<Record<string,\s*boolean>>\(\{\}\)/,
    );
  });

  test("row carries a data-attribute reflecting effective visibility (observable to tests + a11y)", () => {
    expect(CLIENT_SRC).toContain(
      "data-nex-settings-see-my-theme-effective-visible",
    );
    expect(CLIENT_SRC).toMatch(
      /data-nex-settings-see-my-theme-effective-visible=\{\s*effectivelyVisible\s*\?\s*["']true["']\s*:\s*["']false["']/,
    );
  });

  test("rollback branch is unchanged · restores previous AND surfaces an alert", () => {
    expect(CLIENT_SRC).toMatch(
      /if\s*\(\s*!result\.ok\s*\)[\s\S]{0,300}setOverrides\(\(prev\)\s*=>\s*\(\{\s*\.\.\.prev,\s*\[otherId\]:\s*previous\s*\}\)\)[\s\S]{0,80}setError\(props\.genericError\)/,
    );
    expect(CLIENT_SRC).toMatch(/role\s*=\s*["']alert["']/);
  });
});

describe("Defect 1 fix · server page provides the other-party flag honestly", () => {
  test("page.tsx fetches getOtherToggleState for every friend row", () => {
    expect(PAGE_SRC).toContain("relationshipService.getOtherToggleState");
    // Called with viewer-first argument order, mirroring getActorToggleState.
    expect(PAGE_SRC).toMatch(
      /relationshipService\.getOtherToggleState\([\s\S]{0,80}session\.account\.id[\s\S]{0,40}otherId/,
    );
  });

  test("page.tsx passes other_shares_theme into the ContactListEntry (not mutually_visible)", () => {
    expect(PAGE_SRC).toMatch(/other_shares_theme:\s*otherSharesTheme/);
    // The old mutually_visible field must no longer be passed through.
    expect(PAGE_SRC).not.toMatch(/mutually_visible:\s*mutuallyVisible/);
  });

  test("page.tsx never fabricates the other party's preference", () => {
    // Negative guard · the page must not hard-code the other side's
    // flag to true/false or compute it from unrelated data. The only
    // supplier is `relationshipService.getOtherToggleState`.
    const pageWithoutServiceCall = PAGE_SRC.replace(
      /relationshipService\.getOtherToggleState\([^)]*\)/g,
      "",
    );
    expect(pageWithoutServiceCall).not.toMatch(/other_shares_theme:\s*true\b/);
    expect(pageWithoutServiceCall).not.toMatch(/other_shares_theme:\s*false\b/);
  });
});

describe("Defect 1 fix · service exposes getOtherToggleState as the single source of truth", () => {
  test("relationship-service exports getOtherToggleState", () => {
    expect(SERVICE_SRC).toContain(
      "export async function getOtherToggleState",
    );
  });

  test("getOtherToggleState grandfather-returns TRUE when no row exists (parity with getActorToggleState)", () => {
    const fn = SERVICE_SRC.slice(
      SERVICE_SRC.indexOf("export async function getOtherToggleState"),
      SERVICE_SRC.indexOf(
        "export async function isThemeMutuallyVisibleSafe",
      ),
    );
    expect(fn).toMatch(/if\s*\(!row\)\s*return\s+true/);
  });

  test("getOtherToggleState fail-OPEN to TRUE on read error (never silently hides a theme)", () => {
    const fn = SERVICE_SRC.slice(
      SERVICE_SRC.indexOf("export async function getOtherToggleState"),
      SERVICE_SRC.indexOf(
        "export async function isThemeMutuallyVisibleSafe",
      ),
    );
    expect(fn).toMatch(/catch[\s\S]{0,80}return\s+true/);
  });

  test("getOtherToggleState reads the OPPOSITE canonical side from getActorToggleState", () => {
    const otherFn = SERVICE_SRC.slice(
      SERVICE_SRC.indexOf("export async function getOtherToggleState"),
      SERVICE_SRC.indexOf(
        "export async function isThemeMutuallyVisibleSafe",
      ),
    );
    // Mirror pattern: if actor===x, actor reads a → other reads b. The
    // ternary branches must point to the OPPOSITE columns from the
    // actor function.
    expect(otherFn).toMatch(
      /actor\s*===\s*x\s*\?\s*row\.b_shares_theme\s*:\s*row\.a_shares_theme/,
    );
  });
});
