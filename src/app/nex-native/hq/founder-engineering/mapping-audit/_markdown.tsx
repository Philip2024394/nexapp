// src/app/nex-native/hq/founder-engineering/mapping-audit/_markdown.tsx
//
// Tightly-scoped Markdown subset renderer for the Mapping Audit
// viewer. Owner-authorised 2026-11-24 · HQ audit viewer.
//
// DOCTRINE:
//   · This component renders ONLY the Markdown constructs actually
//     used by `docs/doctrine/nex-founder-mapping-audit-2026-11-24.md`.
//     It is deliberately not a general-purpose Markdown renderer ·
//     unsupported constructs degrade to plain text.
//   · Server component · no client JS · no external dependencies.
//     This keeps the HQ bundle lean and avoids introducing a
//     Markdown parser as a persistent project dep.
//   · The component NEVER re-authors or paraphrases content. It
//     transforms the raw Markdown into React elements without
//     mutating the text.
//
// Supported subset (observed in the audit document):
//   · Paragraphs
//   · `### ` and `#### ` subheadings
//   · Bulleted lists (`- `)
//   · Numbered lists (`1. `, `2. `, …)
//   · Tables (`| col | col |` with `|---|---|` separator row)
//   · Blockquotes (`> `)
//   · Horizontal rules (`---`)
//   · Inline: `**bold**`, `*italic*`, `` `code` ``
//
// Note: the loader already splits the document into top-level
// sections at the `## ` level, so this renderer never encounters
// an `h2` · the lowest heading level it needs to handle is `h3`.

import * as React from "react";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#16D66B";
const CODE_BG = "rgba(22,214,107,0.08)";
const CODE_BORDER = "rgba(22,214,107,0.22)";
const BORDER = "rgba(22,214,107,0.18)";
const BORDER_HI = "rgba(22,214,107,0.32)";
const QUOTE_BORDER = "rgba(22,214,107,0.55)";
const TABLE_ROW_ALT = "rgba(22,214,107,0.04)";

export function MappingAuditMarkdown({
  source,
}: {
  readonly source: string;
}): React.JSX.Element {
  const blocks = tokeniseBlocks(source);
  return (
    <div
      style={{
        fontSize: 14,
        lineHeight: 1.7,
        color: INK_DIM,
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Block model

type Block =
  | { readonly kind: "heading"; readonly level: 3 | 4; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "bullets"; readonly items: readonly string[] }
  | {
      readonly kind: "numbered";
      readonly items: readonly { readonly marker: string; readonly text: string }[];
    }
  | {
      readonly kind: "table";
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | { readonly kind: "blockquote"; readonly text: string }
  | { readonly kind: "hr" };

function tokeniseBlocks(raw: string): readonly Block[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    // Skip blank lines between blocks.
    if (line.trim().length === 0) {
      i += 1;
      continue;
    }
    // Horizontal rule.
    if (/^-{3,}\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }
    // Headings · h3/h4 only (the loader already consumed `## `).
    if (line.startsWith("#### ")) {
      blocks.push({ kind: "heading", level: 4, text: line.slice(5).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ kind: "heading", level: 3, text: line.slice(4).trim() });
      i += 1;
      continue;
    }
    // Blockquote · consume contiguous `> ` lines.
    if (line.startsWith("> ") || line === ">") {
      const quoteLines: string[] = [];
      while (
        i < lines.length &&
        ((lines[i] ?? "").startsWith("> ") || (lines[i] ?? "") === ">")
      ) {
        const l = lines[i] ?? "";
        quoteLines.push(l === ">" ? "" : l.slice(2));
        i += 1;
      }
      blocks.push({ kind: "blockquote", text: quoteLines.join("\n").trim() });
      continue;
    }
    // Table · header row looks like `| a | b |` followed by `|---|---|`.
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? "")) {
      const headers = splitTableRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i] ?? "")) {
        rows.push(splitTableRow(lines[i] ?? ""));
        i += 1;
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }
    // Bulleted list · contiguous `- ` prefixed lines.
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("- ")) {
        items.push((lines[i] ?? "").slice(2));
        // allow simple hanging-indent continuation (two-space prefix)
        let j = i + 1;
        while (
          j < lines.length &&
          /^ {2,}\S/.test(lines[j] ?? "") &&
          !(lines[j] ?? "").startsWith("- ")
        ) {
          items[items.length - 1] += " " + (lines[j] ?? "").trim();
          j += 1;
        }
        i = j;
      }
      blocks.push({ kind: "bullets", items });
      continue;
    }
    // Numbered list · contiguous `N. ` prefixed lines.
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const items: { marker: string; text: string }[] = [];
      while (true) {
        const curr = lines[i] ?? "";
        const m = curr.match(/^(\d+)\.\s+(.*)$/);
        if (!m) break;
        items.push({ marker: m[1] ?? "", text: m[2] ?? "" });
        let j = i + 1;
        while (
          j < lines.length &&
          /^ {2,}\S/.test(lines[j] ?? "") &&
          !/^\d+\.\s+/.test(lines[j] ?? "")
        ) {
          items[items.length - 1].text += " " + (lines[j] ?? "").trim();
          j += 1;
        }
        i = j;
      }
      blocks.push({ kind: "numbered", items });
      continue;
    }
    // Paragraph · gather until blank line or block-starting prefix.
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? "";
      if (
        l.trim().length === 0 ||
        l.startsWith("### ") ||
        l.startsWith("#### ") ||
        l.startsWith("- ") ||
        /^\d+\.\s+/.test(l) ||
        /^-{3,}\s*$/.test(l) ||
        l.startsWith("> ") ||
        l === ">" ||
        (isTableRow(l) && isTableSeparator(lines[i + 1] ?? ""))
      ) {
        break;
      }
      paraLines.push(l);
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push({ kind: "paragraph", text: paraLines.join(" ").trim() });
    }
  }
  return blocks;
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  return trimmed.includes("|", 1);
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  const cells = trimmed.slice(1, -1).split("|");
  return cells.every((c) => /^\s*:?-{1,}:?\s*$/.test(c));
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().slice(1, -1); // strip leading/trailing |
  return trimmed.split("|").map((c) => c.trim());
}

// ──────────────────────────────────────────────────────────────────
// Block renderers

function BlockView({ block }: { readonly block: Block }): React.JSX.Element {
  switch (block.kind) {
    case "heading":
      return <Heading level={block.level} text={block.text} />;
    case "paragraph":
      return (
        <p style={{ margin: "0 0 14px" }}>
          <Inline source={block.text} />
        </p>
      );
    case "bullets":
      return (
        <ul
          style={{
            margin: "0 0 14px",
            paddingLeft: 22,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline source={item} />
            </li>
          ))}
        </ul>
      );
    case "numbered":
      return (
        <ol
          style={{
            margin: "0 0 14px",
            paddingLeft: 22,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {block.items.map((item, i) => (
            <li key={i} value={Number(item.marker) || undefined}>
              <Inline source={item.text} />
            </li>
          ))}
        </ol>
      );
    case "blockquote":
      return (
        <blockquote
          style={{
            margin: "0 0 14px",
            padding: "10px 14px",
            borderLeft: `3px solid ${QUOTE_BORDER}`,
            background: CODE_BG,
            color: INK,
            fontStyle: "italic",
          }}
        >
          <Inline source={block.text} />
        </blockquote>
      );
    case "hr":
      return (
        <hr
          style={{
            border: "none",
            borderTop: `1px solid ${BORDER}`,
            margin: "18px 0",
          }}
        />
      );
    case "table":
      return (
        <TableView headers={block.headers} rows={block.rows} />
      );
  }
}

function Heading({
  level,
  text,
}: {
  readonly level: 3 | 4;
  readonly text: string;
}): React.JSX.Element {
  if (level === 3) {
    return (
      <h3
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: INK,
          margin: "22px 0 10px",
          letterSpacing: "0.01em",
        }}
      >
        <Inline source={text} />
      </h3>
    );
  }
  return (
    <h4
      style={{
        fontSize: 15,
        fontWeight: 800,
        color: INK,
        margin: "18px 0 8px",
        letterSpacing: "0.01em",
      }}
    >
      <Inline source={text} />
    </h4>
  );
}

function TableView({
  headers,
  rows,
}: {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}): React.JSX.Element {
  return (
    <div
      style={{
        margin: "0 0 18px",
        overflowX: "auto",
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  color: INK,
                  fontWeight: 800,
                  background: "rgba(22,214,107,0.10)",
                  borderBottom: `1px solid ${BORDER_HI}`,
                  whiteSpace: "nowrap",
                }}
              >
                <Inline source={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{
                background: ri % 2 === 1 ? TABLE_ROW_ALT : "transparent",
              }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "9px 12px",
                    verticalAlign: "top",
                    borderBottom:
                      ri === rows.length - 1 ? "none" : `1px solid ${BORDER}`,
                    color: INK_DIM,
                  }}
                >
                  <Inline source={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Inline tokeniser · handles **bold**, *italic*, `code` without
// requiring a general-purpose Markdown library.

function Inline({ source }: { readonly source: string }): React.JSX.Element {
  const nodes = tokeniseInline(source);
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.kind) {
          case "text":
            return <React.Fragment key={i}>{n.text}</React.Fragment>;
          case "bold":
            return (
              <strong key={i} style={{ color: INK, fontWeight: 800 }}>
                {n.text}
              </strong>
            );
          case "italic":
            return (
              <em key={i} style={{ color: INK_DIM }}>
                {n.text}
              </em>
            );
          case "code":
            return (
              <code
                key={i}
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: "0.92em",
                  padding: "1px 6px",
                  borderRadius: 5,
                  background: CODE_BG,
                  border: `1px solid ${CODE_BORDER}`,
                  color: ACCENT,
                }}
              >
                {n.text}
              </code>
            );
        }
      })}
    </>
  );
}

type InlineNode =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "bold"; readonly text: string }
  | { readonly kind: "italic"; readonly text: string }
  | { readonly kind: "code"; readonly text: string };

function tokeniseInline(src: string): readonly InlineNode[] {
  const out: InlineNode[] = [];
  let i = 0;
  let buffer = "";
  const flush = (): void => {
    if (buffer.length > 0) {
      out.push({ kind: "text", text: buffer });
      buffer = "";
    }
  };
  while (i < src.length) {
    const ch = src[i];
    // Inline code · backticks.
    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) {
        flush();
        out.push({ kind: "code", text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // Bold · `**text**`.
    if (ch === "*" && src[i + 1] === "*") {
      const end = src.indexOf("**", i + 2);
      if (end > i + 1) {
        flush();
        out.push({ kind: "bold", text: src.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    // Italic · `*text*` (single asterisk, non-greedy).
    if (ch === "*") {
      const end = src.indexOf("*", i + 1);
      if (end > i && src[end - 1] !== " " && src[i + 1] !== " ") {
        flush();
        out.push({ kind: "italic", text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    buffer += ch ?? "";
    i += 1;
  }
  flush();
  return out;
}
