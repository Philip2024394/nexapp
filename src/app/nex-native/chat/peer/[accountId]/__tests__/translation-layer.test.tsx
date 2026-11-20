// @vitest-environment jsdom
//
// src/app/nex-native/chat/peer/[accountId]/__tests__/translation-layer.test.tsx
//
// Deterministic regression tests for Gap E (observer pruning + binding).
// Owner-authorised 2026-11-17 continuation 3 · local verification only.
//
// Scope:
//   · content-version re-mount on edit (sent-at bump)
//   · recycled-node cleanup (detached anchor is pruned)
//   · teardown on unmount (observer disconnected, mounts cleared)
//
// Deliberately NOT tested here (owner-infra / blocked):
//   · live provider calls
//   · real decryptor pipeline
//   · founder gate (covered by translation-flag.test.ts)

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react";

// The layer imports a vault-session hook · stub to "unlocked" so the
// layer proceeds in all cases.
vi.mock("@/lib/nex-native/vault/client/vault-session", () => ({
  useVaultSession: () => ({ unlocked: true }),
}));

// The per-bubble control renders a button + handles the translate
// click. We stub it to render a tagged span so we can assert mount /
// re-mount behaviour without exercising the real hook.
vi.mock(
  "../_translation-bubble-control",
  () => ({
    BubbleTranslationControl: (props: {
      messageId: string;
      contentVersion: string;
    }) => (
      <span
        data-stub-control
        data-msg-id={props.messageId}
        data-content-version={props.contentVersion}
      >
        T
      </span>
    ),
  }),
  { virtual: true as never },
);

import { ChatTranslationLayer } from "../_translation-layer";

/** Build a decrypted incoming bubble in the document body. Returns the
 *  wrapper so tests can mutate it to simulate recycling / edits. */
function makeBubble(opts: {
  id: string;
  text: string;
  senderAcc: string;
  sentAt: string;
}): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-nex-bloom-msg", "1");
  wrapper.setAttribute("data-nex-msg-sender-acc", opts.senderAcc);
  wrapper.setAttribute("data-nex-msg-sent-at", opts.sentAt);
  wrapper.setAttribute("data-nex-msg-decrypted", "true");

  const body = document.createElement("div");
  body.setAttribute("data-nex-msg-body", opts.id);
  body.textContent = opts.text;

  wrapper.appendChild(body);
  document.body.appendChild(wrapper);
  return wrapper;
}

async function flushMutations(): Promise<void> {
  // MutationObserver callbacks are microtasks + the layer's own
  // 32 ms debounce. Advance both.
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 40));
  });
}

describe("ChatTranslationLayer · Gap E", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("mounts an anchor + translation slot for an incoming decrypted bubble", async () => {
    const result = render(
      <ChatTranslationLayer
        selfAccountId="viewer-acc-1"
        conversationId="conv-1"
      />,
    );
    makeBubble({
      id: "m-1",
      text: "Hello",
      senderAcc: "peer-acc-1",
      sentAt: "100",
    });
    await flushMutations();
    const anchors = document.querySelectorAll(
      "[data-nex-translation-anchor='m-1']",
    );
    const slots = document.querySelectorAll(
      "[data-nex-msg-translation='m-1']",
    );
    expect(anchors.length).toBe(1);
    expect(slots.length).toBe(1);
    result.unmount();
  });

  it("skips outgoing bubbles (viewer's own messages)", async () => {
    const r = render(
      <ChatTranslationLayer
        selfAccountId="viewer-acc-1"
        conversationId="conv-1"
      />,
    );
    const wrapper = makeBubble({
      id: "m-out",
      text: "mine",
      senderAcc: "viewer-acc-1",
      sentAt: "100",
    });
    wrapper.setAttribute("data-nex-bloom-msg-outgoing", "true");
    await flushMutations();
    expect(
      document.querySelectorAll("[data-nex-translation-anchor]").length,
    ).toBe(0);
    r.unmount();
  });

  it("re-mounts the control when content-version changes (edit)", async () => {
    const r = render(
      <ChatTranslationLayer
        selfAccountId="viewer-acc-1"
        conversationId="conv-1"
      />,
    );
    const wrapper = makeBubble({
      id: "m-edit",
      text: "first",
      senderAcc: "peer-acc-1",
      sentAt: "100",
    });
    await flushMutations();
    const firstAnchor = document.querySelector(
      "[data-nex-translation-anchor='m-edit']",
    );
    expect(firstAnchor).not.toBeNull();

    // Simulate an edit landing: bump sent-at + rewrite the body text.
    wrapper.setAttribute("data-nex-msg-sent-at", "200");
    const body = wrapper.querySelector<HTMLElement>(
      "[data-nex-msg-body='m-edit']",
    )!;
    body.textContent = "edited-text-longer";
    await flushMutations();

    // Exactly one anchor + one slot should exist (stale mount disposed).
    const anchors = document.querySelectorAll(
      "[data-nex-translation-anchor='m-edit']",
    );
    const slots = document.querySelectorAll(
      "[data-nex-msg-translation='m-edit']",
    );
    expect(anchors.length).toBe(1);
    expect(slots.length).toBe(1);
    r.unmount();
  });

  it("prunes mounts whose anchor has been detached (virtualised list recycling)", async () => {
    const r = render(
      <ChatTranslationLayer
        selfAccountId="viewer-acc-1"
        conversationId="conv-1"
      />,
    );
    const wrapperA = makeBubble({
      id: "m-rec",
      text: "a",
      senderAcc: "peer-acc-1",
      sentAt: "100",
    });
    await flushMutations();
    expect(
      document.querySelectorAll("[data-nex-translation-anchor='m-rec']")
        .length,
    ).toBe(1);

    // Simulate virtualised list removing the row and inserting a
    // fresh wrapper with the SAME message id · the previous anchor
    // becomes detached and must be pruned.
    wrapperA.remove();
    makeBubble({
      id: "m-rec",
      text: "a",
      senderAcc: "peer-acc-1",
      sentAt: "100",
    });
    await flushMutations();

    const anchors = document.querySelectorAll(
      "[data-nex-translation-anchor='m-rec']",
    );
    // One anchor on the new wrapper · the detached one is gone.
    expect(anchors.length).toBe(1);
    r.unmount();
  });

  it("disconnects observer + clears mounts on unmount", async () => {
    const r = render(
      <ChatTranslationLayer
        selfAccountId="viewer-acc-1"
        conversationId="conv-1"
      />,
    );
    makeBubble({
      id: "m-tear",
      text: "bye",
      senderAcc: "peer-acc-1",
      sentAt: "100",
    });
    await flushMutations();
    expect(
      document.querySelectorAll("[data-nex-translation-anchor='m-tear']")
        .length,
    ).toBe(1);

    r.unmount();
    // Queue the microtask unmount.
    await act(async () => {
      await new Promise<void>((res) => setTimeout(res, 20));
    });

    // After layer unmount, anchor + slot are removed.
    expect(
      document.querySelectorAll("[data-nex-translation-anchor='m-tear']")
        .length,
    ).toBe(0);
    expect(
      document.querySelectorAll("[data-nex-msg-translation='m-tear']")
        .length,
    ).toBe(0);

    // Adding a new bubble after unmount should NOT mount an anchor
    // (observer is disconnected).
    makeBubble({
      id: "m-after",
      text: "ghost",
      senderAcc: "peer-acc-1",
      sentAt: "100",
    });
    await flushMutations();
    expect(
      document.querySelectorAll("[data-nex-translation-anchor='m-after']")
        .length,
    ).toBe(0);
  });

  it("is inert when disabled prop is true", async () => {
    const r = render(
      <ChatTranslationLayer
        selfAccountId="viewer-acc-1"
        conversationId="conv-1"
        disabled
      />,
    );
    makeBubble({
      id: "m-disabled",
      text: "x",
      senderAcc: "peer-acc-1",
      sentAt: "100",
    });
    await flushMutations();
    expect(
      document.querySelectorAll("[data-nex-translation-anchor]").length,
    ).toBe(0);
    r.unmount();
  });
});
