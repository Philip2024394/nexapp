// src/app/nex-native/search/_country-selector.tsx
//
// Country selector for NEX Discover.
// ----------------------------------
// Horizontal chip row that lets the viewer scope the feed to a
// specific country · "All" is also an option. Each chip shows:
//   · country flag emoji
//   · country name
//   · live canonical count (never fabricated · "0" is shown
//     verbatim for configured-but-empty markets)
//
// Writes `?country=XX` to the URL; the server page in `page.tsx`
// reads it and passes it through to the paginated canonical query.

"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const NEX = {
  pillBg: "#0E1F39",
  pillText: "#B5C3D6",
  activeBg: "#FF7200",
  activeText: "#FFFFFF",
  textSoft: "#6B82A5",
  border: "rgba(255,255,255,0.08)",
};

export interface CountryOption {
  readonly iso: string | null; // null → "All"
  readonly name: string;
  readonly canonicalCount: number;
  readonly includedInProgramme: boolean;
}

export function CountrySelector({
  options,
  activeIso,
}: {
  readonly options: readonly CountryOption[];
  readonly activeIso: string | null;
}): React.JSX.Element {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function selectCountry(iso: string | null): void {
    const next = new URLSearchParams(sp.toString());
    if (iso === null) next.delete("country");
    else next.set("country", iso);
    // Reset to page 1 whenever the country changes.
    next.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Country"
      className="nex-no-scrollbar"
      style={{
        marginTop: 14,
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 2,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {options.map((opt) => {
        const active = (opt.iso ?? "") === (activeIso ?? "");
        const label = opt.iso ?? "ALL";
        const flag = opt.iso ? flagEmoji(opt.iso) : "🌍";
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => selectCountry(opt.iso)}
            style={{
              flex: "0 0 auto",
              padding: "8px 14px",
              borderRadius: 999,
              border: active ? "none" : `1px solid ${NEX.border}`,
              background: active ? NEX.activeBg : NEX.pillBg,
              color: active ? NEX.activeText : NEX.pillText,
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              letterSpacing: "0.01em",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              boxShadow: active ? "0 6px 16px rgba(255,114,0,0.35)" : "none",
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }} aria-hidden>
              {flag}
            </span>
            <span>{opt.name}</span>
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 999,
                background: active
                  ? "rgba(255,255,255,0.25)"
                  : "rgba(255,255,255,0.06)",
                color: active ? NEX.activeText : NEX.textSoft,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0,
              }}
            >
              {opt.canonicalCount.toLocaleString("en-US")}
            </span>
          </button>
        );
      })}
      <style>{`.nex-no-scrollbar::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}

function flagEmoji(iso: string): string {
  if (!/^[a-zA-Z]{2}$/.test(iso)) return "🌐";
  const base = 0x1f1e6;
  const u = iso.toUpperCase();
  return (
    String.fromCodePoint(base + (u.charCodeAt(0) - 65)) +
    String.fromCodePoint(base + (u.charCodeAt(1) - 65))
  );
}
