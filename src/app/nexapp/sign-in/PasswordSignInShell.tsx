"use client";

// NEX password sign-in UI.
//
// Submits to POST /api/nex/sign-in (Supabase auth.signInWithPassword).
// On success, routes to /nexapp so the chat home picks up the fresh
// session from cookies.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Manrope } from "next/font/google";
import { ChevronLeft, Eye, EyeOff, ShieldCheck, ScanFace } from "lucide-react";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const NEX_CYAN = "#00AFFF";
const NEX_ORANGE = "#FF7200";
const NEX_TEXT = "#F2F5F8";
const NEX_MUTED = "#7D9BC0";
const NEX_PANEL_BORDER = "rgba(0, 175, 255, 0.28)";
const NEX_INPUT_BORDER = "rgba(0, 175, 255, 0.22)";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export function PasswordSignInShell() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function validate(): string | null {
    if (!EMAIL_RE.test(email.trim())) return "Enter a valid email.";
    if (password.length < 1) return "Enter your password.";
    return null;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setStatus({ kind: "error", message: v });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/nex/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setStatus({ kind: "error", message: body.error ?? "Could not sign in. Try again." });
        return;
      }
      router.push("/nexapp");
    } catch {
      setStatus({ kind: "error", message: "Network error. Try again." });
    }
  }

  return (
    <main
      className={`${manrope.className} relative min-h-[100dvh] w-full overflow-hidden`}
      style={{ backgroundColor: "#020914", color: NEX_TEXT }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 60% at 50% 0%, rgba(0,175,255,0.06) 0%, transparent 55%), radial-gradient(80% 40% at 50% 100%, rgba(255,114,0,0.04) 0%, transparent 60%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,175,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,175,255,0.4) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)"
        }}
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-6 pb-10 pt-6">
        <button
          type="button"
          onClick={() => router.push("/nexapp/face-sign-in")}
          aria-label="Back to face sign-in"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/[0.04] active:scale-[0.96]"
          style={{ border: `1px solid ${NEX_CYAN}` }}
        >
          <ChevronLeft className="h-4 w-4" style={{ color: NEX_CYAN }} aria-hidden />
        </button>

        <div className="mt-8 flex flex-col items-center">
          <div
            className="flex items-baseline gap-[6px] leading-none"
            style={{ fontWeight: 700, letterSpacing: "0.02em" }}
          >
            <span style={{ color: "#E8ECF2", fontSize: 44 }}>N</span>
            <span style={{ color: "#E8ECF2", fontSize: 44 }}>E</span>
            <span style={{ color: NEX_ORANGE, fontSize: 44 }}>X</span>
          </div>
          <p
            className="mt-2 text-[12px] tracking-[0.14em]"
            style={{ color: NEX_MUTED, fontWeight: 500 }}
          >
            Your world is waiting.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center text-center">
          <h1
            className="text-[26px] leading-[1.15]"
            style={{ color: NEX_TEXT, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Sign in to NEX
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: NEX_MUTED }}>
            Welcome back to your private space.
          </p>
        </div>

        <div
          className="mt-8 rounded-[14px] px-5 pb-4 pt-5"
          style={{
            backgroundColor: "rgba(4, 14, 28, 0.72)",
            border: `1px solid ${NEX_PANEL_BORDER}`
          }}
        >
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <FieldLabel>Email address</FieldLabel>
            <TextInput
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={setEmail}
            />

            <FieldLabel>Password</FieldLabel>
            <div className="relative">
              <TextInput
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={setPassword}
                paddingRight={44}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md transition hover:bg-white/[0.04]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" style={{ color: NEX_CYAN }} aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" style={{ color: NEX_CYAN }} aria-hidden />
                )}
              </button>
            </div>

            {status.kind === "error" && (
              <p className="mt-1 text-[12px]" style={{ color: "#FF8A65" }}>
                {status.message}
              </p>
            )}

            <div
              className="mt-2 flex items-center justify-center gap-2 pt-1 text-[11.5px] tracking-[0.06em]"
              style={{ color: NEX_MUTED }}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              <span>Private. Secure. Only you.</span>
            </div>

            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
              submit
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={() => {
            const form = document.querySelector<HTMLFormElement>("form");
            form?.requestSubmit();
          }}
          disabled={status.kind === "submitting"}
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-[10px] text-[12.5px] tracking-[0.18em] transition active:scale-[0.99] disabled:opacity-60"
          style={{
            backgroundColor: "rgba(255, 114, 0, 0.05)",
            border: `1px solid ${NEX_ORANGE}`,
            color: NEX_ORANGE,
            fontWeight: 600,
            textTransform: "uppercase"
          }}
        >
          {status.kind === "submitting" ? "Signing in…" : "Sign in"}
        </button>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1" style={{ backgroundColor: "rgba(0,175,255,0.22)" }} />
          <span className="text-[11px] tracking-[0.24em]" style={{ color: NEX_CYAN }}>
            OR
          </span>
          <div className="h-px flex-1" style={{ backgroundColor: "rgba(0,175,255,0.22)" }} />
        </div>

        <button
          type="button"
          onClick={() => router.push("/nexapp/face-sign-in")}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] text-[12.5px] tracking-[0.18em] transition active:scale-[0.99]"
          style={{
            backgroundColor: "rgba(0,175,255,0.04)",
            border: `1px solid ${NEX_CYAN}`,
            color: NEX_CYAN,
            fontWeight: 600,
            textTransform: "uppercase"
          }}
        >
          <ScanFace className="h-4 w-4" aria-hidden />
          <span>Sign in with face</span>
        </button>

        <div className="mt-8 flex items-center justify-center gap-1.5 text-[12.5px]">
          <span style={{ color: NEX_MUTED }}>New to NEX?</span>
          <a
            href="/nexapp/welcome"
            className="transition hover:opacity-80"
            style={{ color: NEX_ORANGE, fontWeight: 600 }}
          >
            Create account
          </a>
        </div>
      </div>
    </main>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] tracking-[0.24em]"
      style={{ color: NEX_CYAN, fontWeight: 600, textTransform: "uppercase" }}
    >
      {children}
    </span>
  );
}

function TextInput({
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  paddingRight
}: {
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  paddingRight?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="h-11 w-full rounded-[8px] px-3 text-[13.5px] outline-none transition placeholder:opacity-50"
      style={{
        backgroundColor: "rgba(2, 9, 20, 0.6)",
        color: NEX_TEXT,
        border: `1px solid ${NEX_INPUT_BORDER}`,
        paddingRight: paddingRight ? `${paddingRight}px` : undefined
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = NEX_CYAN;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = NEX_INPUT_BORDER;
      }}
    />
  );
}
