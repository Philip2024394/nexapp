"use client";

// src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx
//
// Rev 3 guest-shop-enquiry popup · owner-directed 2026-11-28.
// -----------------------------------------------------------------------------
// Replaces the signed-out ShopChatRegistrationPopup for the shop FAB tap path.
// When an anonymous visitor taps the floating chat bubble on a shop page, this
// popup overlays the shop page (shaded backdrop · the "diverted shop chat
// page" visible behind). The visitor fills name / email / optional phone /
// country / message and presses Send. The form submits to
// /api/nex-native/shop-enquiry (Rev 3 email-as-body pathway).
//
// Honesty invariants (align with design doc §4 + §5 + §6.2):
//   · No message body is stored in NEX. Reply goes directly to visitor email.
//   · Phone is optional. Email is required.
//   · Client-side validation mirrors parseShopEnquiryBody exactly · the server
//     is the source of truth, this is just UX. The client NEVER claims a
//     message was sent when the server says 503.
//   · When the server is not ready (503 temporarily_unavailable /
//     endpoint_not_ready · HMAC key not provisioned · mig 372 not applied)
//     the visitor sees an honest "almost ready" message, NOT a false success.
//
// Owner directive 2026-11-28 (second-pass): secondary "Prefer your own NEX
// account? Create one" CTA REMOVED. Phone is now required. Country is a
// dropdown populated from the sealed country catalogue (launch markets
// IE/GB/US/ID/AU float to top).
//
// Auto-create-account on Send (also part of the 2026-11-28 second-pass
// directive) is NOT WIRED in this component. The sealed path to create a
// real NEX account from a public, unauthenticated POST surface is an owner-
// gated engineering decision · see the Rule-9 report for the three
// available paths. The popup still posts the Rev 3 enquiry · the account-
// linkage is deliberately not fabricated client-side.

import * as React from "react";
import { createPortal } from "react-dom";
import {
  EMAIL_SHAPE,
  NAME_MAX,
  MESSAGE_MIN,
  MESSAGE_MAX,
} from "@/lib/nex-native/shop-enquiry/validation";
import { COUNTRY_CATALOGUE_SORTED } from "@/lib/nex-native/country-catalogue";

export interface GuestShopEnquiryPopupProps {
  readonly shopName: string | null;
  readonly shopSlug: string;
  /** UUID · required so the POST body carries shop_business_id. */
  readonly shopBusinessId: string;
  /** Shop accent hex · drives the primary CTA fill. */
  readonly accent: string;
  /** Close handler. Backdrop click, Esc, and the dismiss button all call this. */
  readonly onDismiss: () => void;
  /** Optional POST override for tests. Defaults to real `fetch(...)`. */
  readonly postShopEnquiry?: (body: EnquiryPayload) => Promise<Response>;
}

export interface EnquiryPayload {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly country: string;
  readonly message: string;
  readonly shop_business_id: string;
}

type FormState = "idle" | "sending" | "sent" | "temporarily_unavailable" | "rate_limited" | "duplicate" | "error";

interface FieldErrors {
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly country?: string;
  readonly message?: string;
}

/** Client-side mirror of parseShopEnquiryBody. Kept intentionally simple · the
 *  server is authoritative. This exists so the user gets inline feedback
 *  before making a network round-trip. */
const COUNTRY_CODE_SET: ReadonlySet<string> = new Set(
  COUNTRY_CATALOGUE_SORTED.map((c) => c.code),
);

function localValidate(form: EnquiryPayload): FieldErrors {
  const out: Record<string, string> = {};
  const name = form.name.trim();
  if (name.length < 1 || name.length > NAME_MAX) out.name = "Enter your name (max 80).";
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(name)) out.name = "Name contains invalid characters.";
  const email = form.email.trim();
  if (email.length === 0) out.email = "Email is required.";
  else if (!EMAIL_SHAPE.test(email)) out.email = "That doesn't look like an email address.";
  // Phone is required · owner directive 2026-11-28.
  const rawPhone = form.phone.trim();
  if (rawPhone.length === 0) {
    out.phone = "Phone is required.";
  } else {
    const stripped = form.phone.replace(/[\s-]/g, "");
    if (!/^\+?[1-9]\d{6,14}$/.test(stripped)) out.phone = "Phone must be international format, e.g. +447700900000.";
  }
  // Country must be one of the catalogue codes · the dropdown enforces this
  // but we re-check defensively (users can edit the DOM).
  const country = form.country.trim().toUpperCase();
  if (country.length === 0) {
    out.country = "Choose your country.";
  } else if (!COUNTRY_CODE_SET.has(country)) {
    out.country = "Select a country from the list.";
  }
  const message = form.message.trim();
  if (message.length < MESSAGE_MIN) out.message = `Please write at least ${MESSAGE_MIN} characters.`;
  else if (message.length > MESSAGE_MAX) out.message = `Maximum ${MESSAGE_MAX} characters.`;
  return out as FieldErrors;
}

export function GuestShopEnquiryPopup({
  shopName,
  shopBusinessId,
  accent,
  onDismiss,
  postShopEnquiry,
}: GuestShopEnquiryPopupProps): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  const [form, setForm] = React.useState<EnquiryPayload>({
    name: "",
    phone: "",
    email: "",
    country: "",
    message: "",
    shop_business_id: shopBusinessId,
  });
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [state, setState] = React.useState<FormState>("idle");
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && state !== "sending") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss, state]);

  const shopLabel = shopName?.trim() || "this shop";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (state === "sending") return;
    const localErrors = localValidate(form);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setErrors({});
    setState("sending");
    setServerMessage(null);
    try {
      const doPost = postShopEnquiry
        ? postShopEnquiry
        : (body: EnquiryPayload): Promise<Response> =>
            fetch("/api/nex-native/shop-enquiry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
      const res = await doPost(form);
      if (res.status === 200 || res.status === 202) {
        setState("sent");
        return;
      }
      // Parse error shape honestly · the server returns { error, field?, reason? } on failures.
      type ErrBody = {
        error?: string;
        field?: string;
        reason?: string;
        dry_run?: boolean;
      };
      let errBody: ErrBody | null = null;
      try {
        errBody = (await res.json()) as ErrBody;
      } catch {
        errBody = null;
      }
      if (res.status === 503) {
        setState("temporarily_unavailable");
        setServerMessage(
          errBody?.error === "endpoint_not_ready"
            ? "Shop enquiries are not switched on yet. The shop team has been notified."
            : "The enquiry service is briefly unavailable. Please try again in a moment.",
        );
        return;
      }
      if (res.status === 429) {
        if (errBody?.error === "duplicate") {
          setState("duplicate");
          setServerMessage("You already sent this enquiry a moment ago. Please wait before resending.");
        } else {
          setState("rate_limited");
          setServerMessage("Too many enquiries from here in a short period. Please try again shortly.");
        }
        return;
      }
      if (res.status === 400 && errBody?.field) {
        setErrors({ [errBody.field]: `Invalid: ${errBody.reason ?? "please check this field"}` } as FieldErrors);
        setState("idle");
        return;
      }
      if (res.status === 404 && errBody?.error === "shop_not_found") {
        setState("error");
        setServerMessage("This shop could not be found. Please refresh and try again.");
        return;
      }
      if (res.status === 409) {
        setState("error");
        setServerMessage("This shop isn't accepting new enquiries right now.");
        return;
      }
      setState("error");
      setServerMessage("Could not send your enquiry. Please try again.");
    } catch {
      setState("error");
      setServerMessage("A network error prevented your enquiry from being sent. Please try again.");
    }
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-nex-guest-shop-enquiry-popup
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-guest-enquiry-headline"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 320,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        aria-hidden
        data-nex-guest-enquiry-backdrop
        onClick={state !== "sending" ? onDismiss : undefined}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />
      <section
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          maxHeight: "92dvh",
          overflowY: "auto",
          background: "#FFFFFF",
          color: "#0A1526",
          borderRadius: 18,
          padding: "22px 20px 18px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <h2
          id="nex-guest-enquiry-headline"
          style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "-0.01em" }}
        >
          Message {shopLabel}
        </h2>
        <p
          data-nex-guest-enquiry-honesty
          style={{ margin: "8px 0 14px", fontSize: 12, lineHeight: 1.45, color: "#5A6A7E" }}
        >
          Your message is emailed directly to this shop. Their reply goes to the
          email you give here. NEX does not store the message body.
        </p>

        {state === "sent" ? (
          <SentCard shopLabel={shopLabel} accent={accent} onDismiss={onDismiss} />
        ) : (
          <form onSubmit={onSubmit} data-nex-guest-enquiry-form noValidate>
            <Field
              label="Your name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="e.g. Aoife Byrne"
              error={errors.name}
              disabled={state === "sending"}
              autoComplete="name"
              maxLength={NAME_MAX}
              dataAttr="nex-guest-enquiry-name"
            />
            <Field
              label="Your email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="you@example.com"
              error={errors.email}
              disabled={state === "sending"}
              type="email"
              autoComplete="email"
              dataAttr="nex-guest-enquiry-email"
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              placeholder="+44 7700 900000"
              error={errors.phone}
              disabled={state === "sending"}
              autoComplete="tel"
              dataAttr="nex-guest-enquiry-phone"
            />
            <CountrySelect
              value={form.country}
              onChange={(v) => setForm({ ...form, country: v })}
              error={errors.country}
              disabled={state === "sending"}
            />
            <TextArea
              label="Your message"
              value={form.message}
              onChange={(v) => setForm({ ...form, message: v })}
              placeholder="What would you like to ask about?"
              error={errors.message}
              disabled={state === "sending"}
              dataAttr="nex-guest-enquiry-message"
              maxLength={MESSAGE_MAX}
              minLength={MESSAGE_MIN}
            />

            {serverMessage ? (
              <p
                data-nex-guest-enquiry-server-message
                data-nex-guest-enquiry-state={state}
                role={state === "temporarily_unavailable" || state === "error" ? "alert" : "status"}
                style={{
                  margin: "10px 0 0",
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontSize: 12.5,
                  lineHeight: 1.4,
                  background:
                    state === "temporarily_unavailable"
                      ? "rgba(198,161,91,0.12)"
                      : state === "duplicate"
                        ? "rgba(90,106,126,0.10)"
                        : "rgba(220,65,45,0.08)",
                  color:
                    state === "temporarily_unavailable" ? "#6B4D1F" : state === "duplicate" ? "#3B4A5C" : "#8C1F15",
                }}
              >
                {serverMessage}
              </p>
            ) : null}

            <button
              type="submit"
              data-nex-guest-enquiry-send
              disabled={state === "sending"}
              style={{
                display: "block",
                width: "100%",
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 12,
                background: accent,
                color: "#1A120A",
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textAlign: "center",
                border: "none",
                cursor: state === "sending" ? "progress" : "pointer",
                opacity: state === "sending" ? 0.7 : 1,
                boxShadow: "0 8px 20px rgba(198,161,91,0.25)",
                fontFamily: "inherit",
              }}
            >
              {state === "sending" ? "Sending…" : "Send message"}
            </button>

            <button
              type="button"
              data-nex-guest-enquiry-dismiss
              onClick={onDismiss}
              disabled={state === "sending"}
              style={{
                display: "block",
                margin: "12px auto 0",
                padding: "6px 10px",
                background: "transparent",
                color: "#5A6A7E",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                border: "none",
                cursor: state === "sending" ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Not now
            </button>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}

function CountrySelect(props: {
  readonly value: string;
  readonly onChange: (code: string) => void;
  readonly error?: string;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <label
      style={{ display: "block", margin: "10px 0 0", fontSize: 12, fontWeight: 700, color: "#3B4A5C" }}
    >
      Country
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        autoComplete="country"
        data-nex-field="nex-guest-enquiry-country"
        style={{
          display: "block",
          width: "100%",
          marginTop: 4,
          padding: "10px 12px",
          borderRadius: 10,
          border: props.error
            ? "1px solid rgba(220,65,45,0.6)"
            : "1px solid rgba(10,21,38,0.15)",
          fontSize: 13.5,
          fontFamily: "inherit",
          color: "#0A1526",
          background: "#FFFFFF",
          boxSizing: "border-box",
          appearance: "auto",
        }}
      >
        <option value="">Select your country…</option>
        {COUNTRY_CATALOGUE_SORTED.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.label}
          </option>
        ))}
      </select>
      {props.error ? (
        <span
          data-nex-field-error="nex-guest-enquiry-country"
          style={{ display: "block", marginTop: 4, color: "#8C1F15", fontSize: 11.5, fontWeight: 600 }}
        >
          {props.error}
        </span>
      ) : null}
    </label>
  );
}

function Field(props: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly type?: string;
  readonly autoComplete?: string;
  readonly maxLength?: number;
  readonly dataAttr?: string;
}): React.JSX.Element {
  return (
    <label
      style={{ display: "block", margin: "10px 0 0", fontSize: 12, fontWeight: 700, color: "#3B4A5C" }}
    >
      {props.label}
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
        autoComplete={props.autoComplete}
        maxLength={props.maxLength}
        data-nex-field={props.dataAttr}
        style={{
          display: "block",
          width: "100%",
          marginTop: 4,
          padding: "10px 12px",
          borderRadius: 10,
          border: props.error
            ? "1px solid rgba(220,65,45,0.6)"
            : "1px solid rgba(10,21,38,0.15)",
          fontSize: 13.5,
          fontFamily: "inherit",
          color: "#0A1526",
          background: "#FFFFFF",
          boxSizing: "border-box",
        }}
      />
      {props.error ? (
        <span
          data-nex-field-error={props.dataAttr}
          style={{ display: "block", marginTop: 4, color: "#8C1F15", fontSize: 11.5, fontWeight: 600 }}
        >
          {props.error}
        </span>
      ) : null}
    </label>
  );
}

function TextArea(props: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly dataAttr?: string;
  readonly maxLength?: number;
  readonly minLength?: number;
}): React.JSX.Element {
  return (
    <label
      style={{ display: "block", margin: "10px 0 0", fontSize: 12, fontWeight: 700, color: "#3B4A5C" }}
    >
      {props.label}
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
        maxLength={props.maxLength}
        data-nex-field={props.dataAttr}
        rows={5}
        style={{
          display: "block",
          width: "100%",
          marginTop: 4,
          padding: "10px 12px",
          borderRadius: 10,
          border: props.error
            ? "1px solid rgba(220,65,45,0.6)"
            : "1px solid rgba(10,21,38,0.15)",
          fontSize: 13.5,
          fontFamily: "inherit",
          color: "#0A1526",
          background: "#FFFFFF",
          boxSizing: "border-box",
          resize: "vertical",
          minHeight: 110,
        }}
      />
      <span
        {...(props.error ? { "data-nex-field-error": props.dataAttr } : {})}
        style={{
          display: "block",
          marginTop: 4,
          color: props.error ? "#8C1F15" : "#5A6A7E",
          fontSize: 11.5,
          fontWeight: 600,
        }}
      >
        {props.error ?? `${props.value.trim().length} / ${props.maxLength ?? MESSAGE_MAX} · minimum ${props.minLength ?? MESSAGE_MIN}`}
      </span>
    </label>
  );
}

function SentCard({
  shopLabel,
  accent,
  onDismiss,
}: {
  readonly shopLabel: string;
  readonly accent: string;
  readonly onDismiss: () => void;
}): React.JSX.Element {
  return (
    <div data-nex-guest-enquiry-sent>
      <p
        style={{
          margin: "8px 0 14px",
          fontSize: 13.5,
          lineHeight: 1.45,
          color: "#0A1526",
        }}
      >
        Your message has been emailed to <strong>{shopLabel}</strong>. Their reply
        will land directly in the email inbox you gave here.
      </p>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 11.5,
          lineHeight: 1.45,
          color: "#5A6A7E",
        }}
      >
        NEX does not store the content of your message or the shop's reply.
      </p>
      <button
        type="button"
        data-nex-guest-enquiry-sent-close
        onClick={onDismiss}
        style={{
          display: "block",
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          background: accent,
          color: "#1A120A",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textAlign: "center",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Done
      </button>
    </div>
  );
}
