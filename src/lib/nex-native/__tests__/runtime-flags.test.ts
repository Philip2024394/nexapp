// Runtime-flags contract tests · 2026-11-22
//
// Locks the "default-unset = Vercel behavior" invariant so a future edit
// cannot silently change what nexapp does when deployed to Vercel.

import { afterEach, describe, expect, it } from "vitest";
import {
  emailRuntime,
  videoProbeEnabled,
  ocrEnabled,
} from "@/lib/nex-native/runtime-flags";

type FlagName =
  | "NEX_EMAIL_RUNTIME"
  | "NEX_VIDEO_PROBE_ENABLED"
  | "NEX_OCR_ENABLED";

function setFlag(name: FlagName, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function withFlag<T>(name: FlagName, value: string | undefined, fn: () => T): T {
  const prior = process.env[name];
  setFlag(name, value);
  try {
    return fn();
  } finally {
    setFlag(name, prior);
  }
}

afterEach(() => {
  delete process.env.NEX_EMAIL_RUNTIME;
  delete process.env.NEX_VIDEO_PROBE_ENABLED;
  delete process.env.NEX_OCR_ENABLED;
});

describe("emailRuntime()", () => {
  it("defaults to nodemailer when unset", () => {
    withFlag("NEX_EMAIL_RUNTIME", undefined, () => {
      expect(emailRuntime()).toBe("nodemailer");
    });
  });

  it("defaults to nodemailer when empty", () => {
    withFlag("NEX_EMAIL_RUNTIME", "", () => {
      expect(emailRuntime()).toBe("nodemailer");
    });
  });

  it("returns brevo when set to brevo", () => {
    withFlag("NEX_EMAIL_RUNTIME", "brevo", () => {
      expect(emailRuntime()).toBe("brevo");
    });
  });

  it("is case-insensitive", () => {
    withFlag("NEX_EMAIL_RUNTIME", "BREVO", () => {
      expect(emailRuntime()).toBe("brevo");
    });
  });

  it("ignores unknown values and defaults safely", () => {
    withFlag("NEX_EMAIL_RUNTIME", "sendgrid", () => {
      expect(emailRuntime()).toBe("nodemailer");
    });
  });
});

describe("videoProbeEnabled()", () => {
  it("defaults to true when unset (Vercel behavior)", () => {
    withFlag("NEX_VIDEO_PROBE_ENABLED", undefined, () => {
      expect(videoProbeEnabled()).toBe(true);
    });
  });

  it.each(["false", "FALSE", "0", "off", "no"])("returns false for %s", (val) => {
    withFlag("NEX_VIDEO_PROBE_ENABLED", val, () => {
      expect(videoProbeEnabled()).toBe(false);
    });
  });

  it("returns true for true-like values", () => {
    withFlag("NEX_VIDEO_PROBE_ENABLED", "true", () => {
      expect(videoProbeEnabled()).toBe(true);
    });
  });
});

describe("ocrEnabled()", () => {
  it("defaults to true when unset (Vercel behavior)", () => {
    withFlag("NEX_OCR_ENABLED", undefined, () => {
      expect(ocrEnabled()).toBe(true);
    });
  });

  it.each(["false", "0", "off", "no"])("returns false for %s", (val) => {
    withFlag("NEX_OCR_ENABLED", val, () => {
      expect(ocrEnabled()).toBe(false);
    });
  });
});

describe("Vercel-safety invariant", () => {
  it("all three flags default to current Vercel behavior when fully unset", () => {
    delete process.env.NEX_EMAIL_RUNTIME;
    delete process.env.NEX_VIDEO_PROBE_ENABLED;
    delete process.env.NEX_OCR_ENABLED;
    expect(emailRuntime()).toBe("nodemailer");
    expect(videoProbeEnabled()).toBe(true);
    expect(ocrEnabled()).toBe(true);
  });
});
