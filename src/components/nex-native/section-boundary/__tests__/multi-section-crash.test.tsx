// @vitest-environment jsdom
//
// src/components/nex-native/section-boundary/__tests__/multi-section-crash.test.tsx
//
// A22 · Scenario 8 · Multiple sections fail simultaneously.
// ---------------------------------------------------------
// Two sibling SectionBoundary wraps crash in the SAME render pass.
// Each must:
//   · render its OWN fallback independently (no cascade)
//   · fire its OWN /api/nex-native/incident/section-error POST, each
//     carrying the correct IncidentScope
//   · leave the surrounding chrome interactive

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

import { SectionBoundary } from "../SectionBoundary";

function Boom(): React.JSX.Element {
  throw new Error("induced crash from Boom · should never reach fallback text");
}

describe("Scenario 8 · multi-section simultaneous failure", () => {
  const originalError = console.error;
  const fetchCalls: Array<{ url: string; body: unknown }> = [];

  beforeEach(() => {
    fetchCalls.length = 0;
    // React logs the caught error noisily · silence just for these tests.
    console.error = (() => {}) as typeof console.error;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const href = typeof url === "string" ? url : url.toString();
        let parsed: unknown = null;
        if (typeof init?.body === "string") {
          try {
            parsed = JSON.parse(init.body);
          } catch {
            parsed = init.body;
          }
        }
        fetchCalls.push({ url: href, body: parsed });
        return new Response("{}", { status: 200 });
      },
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    console.error = originalError;
    vi.restoreAllMocks();
  });

  it(
    "two sibling boundaries crash in the same pass · independent fallbacks, two incident POSTs with distinct scopes, chrome still intact",
    async () => {
      const { container, getAllByRole } = render(
        <div data-testid="root-chrome" aria-label="root chrome stays interactive">
          <span data-testid="chrome-link">chrome-ok</span>
          <SectionBoundary section="chat">
            <Boom />
          </SectionBoundary>
          <SectionBoundary section="shops">
            <Boom />
          </SectionBoundary>
          <p data-testid="sibling-text">sibling content outside boundaries stays mounted</p>
        </div>,
      );

      // Both fallbacks mounted independently
      const statuses = getAllByRole("status");
      expect(statuses.length).toBe(2);
      expect(container.textContent).toContain("Chat temporarily unavailable");
      expect(container.textContent).toContain("Shops temporarily unavailable");

      // Root chrome still interactive · the sibling outside both
      // boundaries is unaffected (no cascade to root error.tsx)
      const chromeLink = container.querySelector('[data-testid="chrome-link"]');
      expect(chromeLink?.textContent).toBe("chrome-ok");
      const sibling = container.querySelector('[data-testid="sibling-text"]');
      expect(sibling?.textContent).toContain("sibling content outside boundaries stays mounted");

      // Exactly two POSTs to the section-error endpoint, each with the
      // correct section scope. Fire-and-forget runs on componentDidCatch.
      // Give the microtask queue a tick.
      await Promise.resolve();
      await Promise.resolve();

      const incidentCalls = fetchCalls.filter((c) =>
        c.url.includes("/api/nex-native/incident/section-error"),
      );
      expect(incidentCalls.length).toBe(2);
      const scopes = incidentCalls
        .map((c) => (c.body as { section?: string } | null)?.section)
        .sort();
      expect(scopes).toEqual(["chat", "shops"]);

      // Payload shape · only { section, message_short } · never stack
      for (const c of incidentCalls) {
        const body = c.body as Record<string, unknown>;
        expect(Object.keys(body).sort()).toEqual(["message_short", "section"]);
        expect(typeof body.message_short).toBe("string");
        expect(String(body.message_short)).not.toContain("at Boom");
      }
    },
  );

  it(
    "retry button on one fallback re-mounts only that section · the other's fallback stays up",
    async () => {
      // A toggle so the first boundary can "recover" when retried.
      let firstCrashes = true;
      function MaybeBoom(): React.JSX.Element {
        if (firstCrashes) throw new Error("first crash");
        return <span data-testid="chat-recovered">Chat recovered</span>;
      }

      const { container, getAllByRole } = render(
        <div>
          <SectionBoundary section="chat">
            <MaybeBoom />
          </SectionBoundary>
          <SectionBoundary section="shops">
            <Boom />
          </SectionBoundary>
        </div>,
      );
      // Both fallbacks shown
      expect(getAllByRole("status").length).toBe(2);

      // Flip the first section to recover on retry
      firstCrashes = false;
      // Click the "Try again" button INSIDE the chat fallback (first one in DOM order)
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      fireEvent.click(buttons[0]!);

      // Chat section now shows the recovered content; shops still crashed
      expect(container.textContent).toContain("Chat recovered");
      expect(container.textContent).toContain("Shops temporarily unavailable");
      // And exactly one fallback remains
      expect(getAllByRole("status").length).toBe(1);
    },
  );
});
