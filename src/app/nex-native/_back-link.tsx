"use client";

// src/app/nex-native/_back-link.tsx
//
// Shared "← Back" client component · owner directive 2026-11-04 later-
// same-day · "when user selects back button on pages it should divert
// back to last page user was viewing before".
//
// Behaviour:
//   · router.back() goes to the previous entry in browser history
//   · if there is no previous entry (direct entry via URL / bookmark /
//     new tab), falls back to the supplied `fallbackHref` so the user
//     is not stranded
//
// Usage:
//   <BackLink>← Back</BackLink>                        (fallback /contacts)
//   <BackLink fallbackHref="/nex-native/creator/join">← Back to Creator</BackLink>

import { useRouter } from "next/navigation";

interface BackLinkProps {
  readonly children?: React.ReactNode;
  readonly fallbackHref?: string;
  readonly style?: React.CSSProperties;
  readonly className?: string;
  readonly ariaLabel?: string;
}

export function BackLink({
  children = "← Back",
  fallbackHref = "/nex-native/contacts",
  style,
  className,
  ariaLabel,
}: BackLinkProps): React.ReactElement {
  const router = useRouter();

  function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    // Browser history length starts at 1 on direct entry. A length of 1
    // means there is nowhere to go back to within this tab · route to
    // the fallback so the user is not stuck on a bounce page.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? (typeof children === "string" ? children : "Back")}
      data-nex-back-link
      className={className}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        color: "inherit",
        font: "inherit",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
