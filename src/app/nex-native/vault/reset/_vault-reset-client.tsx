"use client";

// src/app/nex-native/vault/reset/_vault-reset-client.tsx
//
// Phase 3 · consumes the reset token from the URL on mount. Shows four
// honest states: (1) no token · owner arrived without the email link,
// (2) consuming · in-flight, (3) success · lockout cleared and 3 fresh
// attempts available, (4) error · displays the specific failure reason
// and the next sensible action.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NEX, GLASS } from "../home/_palette";

type State =
  | { kind: "no_token" }
  | { kind: "consuming" }
  | { kind: "success" }
  | { kind: "error"; code: string; httpStatus: number };

export function VaultResetClient({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(
    token ? { kind: "consuming" } : { kind: "no_token" },
  );
  const consumedRef = useRef(false);

  const consume = useCallback(async () => {
    if (!token || consumedRef.current) return;
    consumedRef.current = true;
    setState({ kind: "consuming" });
    try {
      const res = await fetch("/api/nex-native/vault/escrow/reset-confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && body.ok) {
        setState({ kind: "success" });
        return;
      }
      setState({
        kind: "error",
        code: body.error ?? "unknown_error",
        httpStatus: res.status,
      });
    } catch {
      setState({ kind: "error", code: "network_error", httpStatus: 0 });
    }
  }, [token]);

  useEffect(() => {
    void consume();
  }, [consume]);

  if (state.kind === "no_token") {
    return (
      <Shell tone="info" data-nex-vault-reset-page="no-token">
        <Headline>Missing reset link</Headline>
        <Body>
          This page expects a reset token in the URL. Open the email we
          sent when you tapped <em>Reset Vault PIN</em> and use the link
          there, or start a new reset from the Vault doorway.
        </Body>
        <PrimaryLink href="/nex-native/vault">Back to Vault</PrimaryLink>
      </Shell>
    );
  }

  if (state.kind === "consuming") {
    return (
      <Shell tone="info" data-nex-vault-reset-page="consuming">
        <Headline>Restoring your attempts…</Headline>
        <Body>Verifying the reset token. This takes a moment.</Body>
      </Shell>
    );
  }

  if (state.kind === "success") {
    return (
      <Shell tone="success" data-nex-vault-reset-page="success">
        <Headline>Lockout cleared</Headline>
        <Body>
          You now have 3 fresh attempts to enter your Vault PIN. Head
          back to the Vault doorway and sign in as usual. Your existing
          PIN still works · this reset did not change it.
        </Body>
        <PrimaryLink href="/nex-native/vault" dataAttr="nex-vault-reset-back-to-vault">
          Open Vault
        </PrimaryLink>
      </Shell>
    );
  }

  // Error state · distinguish the known failure codes so the owner
  // sees a precise next action.
  const errorCopy = resolveErrorCopy(state.code, state.httpStatus);
  return (
    <Shell tone="error" data-nex-vault-reset-page="error" data-nex-reset-error-code={state.code}>
      <Headline>{errorCopy.title}</Headline>
      <Body>{errorCopy.body}</Body>
      <PrimaryLink href="/nex-native/vault">Back to Vault</PrimaryLink>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

function resolveErrorCopy(code: string, httpStatus: number): { title: string; body: string } {
  switch (code) {
    case "token_malformed":
      return {
        title: "Reset link is unreadable",
        body:
          "The link appears truncated or corrupted. Copy the full URL from the email, or request a new reset from the Vault doorway.",
      };
    case "token_not_found":
      return {
        title: "Reset link not recognised",
        body:
          "This token doesn't match any outstanding reset request. If you issued multiple reset emails, only the most recent one is valid.",
      };
    case "token_consumed":
      return {
        title: "Reset link already used",
        body:
          "This link was already consumed. Each reset link is one-shot. If you still need to clear the lockout, request a new email from the Vault doorway.",
      };
    case "token_expired":
      return {
        title: "Reset link expired",
        body:
          "Reset links are valid for 30 minutes. Request a new one from the Vault doorway.",
      };
    case "token_account_mismatch":
      return {
        title: "Wrong signed-in account",
        body:
          "This reset link was issued for a different NEX account than the one currently signed in. Sign in with the account that received the email, then try again.",
      };
    case "lockout_cycle_mismatch":
      return {
        title: "Lockout state has moved on",
        body:
          "The account entered a new lockout cycle after this link was issued. Request a fresh reset from the Vault doorway.",
      };
    case "not_currently_locked":
      return {
        title: "Nothing to reset",
        body:
          "The Vault is no longer locked · the counter was cleared another way. Head back to the Vault doorway and sign in.",
      };
    case "not_signed_in":
      return {
        title: "Signed-in account required",
        body:
          "Sign in to the NEX account that received the reset email, then open the link again.",
      };
    case "missing_token":
      return {
        title: "No token in request",
        body:
          "The request was missing the reset token. Open the link from the email verbatim.",
      };
    case "network_error":
      return {
        title: "Network problem",
        body:
          "Couldn't reach the reset server. Check your connection and try opening the link again.",
      };
    default:
      return {
        title: "Reset failed",
        body: `An unexpected error occurred (HTTP ${httpStatus || "offline"} · ${code}). Try the link again or request a new reset.`,
      };
  }
}

// ---------------------------------------------------------------------------

function Shell(props: {
  children: React.ReactNode;
  tone: "info" | "success" | "error";
  "data-nex-vault-reset-page": string;
  "data-nex-reset-error-code"?: string;
}) {
  const accent =
    props.tone === "success"
      ? NEX.secure
      : props.tone === "error"
        ? "#FFB3BC"
        : NEX.textSecondary;
  return (
    <section
      {...{ "data-nex-vault-reset-page": props["data-nex-vault-reset-page"] }}
      data-nex-reset-error-code={props["data-nex-reset-error-code"]}
      style={{
        ...GLASS,
        padding: "22px 20px 20px",
        borderRadius: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        borderColor: accent,
      }}
    >
      {props.children}
    </section>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        fontSize: 18,
        fontWeight: 800,
        color: NEX.textPrimary,
      }}
    >
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: NEX.textSecondary }}>
      {children}
    </p>
  );
}

function PrimaryLink({
  href,
  children,
  dataAttr,
}: {
  href: string;
  children: React.ReactNode;
  dataAttr?: string;
}) {
  return (
    <Link
      href={href}
      data-nex-attr={dataAttr}
      style={{
        alignSelf: "flex-start",
        padding: "10px 18px",
        borderRadius: 999,
        background: NEX.accent,
        color: "#FFFFFF",
        textDecoration: "none",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </Link>
  );
}
