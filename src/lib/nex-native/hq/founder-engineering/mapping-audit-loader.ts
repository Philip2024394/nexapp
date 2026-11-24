// src/lib/nex-native/hq/founder-engineering/mapping-audit-loader.ts
//
// Server-only loader for the Founder Engineering Mapping Audit document.
// Owner-authorised 2026-11-24 · HQ audit viewer.
//
// DOCTRINE:
//   · This module is the ONLY path by which the HQ viewer page reads
//     the audit source. The Markdown file at AUDIT_DOC_RELPATH is the
//     source of truth · this loader must never invent, rewrite or
//     paraphrase content.
//   · Failure modes return a typed error, never a fallback body. If
//     the file cannot be read the HQ page MUST render an honest "could
//     not load the audit" state, not a cached/invented version.
//   · Parsing is deliberately minimal · it only splits the document
//     into a sequence of `## N · Title` sections so the page can
//     offer a table of contents and jump anchors. Section bodies
//     remain raw Markdown · the HQ page renders them with a tightly
//     scoped Markdown subset renderer (`_markdown.tsx`).

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const AUDIT_DOC_RELPATH =
  "docs/doctrine/nex-founder-mapping-audit-2026-11-24.md";

/** One top-level section of the audit · everything under a `## ` heading. */
export interface ParsedSection {
  /** URL-safe anchor id derived from the heading. */
  readonly id: string;
  /** The leading number (e.g. "3") when the heading is "## 3 · Title". */
  readonly number: string | null;
  /** The heading text without its leading `## ` or number. */
  readonly title: string;
  /** Raw Markdown of the section body · excluding the heading line. */
  readonly body: string;
}

export interface ParsedAudit {
  /** H1 title (first `# ` line) · empty string if the doc lacks one. */
  readonly title: string;
  /** Lines between the H1 and the first `## ` section · raw Markdown. */
  readonly preamble: string;
  /** Ordered list of parsed sections. */
  readonly sections: readonly ParsedSection[];
  /** Full raw document · for the "download / view source" affordance. */
  readonly raw: string;
  /** Approximate character count · surfaced as a quality signal. */
  readonly rawChars: number;
}

export type LoadResult =
  | {
      readonly ok: true;
      readonly audit: ParsedAudit;
      readonly relativePath: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly relativePath: string;
    };

/**
 * Read + parse the Mapping Audit Markdown document. Returns a typed
 * result · callers MUST handle the `ok: false` branch and show an
 * honest error rather than fabricating audit content.
 */
export async function loadMappingAudit(): Promise<LoadResult> {
  const abs = path.join(process.cwd(), AUDIT_DOC_RELPATH);
  let raw: string;
  try {
    raw = await readFile(abs, "utf8");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown filesystem error";
    return {
      ok: false,
      reason: `Could not read audit document: ${message}`,
      relativePath: AUDIT_DOC_RELPATH,
    };
  }
  if (!raw || raw.trim().length === 0) {
    return {
      ok: false,
      reason: "Audit document is empty",
      relativePath: AUDIT_DOC_RELPATH,
    };
  }
  try {
    const audit = parseAudit(raw);
    return { ok: true, audit, relativePath: AUDIT_DOC_RELPATH };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown parse error";
    return {
      ok: false,
      reason: `Could not parse audit document: ${message}`,
      relativePath: AUDIT_DOC_RELPATH,
    };
  }
}

// ──────────────────────────────────────────────────────────────────
// Parser · minimal · deterministic · does not mutate content

function parseAudit(raw: string): ParsedAudit {
  const normalised = raw.replace(/\r\n/g, "\n");
  const lines = normalised.split("\n");

  let title = "";
  let cursor = 0;

  // Find the H1.
  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? "";
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      title = line.slice(2).trim();
      cursor += 1;
      break;
    }
  }

  // Preamble = everything up to the first `## ` section.
  const preambleLines: string[] = [];
  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? "";
    if (line.startsWith("## ")) break;
    preambleLines.push(line);
  }
  const preamble = preambleLines.join("\n").trim();

  // Section split · each heading line opens a new section.
  const sections: ParsedSection[] = [];
  let current: {
    heading: string;
    bodyLines: string[];
  } | null = null;
  const flush = (): void => {
    if (!current) return;
    const parsed = parseSectionHeading(current.heading);
    sections.push({
      id: parsed.id,
      number: parsed.number,
      title: parsed.title,
      body: current.bodyLines.join("\n").trim(),
    });
    current = null;
  };

  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? "";
    if (line.startsWith("## ")) {
      flush();
      current = { heading: line.slice(3).trim(), bodyLines: [] };
    } else {
      if (!current) continue;
      current.bodyLines.push(line);
    }
  }
  flush();

  return {
    title,
    preamble,
    sections,
    raw: normalised,
    rawChars: normalised.length,
  };
}

/** Parse "N · Title" or just "Title" into number + title + anchor id. */
function parseSectionHeading(
  heading: string,
): { readonly number: string | null; readonly title: string; readonly id: string } {
  // Matches "3 · Title" or "10 · Title" · dash separator also accepted.
  const m = heading.match(/^([0-9]+)\s*(?:·|-|–)\s*(.+)$/);
  let number: string | null = null;
  let title = heading;
  if (m) {
    number = m[1] ?? null;
    title = (m[2] ?? heading).trim();
  }
  return { number, title, id: slugify(heading) };
}

function slugify(input: string): string {
  return (
    "sec-" +
    input
      .toLowerCase()
      .replace(/[·–]/g, "-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
  );
}
