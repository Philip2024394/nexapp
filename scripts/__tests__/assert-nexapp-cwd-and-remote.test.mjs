// scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs
//
// Unit tests for the nexapp-only dev guard.
//
// Tests inject the git `exec` callable and the `log` sink so no real
// git call is made and no real stderr is written. Real git configuration
// on this machine is NEVER touched by these tests.
//
// Coverage goals:
//   · Strict absolute-path root comparison, not basename-only
//   · Sibling directories named `nexapp` are REJECTED
//   · Hostile remote URL variants are REJECTED by construction
//   · Protocol allowlist (https / ssh-shorthand / ssh-long) is enforced
//   · Embedded userinfo is REJECTED (except literal `git@` for SSH)
//   · Fetch/push URL mismatches at the policy level fail-closed

import { describe, expect, it } from "vitest";
import {
  canonicalisePathForCompare,
  parseRemoteUrl,
  checkCwd,
  checkRemote,
  runAssertion,
  EXPECTED_REPO_ROOT,
  EXPECTED_HOST,
  EXPECTED_REPO_PATH,
  APPROVED_REMOTE_FORMS,
} from "../assert-nexapp-cwd-and-remote.mjs";

// ─── Policy constants ─────────────────────────────────────────────

describe("Policy constants", () => {
  it("hardcoded canonical root is `C:\\\\Users\\\\Victus\\\\nexapp`", () => {
    expect(EXPECTED_REPO_ROOT).toBe("C:\\Users\\Victus\\nexapp");
  });

  it("expected host is `github.com` (lowercase)", () => {
    expect(EXPECTED_HOST).toBe("github.com");
  });

  it("expected repo path is `philip2024394/nexapp` (lowercase)", () => {
    expect(EXPECTED_REPO_PATH).toBe("philip2024394/nexapp");
  });

  it("approved-form whitelist is the three canonical forms, in order", () => {
    expect(APPROVED_REMOTE_FORMS).toEqual([
      "https",
      "ssh-shorthand",
      "ssh-long",
    ]);
  });

  it("approved-form whitelist is frozen · a future refactor cannot silently widen it", () => {
    expect(Object.isFrozen(APPROVED_REMOTE_FORMS)).toBe(true);
  });
});

// ─── canonicalisePathForCompare ───────────────────────────────────

describe("canonicalisePathForCompare", () => {
  it("accepts C:/Users/Victus/nexapp (forward slashes)", () => {
    expect(canonicalisePathForCompare("C:/Users/Victus/nexapp")).toBe(
      "c:/users/victus/nexapp",
    );
  });

  it("accepts C:\\\\Users\\\\Victus\\\\nexapp (backslashes)", () => {
    expect(canonicalisePathForCompare("C:\\Users\\Victus\\nexapp")).toBe(
      "c:/users/victus/nexapp",
    );
  });

  it("strips a trailing single slash", () => {
    expect(canonicalisePathForCompare("C:/Users/Victus/nexapp/")).toBe(
      "c:/users/victus/nexapp",
    );
  });

  it("strips multiple trailing slashes", () => {
    expect(canonicalisePathForCompare("C:/Users/Victus/nexapp//")).toBe(
      "c:/users/victus/nexapp",
    );
  });

  it("normalises `..` and `.` segments", () => {
    expect(
      canonicalisePathForCompare("C:/Users/Victus/foo/../nexapp"),
    ).toBe("c:/users/victus/nexapp");
    expect(canonicalisePathForCompare("C:/Users/./Victus/nexapp")).toBe(
      "c:/users/victus/nexapp",
    );
  });

  it("accepts the git-bash /c/... MINGW form", () => {
    expect(canonicalisePathForCompare("/c/Users/Victus/nexapp")).toBe(
      "c:/users/victus/nexapp",
    );
  });

  it("accepts the git-bash /d/... MINGW form for a non-nexapp path", () => {
    expect(canonicalisePathForCompare("/d/elsewhere")).toBe("d:/elsewhere");
  });

  it("is case-insensitive (Windows filesystem semantics)", () => {
    expect(canonicalisePathForCompare("C:/USERS/VICTUS/NEXAPP")).toBe(
      "c:/users/victus/nexapp",
    );
  });

  it("preserves distinct paths · a different root is NOT nexapp", () => {
    expect(canonicalisePathForCompare("D:/elsewhere")).toBe("d:/elsewhere");
    expect(canonicalisePathForCompare("D:/elsewhere")).not.toBe(
      canonicalisePathForCompare("C:/Users/Victus/nexapp"),
    );
  });

  it("returns empty string for null / undefined / empty / whitespace", () => {
    expect(canonicalisePathForCompare(null)).toBe("");
    expect(canonicalisePathForCompare(undefined)).toBe("");
    expect(canonicalisePathForCompare("")).toBe("");
    expect(canonicalisePathForCompare("   ")).toBe("");
    expect(canonicalisePathForCompare(42)).toBe("");
  });
});

// ─── parseRemoteUrl · approved canonical forms ────────────────────

describe("parseRemoteUrl · approved canonical forms", () => {
  it("accepts canonical HTTPS with .git suffix", () => {
    const r = parseRemoteUrl("https://github.com/Philip2024394/nexapp.git");
    expect(r).not.toBeNull();
    expect(r.form).toBe("https");
    expect(r.host).toBe("github.com");
    expect(r.repoPath).toBe("philip2024394/nexapp");
  });

  it("accepts HTTPS without .git suffix", () => {
    const r = parseRemoteUrl("https://github.com/Philip2024394/nexapp");
    expect(r.form).toBe("https");
    expect(r.repoPath).toBe("philip2024394/nexapp");
  });

  it("accepts HTTPS with trailing slash", () => {
    const r = parseRemoteUrl("https://github.com/Philip2024394/nexapp.git/");
    expect(r.form).toBe("https");
    expect(r.repoPath).toBe("philip2024394/nexapp");
  });

  it("accepts HTTPS case-insensitively (owner/repo normalised to lowercase)", () => {
    const r = parseRemoteUrl("HTTPS://GITHUB.COM/PHILIP2024394/NEXAPP.GIT");
    expect(r.form).toBe("https");
    expect(r.host).toBe("github.com");
    expect(r.repoPath).toBe("philip2024394/nexapp");
  });

  it("accepts canonical SSH shorthand `git@github.com:owner/repo.git`", () => {
    const r = parseRemoteUrl("git@github.com:Philip2024394/nexapp.git");
    expect(r.form).toBe("ssh-shorthand");
    expect(r.host).toBe("github.com");
    expect(r.repoPath).toBe("philip2024394/nexapp");
  });

  it("accepts canonical SSH long form `ssh://git@github.com/owner/repo.git`", () => {
    const r = parseRemoteUrl("ssh://git@github.com/Philip2024394/nexapp.git");
    expect(r.form).toBe("ssh-long");
    expect(r.host).toBe("github.com");
    expect(r.repoPath).toBe("philip2024394/nexapp");
  });

  it("trims leading/trailing whitespace from git-CLI output (newline, spaces)", () => {
    const r1 = parseRemoteUrl("  https://github.com/Philip2024394/nexapp.git\n");
    expect(r1).not.toBeNull();
    expect(r1.form).toBe("https");

    const r2 = parseRemoteUrl("https://github.com/Philip2024394/nexapp.git   ");
    expect(r2.form).toBe("https");
  });

  it("every produced form is a member of APPROVED_REMOTE_FORMS", () => {
    const samples = [
      "https://github.com/Philip2024394/nexapp.git",
      "git@github.com:Philip2024394/nexapp.git",
      "ssh://git@github.com/Philip2024394/nexapp.git",
    ];
    for (const s of samples) {
      const r = parseRemoteUrl(s);
      expect(APPROVED_REMOTE_FORMS).toContain(r.form);
    }
  });
});

// ─── parseRemoteUrl · hostile and malformed input · REJECTS ───────

describe("parseRemoteUrl · hostile and malformed inputs REJECT", () => {
  const rejected = [
    // Protocol policy
    ["http:// (plaintext)", "http://github.com/Philip2024394/nexapp.git"],
    ["git:// (deprecated, no auth)", "git://github.com/Philip2024394/nexapp.git"],
    ["ftp://", "ftp://github.com/Philip2024394/nexapp.git"],
    ["file://", "file:///C:/evil/nexapp.git"],
    ["javascript:", "javascript:alert(1)"],
    ["schemeless //github.com", "//github.com/Philip2024394/nexapp.git"],
    ["triple slash https:///", "https:///github.com/Philip2024394/nexapp.git"],

    // Userinfo policy
    ["userinfo HTTPS (user:pass@)", "https://user:pass@github.com/Philip2024394/nexapp.git"],
    ["userinfo HTTPS (user@)", "https://user@github.com/Philip2024394/nexapp.git"],
    ["ssh:// with non-git user", "ssh://attacker@github.com/Philip2024394/nexapp.git"],
    ["ssh:// shorthand with non-git user", "attacker@github.com:Philip2024394/nexapp.git"],

    // Port policy
    ["ssh:// with explicit port", "ssh://git@github.com:22/Philip2024394/nexapp.git"],
    ["https:// with explicit port", "https://github.com:443/Philip2024394/nexapp.git"],

    // Host-shape attacks
    ["host-prefix attack (evil.github.com)", "https://evil.github.com/Philip2024394/nexapp.git"],
    ["host-suffix attack (github.com.evil.com)", "https://github.com.evil.com/Philip2024394/nexapp.git"],
    ["sibling-path attack (evil.com/github.com/...)", "https://evil.com/github.com/Philip2024394/nexapp.git"],
    ["IPv4 host", "https://192.168.1.1/Philip2024394/nexapp.git"],
    ["Unicode homoglyph host (ɡithub.com)", "https://ɡithub.com/Philip2024394/nexapp.git"],

    // Malformed
    ["double .git.git suffix", "https://github.com/Philip2024394/nexapp.git.git"],
    ["double slash in path", "https://github.com//Philip2024394//nexapp.git"],
    ["empty string", ""],
    ["whitespace only", "   "],
    ["random garbage", "not-a-url"],
    ["path only (no scheme)", "github.com/Philip2024394/nexapp.git"],
  ];

  for (const [label, input] of rejected) {
    it(`REJECTS: ${label}`, () => {
      // Either parseRemoteUrl returns null OR checkRemote reports ok:false.
      // Both branches are REJECT paths; the critical property is that
      // these inputs do NOT survive the end-to-end check.
      expect(checkRemote(input).ok).toBe(false);
    });
  }

  it("REJECTS: non-string input", () => {
    expect(parseRemoteUrl(null)).toBeNull();
    expect(parseRemoteUrl(undefined)).toBeNull();
    expect(parseRemoteUrl(42)).toBeNull();
    expect(parseRemoteUrl({})).toBeNull();
  });
});

// ─── checkCwd · strict root comparison ────────────────────────────

describe("checkCwd · strict root comparison", () => {
  // Approved · canonical absolute path = EXPECTED_REPO_ROOT (modulo
  // win32 normalisation).

  it("ACCEPTS expected root with forward slashes", () => {
    expect(checkCwd("C:/Users/Victus/nexapp").ok).toBe(true);
  });

  it("ACCEPTS expected root with backslashes", () => {
    expect(checkCwd("C:\\Users\\Victus\\nexapp").ok).toBe(true);
  });

  it("ACCEPTS expected root with trailing slash", () => {
    expect(checkCwd("C:/Users/Victus/nexapp/").ok).toBe(true);
  });

  it("ACCEPTS expected root with case variation (Windows is case-insensitive)", () => {
    expect(checkCwd("C:/USERS/VICTUS/NEXAPP").ok).toBe(true);
    expect(checkCwd("c:/users/victus/nexapp").ok).toBe(true);
  });

  it("ACCEPTS the git-bash /c/... POSIX form of the expected root", () => {
    expect(checkCwd("/c/Users/Victus/nexapp").ok).toBe(true);
  });

  it("ACCEPTS expected root with `.` and `..` segments that resolve to it", () => {
    expect(checkCwd("C:/Users/Victus/foo/../nexapp").ok).toBe(true);
  });

  // Rejected · everything that doesn't resolve to the expected root.

  it("REJECTS D:/elsewhere (the legacy monorepo)", () => {
    const r = checkCwd("D:/elsewhere");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("wrong-root");
    expect(r.canonical).toBe("d:/elsewhere");
    expect(r.expected).toBe("c:/users/victus/nexapp");
  });

  it("REJECTS the git-bash /d/elsewhere form", () => {
    expect(checkCwd("/d/elsewhere").ok).toBe(false);
  });

  it("REJECTS a sibling named `nexapp` at a different parent (`C:/evil/nexapp`)", () => {
    const r = checkCwd("C:/evil/nexapp");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("wrong-root");
    expect(r.canonical).toBe("c:/evil/nexapp");
  });

  it("REJECTS a nested fake · `nexapp-backup/nexapp`", () => {
    const r = checkCwd("C:/Users/Victus/nexapp-backup/nexapp");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("wrong-root");
  });

  it("REJECTS an impostor directory with a different basename", () => {
    expect(checkCwd("C:/Users/Victus/nexapp-impostor").ok).toBe(false);
    expect(checkCwd("C:/Users/Victus/nexapp-fork").ok).toBe(false);
  });

  it("REJECTS the parent directory", () => {
    expect(checkCwd("C:/Users/Victus").ok).toBe(false);
  });

  it("REJECTS a subdirectory of the expected root", () => {
    expect(checkCwd("C:/Users/Victus/nexapp/src").ok).toBe(false);
  });

  it("REJECTS a different drive even if the subpath matches", () => {
    expect(checkCwd("D:/Users/Victus/nexapp").ok).toBe(false);
  });

  it("REJECTS empty / non-string / whitespace input", () => {
    expect(checkCwd("").ok).toBe(false);
    expect(checkCwd("   ").ok).toBe(false);
    expect(checkCwd(null).ok).toBe(false);
    expect(checkCwd(undefined).ok).toBe(false);
  });
});

// ─── checkRemote · structured reasons ─────────────────────────────

describe("checkRemote · structured reasons", () => {
  it("ACCEPTS canonical HTTPS", () => {
    const r = checkRemote("https://github.com/Philip2024394/nexapp.git");
    expect(r.ok).toBe(true);
    expect(r.form).toBe("https");
  });

  it("ACCEPTS canonical SSH shorthand", () => {
    const r = checkRemote("git@github.com:Philip2024394/nexapp.git");
    expect(r.ok).toBe(true);
    expect(r.form).toBe("ssh-shorthand");
  });

  it("ACCEPTS canonical SSH long form", () => {
    const r = checkRemote("ssh://git@github.com/Philip2024394/nexapp.git");
    expect(r.ok).toBe(true);
    expect(r.form).toBe("ssh-long");
  });

  it("REJECTS wrong host with `wrong-host` reason", () => {
    const r = checkRemote("https://evil.com/Philip2024394/nexapp.git");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("wrong-host");
    expect(r.actualHost).toBe("evil.com");
    expect(r.expectedHost).toBe("github.com");
  });

  it("REJECTS wrong repo with `wrong-repo` reason", () => {
    const r = checkRemote("https://github.com/Philip2024394/other-repo.git");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("wrong-repo");
    expect(r.actualRepoPath).toBe("philip2024394/other-repo");
    expect(r.expectedRepoPath).toBe("philip2024394/nexapp");
  });

  it("REJECTS wrong owner with `wrong-repo` reason", () => {
    const r = checkRemote("https://github.com/attacker/nexapp.git");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("wrong-repo");
    expect(r.actualRepoPath).toBe("attacker/nexapp");
  });

  it("REJECTS unparseable URL (git://) with `unparseable` reason", () => {
    const r = checkRemote("git://github.com/Philip2024394/nexapp.git");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unparseable");
  });

  it("REJECTS unparseable URL (http://) with `unparseable` reason", () => {
    const r = checkRemote("http://github.com/Philip2024394/nexapp.git");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unparseable");
  });

  it("REJECTS userinfo HTTPS with `unparseable` reason", () => {
    const r = checkRemote("https://user:pass@github.com/Philip2024394/nexapp.git");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unparseable");
  });
});

// ─── runAssertion · integration · mocked exec ─────────────────────

function makeExec(responses) {
  return (cmd, args) => {
    expect(cmd).toBe("git");
    const key = args.join(" ");
    if (!(key in responses)) {
      throw new Error(
        `test-exec received an unmocked git call: git ${key}. Available: ${JSON.stringify(
          Object.keys(responses),
        )}`,
      );
    }
    const value = responses[key];
    if (value instanceof Error) throw value;
    return value;
  };
}

const QUIET_LOG = () => undefined;

describe("runAssertion · green paths", () => {
  it("exits 0 silently with HTTPS fetch + push", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": "https://github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "https://github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(0);
    expect(r.failure).toBeNull();
    expect(r.messages).toEqual([]);
  });

  it("exits 0 with SSH shorthand on both fetch and push", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": "git@github.com:Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "git@github.com:Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(0);
  });

  it("exits 0 with SSH long form", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "ssh://git@github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "ssh://git@github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(0);
  });

  it("exits 0 when `--push` is unsupported · falls back to fetch URL", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": "https://github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin": new Error(
          "fatal: unknown option --push",
        ),
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(0);
    expect(r.failure).toBeNull();
  });

  it("exits 0 when git toplevel comes in git-bash /c/... form", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "/c/Users/Victus/nexapp",
        "remote get-url origin": "https://github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "https://github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(0);
  });

  it("exits 0 when git toplevel comes in Windows backslash form", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:\\Users\\Victus\\nexapp",
        "remote get-url origin": "https://github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "https://github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(0);
  });
});

describe("runAssertion · wrong-root failure modes", () => {
  it("REJECTS: toplevel is D:/elsewhere (legacy monorepo)", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "D:/elsewhere",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-root");
    expect(r.messages.some((m) => m.includes("D:/elsewhere"))).toBe(true);
    expect(
      r.messages.some((m) => m.includes("cd into C:/Users/Victus/nexapp")),
    ).toBe(true);
    expect(
      r.messages.some((m) =>
        m.includes("nex-repository-identity-audit-2026-10-14.md"),
      ),
    ).toBe(true);
  });

  it("REJECTS: toplevel is /d/elsewhere (git-bash form of the legacy monorepo)", () => {
    const r = runAssertion({
      exec: makeExec({ "rev-parse --show-toplevel": "/d/elsewhere" }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-root");
  });

  it("REJECTS: toplevel is C:/evil/nexapp (sibling-dir impostor)", () => {
    const r = runAssertion({
      exec: makeExec({ "rev-parse --show-toplevel": "C:/evil/nexapp" }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-root");
    // Hardening-specific · basename-only would have accepted this. Pin
    // the new behaviour so a regression surfaces.
    expect(r.messages.some((m) => m.includes("c:/evil/nexapp"))).toBe(true);
  });

  it("REJECTS: toplevel is nested impostor C:/Users/Victus/nexapp-backup/nexapp", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp-backup/nexapp",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-root");
  });

  it("REJECTS: different drive letter even if subpath matches", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "D:/Users/Victus/nexapp",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-root");
  });

  it("REJECTS: parent of the expected root", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-root");
  });

  it("REJECTS: subdirectory of the expected root", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp/src",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-root");
  });

  it("REJECTS: no toplevel · git missing or not a repo", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": new Error("fatal: not a git repository"),
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("no-toplevel");
  });
});

describe("runAssertion · wrong-remote failure modes", () => {
  it("REJECTS: no `origin` remote configured", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": new Error("fatal: No such remote 'origin'"),
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("no-remote");
    expect(
      r.messages.some((m) =>
        m.includes(`https://github.com/${EXPECTED_REPO_PATH}.git`),
      ),
    ).toBe(true);
    // All three approved forms should be surfaced to the developer.
    expect(
      r.messages.some((m) => m.includes("git@github.com")),
    ).toBe(true);
    expect(
      r.messages.some((m) => m.includes("ssh://git@github.com")),
    ).toBe(true);
  });

  it("REJECTS: wrong-repo fetch remote", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "https://github.com/Philip2024394/other-repo.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
    expect(r.messages.some((m) => m.includes("wrong-repo"))).toBe(true);
    expect(r.messages.some((m) => m.includes("other-repo"))).toBe(true);
  });

  it("REJECTS: evil host even with correct repo path", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "https://evil.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
    expect(r.messages.some((m) => m.includes("wrong-host"))).toBe(true);
  });

  it("REJECTS: host-prefix attack `evil.github.com`", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "https://evil.github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
  });

  it("REJECTS: host-suffix attack `github.com.evil.com`", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "https://github.com.evil.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
  });

  it("REJECTS: Unicode homoglyph host `ɡithub.com`", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "https://ɡithub.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
  });

  it("REJECTS: IPv4 host even with correct path", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "https://192.168.1.1/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
  });

  it("REJECTS: `http://` plaintext rejected by protocol policy", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "http://github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
    expect(r.messages.some((m) => m.includes("unparseable"))).toBe(true);
  });

  it("REJECTS: `git://` deprecated protocol rejected", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "git://github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
  });

  it("REJECTS: userinfo-embedded HTTPS rejected", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "https://user:pass@github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
  });

  it("REJECTS: ssh:// with non-git user rejected", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "ssh://attacker@github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
  });

  it("REJECTS: ssh:// with explicit port rejected", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "ssh://git@github.com:22/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
  });

  it("REJECTS: empty fetch URL (defence against misconfigured git)", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": "",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-fetch");
  });
});

describe("runAssertion · fetch/push mismatch", () => {
  it("REJECTS: fetch correct, push drifted to a different repo", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": "https://github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "https://github.com/Philip2024394/other-repo.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-push");
    expect(r.messages.some((m) => m.includes("push URL"))).toBe(true);
  });

  it("REJECTS: fetch correct, push drifted to evil host", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": "https://github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "https://evil.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-push");
  });

  it("REJECTS: fetch correct, push uses forbidden protocol (git://)", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": "https://github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "git://github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-push");
  });

  it("REJECTS: fetch correct, push uses userinfo", () => {
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": "https://github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "https://user:pass@github.com/Philip2024394/nexapp.git",
      }),
      log: QUIET_LOG,
    });
    expect(r.exitCode).toBe(1);
    expect(r.failure).toBe("wrong-remote-push");
  });
});

// ─── runAssertion · observability ─────────────────────────────────

describe("runAssertion · observability", () => {
  const scenarios = [
    {
      name: "no-toplevel",
      exec: makeExec({
        "rev-parse --show-toplevel": new Error("not a repo"),
      }),
    },
    {
      name: "wrong-root (D:/elsewhere)",
      exec: makeExec({ "rev-parse --show-toplevel": "D:/elsewhere" }),
    },
    {
      name: "wrong-root (sibling impostor)",
      exec: makeExec({ "rev-parse --show-toplevel": "C:/evil/nexapp" }),
    },
    {
      name: "no-remote",
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": new Error("no origin"),
      }),
    },
    {
      name: "wrong-remote-fetch (other repo)",
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "https://github.com/Philip2024394/other-repo.git",
      }),
    },
    {
      name: "wrong-remote-fetch (http://)",
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "http://github.com/Philip2024394/nexapp.git",
      }),
    },
    {
      name: "wrong-remote-fetch (userinfo)",
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "https://user:pass@github.com/Philip2024394/nexapp.git",
      }),
    },
    {
      name: "wrong-remote-push",
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin":
          "https://github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "https://github.com/attacker/nexapp.git",
      }),
    },
  ];

  for (const s of scenarios) {
    it(`${s.name} · exits 1 with FAIL line and Fix line`, () => {
      const r = runAssertion({ exec: s.exec, log: QUIET_LOG });
      expect(
        r.exitCode,
        `${s.name} must fail-closed with exitCode 1`,
      ).toBe(1);
      expect(
        r.messages.some((m) => m.startsWith("[nexapp-guard] FAIL")),
        `${s.name} must emit a FAIL line`,
      ).toBe(true);
      expect(
        r.messages.some((m) => m.startsWith("[nexapp-guard] Fix")),
        `${s.name} must emit a Fix · line`,
      ).toBe(true);
    });
  }

  it("happy path is silent · no stderr emission at all", () => {
    const captured = [];
    const r = runAssertion({
      exec: makeExec({
        "rev-parse --show-toplevel": "C:/Users/Victus/nexapp",
        "remote get-url origin": "https://github.com/Philip2024394/nexapp.git",
        "remote get-url --push origin":
          "https://github.com/Philip2024394/nexapp.git",
      }),
      log: (m) => captured.push(m),
    });
    expect(r.exitCode).toBe(0);
    expect(captured).toEqual([]);
  });
});
