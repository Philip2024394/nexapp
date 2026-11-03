// src/lib/nex-native/__tests__/stage-a-two-identity-integration.test.ts
//
// Stage A · owner-authorised 2026-11-03 · two-identity integration
// harness for the peer-chat document delivery path. Proves A→B
// data-shape round-trip at the service layer. Mocks nexSupabaseAdmin
// with a lean in-memory table so sendPeerMessage captures a row and
// listPeerMessages reads it back · no real database, no real
// storage, no realtime, no HTTP. Those paths are proven by sealed
// `dispatch-wiring.test.ts` + `media-capture-recorder-contract.test.ts`.

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, inMemoryState, resetState } = vi.hoisted(() => {
  type MsgRow = {
    id: string;
    conversation_id: string;
    sender_account_id: string;
    body: string | null;
    attachment_url: string | null;
    attachment_type: string | null;
    attachment_meta: Record<string, unknown> | null;
    reply_to_id: string | null;
    sent_at: string;
    read_at: string | null;
    deleted_at: string | null;
    deleted_for_everyone: boolean | null;
    encrypted: boolean | null;
  };
  const state = {
    messages: [] as MsgRow[],
    insertCount: 0,
  };
  function reset() {
    state.messages = [];
    state.insertCount = 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  const ctx: {
    table?: string;
    op?: "select" | "insert" | "update";
    insertPayload?: Record<string, unknown>;
    filters: Array<[string, string]>;
  } = { filters: [] };

  const builder: Record<string, AnyFn> = {};
  builder.select = (() => {
    ctx.op = "select";
    return builder;
  }) as AnyFn;
  builder.insert = ((payload: Record<string, unknown>) => {
    ctx.op = "insert";
    ctx.insertPayload = payload;
    return builder;
  }) as AnyFn;
  builder.update = ((payload: Record<string, unknown>) => {
    ctx.op = "update";
    ctx.insertPayload = payload;
    return builder;
  }) as AnyFn;
  builder.eq = ((k: string, v: string) => {
    ctx.filters.push([k, v]);
    return builder;
  }) as AnyFn;
  builder.neq = (() => builder) as AnyFn;
  builder.in = (() => builder) as AnyFn;
  builder.is = (() => builder) as AnyFn;
  builder.order = (() => builder) as AnyFn;
  builder.limit = (() => builder) as AnyFn;
  builder.gt = (() => builder) as AnyFn;
  builder.lt = (() => builder) as AnyFn;

  function resolve(): { data: unknown; error: unknown } {
    // Supabase chains `.insert(...).select("*").single()` · the
    // `.select()` call shadows ctx.op to "select" so we prefer the
    // insert branch whenever we captured an insertPayload. Same
    // trick for update.
    if (ctx.insertPayload && ctx.table === "nex_peer_message") {
      state.insertCount += 1;
      const payload = ctx.insertPayload ?? {};
      const row = {
        id: "msg-" + state.insertCount,
        conversation_id: String(payload.conversation_id ?? ""),
        sender_account_id: String(payload.sender_account_id ?? ""),
        body: (payload.body as string | null) ?? null,
        attachment_url: (payload.attachment_url as string | null) ?? null,
        attachment_type: (payload.attachment_type as string | null) ?? null,
        attachment_meta:
          (payload.attachment_meta as Record<string, unknown> | null) ?? null,
        reply_to_id: (payload.reply_to_id as string | null) ?? null,
        sent_at: new Date().toISOString(),
        read_at: null,
        deleted_at: null,
        deleted_for_everyone: false,
        encrypted: Boolean(payload.encrypted) || false,
      };
      state.messages.push(row);
      ctx.filters = [];
      ctx.op = undefined;
      ctx.insertPayload = undefined;
      return { data: row, error: null };
    }
    if (ctx.op === "select" && ctx.table === "nex_peer_message") {
      const convFilter = ctx.filters.find(([k]) => k === "conversation_id");
      const rows = convFilter
        ? state.messages.filter((r) => r.conversation_id === convFilter[1])
        : state.messages.slice();
      ctx.filters = [];
      ctx.op = undefined;
      return { data: rows, error: null };
    }
    return { data: null, error: null };
  }

  builder.single = (() => Promise.resolve(resolve())) as AnyFn;
  builder.maybeSingle = (() => Promise.resolve(resolve())) as AnyFn;
  builder.then = ((
    onF: (v: unknown) => unknown,
    onR?: (e: unknown) => unknown,
  ) => {
    const r = resolve();
    return Promise.resolve(r).then(onF, onR);
  }) as AnyFn;

  const from = vi.fn((table: string) => {
    ctx.table = table;
    ctx.filters = [];
    ctx.op = undefined;
    ctx.insertPayload = undefined;
    return builder;
  });

  return { fromMock: from, inMemoryState: state, resetState: reset };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: fromMock,
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        getPublicUrl: (p: string) => ({
          data: {
            publicUrl:
              "https://mock.supabase/storage/v1/object/public/" + p,
          },
        }),
      }),
    },
  },
  nexSupabaseProjectRef: () => "mock",
}));

vi.mock("@/lib/nex-native/peer-conversation-service", () => ({
  touchPeerConversation: vi.fn().mockResolvedValue(undefined),
  getPeerConversationById: vi.fn().mockImplementation((id: string) =>
    Promise.resolve({
      id,
      participant_a_id: "00000000-0000-4000-8000-00000000000a",
      participant_b_id: "00000000-0000-4000-8000-00000000000b",
      last_message_at: new Date().toISOString(),
    }),
  ),
  getOrCreatePeerConversation: vi.fn(),
  getOrCreatePeerConversationAsSender: vi.fn(),
}));

import {
  sendPeerMessage,
  listPeerMessages,
  classifyPeerAttachmentMime,
  uploadPeerAttachment,
  NEX_PEER_ATTACHMENT_MAX_BYTES,
} from "@/lib/nex-native/peer-message-service";

const ACCOUNT_A = "00000000-0000-4000-8000-00000000000a";
const CONV_AB = "00000000-0000-4000-8000-00000000000c";

beforeEach(() => {
  resetState();
});

describe("Stage A · classifyPeerAttachmentMime", () => {
  test("image/* routes to 'image'", () => {
    expect(classifyPeerAttachmentMime("image/png")).toBe("image");
    expect(classifyPeerAttachmentMime("image/jpeg")).toBe("image");
    expect(classifyPeerAttachmentMime("image/webp")).toBe("image");
  });

  test("video/* routes to 'video'", () => {
    expect(classifyPeerAttachmentMime("video/mp4")).toBe("video");
    expect(classifyPeerAttachmentMime("video/webm")).toBe("video");
    expect(classifyPeerAttachmentMime("video/quicktime")).toBe("video");
  });

  test("audio/* routes to 'audio'", () => {
    expect(classifyPeerAttachmentMime("audio/mp4")).toBe("audio");
    expect(classifyPeerAttachmentMime("audio/mpeg")).toBe("audio");
    expect(classifyPeerAttachmentMime("audio/ogg")).toBe("audio");
  });

  test("PDF + Office docs + text + archives all route to 'document'", () => {
    expect(classifyPeerAttachmentMime("application/pdf")).toBe("document");
    expect(
      classifyPeerAttachmentMime(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("document");
    expect(
      classifyPeerAttachmentMime(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("document");
    expect(classifyPeerAttachmentMime("application/zip")).toBe("document");
    expect(classifyPeerAttachmentMime("application/x-7z-compressed")).toBe(
      "document",
    );
    expect(classifyPeerAttachmentMime("text/plain")).toBe("document");
    expect(classifyPeerAttachmentMime("text/csv")).toBe("document");
  });

  test("empty MIME rejected (null)", () => {
    expect(classifyPeerAttachmentMime("")).toBeNull();
  });

  test("case insensitive", () => {
    expect(classifyPeerAttachmentMime("IMAGE/PNG")).toBe("image");
    expect(classifyPeerAttachmentMime("APPLICATION/PDF")).toBe("document");
  });
});

describe("Stage A · uploadPeerAttachment", () => {
  test("preserves filename ONLY for documents", async () => {
    const pdf = new File([new Uint8Array([1, 2, 3])], "contract.pdf", {
      type: "application/pdf",
    });
    const result = await uploadPeerAttachment(ACCOUNT_A, pdf);
    expect(result.kind).toBe("document");
    expect(result.meta.filename).toBe("contract.pdf");
    expect(result.meta.mime).toBe("application/pdf");
    expect(result.meta.size_bytes).toBe(3);

    const img = new File([new Uint8Array([9, 9, 9, 9])], "photo.png", {
      type: "image/png",
    });
    const r2 = await uploadPeerAttachment(ACCOUNT_A, img);
    expect(r2.kind).toBe("image");
    expect(r2.meta.filename).toBeUndefined();
    expect(r2.meta.mime).toBe("image/png");
  });

  test("truncates filename at 256 chars", async () => {
    const long = "a".repeat(500) + ".pdf";
    const f = new File([new Uint8Array([1])], long, {
      type: "application/pdf",
    });
    const r = await uploadPeerAttachment(ACCOUNT_A, f);
    expect(r.meta.filename!.length).toBe(256);
  });

  test("rejects files over the sealed 25 MB cap", async () => {
    const bytes = new Uint8Array(NEX_PEER_ATTACHMENT_MAX_BYTES + 1);
    const big = new File([bytes], "huge.pdf", {
      type: "application/pdf",
    });
    await expect(uploadPeerAttachment(ACCOUNT_A, big)).rejects.toThrow(
      /25MB cap/,
    );
  });

  test("rejects empty-MIME files", async () => {
    const noType = new File([new Uint8Array([1])], "mystery", { type: "" });
    await expect(uploadPeerAttachment(ACCOUNT_A, noType)).rejects.toThrow();
  });
});

describe("Stage A · A sends → B receives · document round-trip", () => {
  test("sender's attachment_meta round-trips to recipient's listPeerMessages read", async () => {
    const sentMeta = {
      filename: "quarterly-report.pdf",
      size_bytes: 847_392,
      mime: "application/pdf",
    };
    await sendPeerMessage({
      conversation_id: CONV_AB,
      sender_account_id: ACCOUNT_A,
      body: "FYI the Q3 numbers",
      reply_to_id: null,
      attachment_url:
        "https://mock.supabase/storage/v1/object/public/nex-peer-chat-attachments/a/t.pdf",
      attachment_type: "document",
      attachment_meta: sentMeta,
    });

    expect(inMemoryState.insertCount).toBe(1);
    const row = inMemoryState.messages[0]!;
    expect(row.sender_account_id).toBe(ACCOUNT_A);
    expect(row.attachment_type).toBe("document");
    expect(row.attachment_url).toContain("t.pdf");
    expect(row.attachment_meta).toEqual(sentMeta);

    const received = await listPeerMessages(CONV_AB);
    expect(received).toHaveLength(1);
    const [m] = received;
    expect(m!.attachment_type).toBe("document");
    expect(m!.attachment_url).toContain("t.pdf");
    expect(m!.attachment_meta).toEqual(sentMeta);
  });

  test("image + voice + video pathways still work alongside document", async () => {
    await sendPeerMessage({
      conversation_id: CONV_AB,
      sender_account_id: ACCOUNT_A,
      body: "",
      reply_to_id: null,
      attachment_url: "https://mock/img.png",
      attachment_type: "image",
      attachment_meta: { size_bytes: 100, mime: "image/png" },
    });
    await sendPeerMessage({
      conversation_id: CONV_AB,
      sender_account_id: ACCOUNT_A,
      body: "",
      reply_to_id: null,
      attachment_url: "https://mock/clip.webm",
      attachment_type: "audio",
      attachment_meta: { size_bytes: 2048, mime: "audio/webm" },
    });
    await sendPeerMessage({
      conversation_id: CONV_AB,
      sender_account_id: ACCOUNT_A,
      body: "",
      reply_to_id: null,
      attachment_url: "https://mock/video.mp4",
      attachment_type: "video",
      attachment_meta: { size_bytes: 500000, mime: "video/mp4" },
    });

    expect(inMemoryState.insertCount).toBe(3);
    const list = await listPeerMessages(CONV_AB);
    expect(list).toHaveLength(3);
    expect(list.map((r) => r.attachment_type)).toEqual([
      "image",
      "audio",
      "video",
    ]);
  });

  test("listPeerMessages isolates by conversation_id", async () => {
    const otherConv = "00000000-0000-4000-8000-00000000000d";

    await sendPeerMessage({
      conversation_id: CONV_AB,
      sender_account_id: ACCOUNT_A,
      body: "hello B",
      reply_to_id: null,
      attachment_url: null,
      attachment_type: null,
      attachment_meta: null,
    });
    await sendPeerMessage({
      conversation_id: otherConv,
      sender_account_id: ACCOUNT_A,
      body: "hello C",
      reply_to_id: null,
      attachment_url: null,
      attachment_type: null,
      attachment_meta: null,
    });

    const abRows = await listPeerMessages(CONV_AB);
    expect(abRows).toHaveLength(1);
    expect(abRows[0]!.body).toBe("hello B");

    const cRows = await listPeerMessages(otherConv);
    expect(cRows).toHaveLength(1);
    expect(cRows[0]!.body).toBe("hello C");
  });

  test("documents still send with empty body (attachment-only message)", async () => {
    await sendPeerMessage({
      conversation_id: CONV_AB,
      sender_account_id: ACCOUNT_A,
      body: "",
      reply_to_id: null,
      attachment_url: "https://mock/alone.pdf",
      attachment_type: "document",
      attachment_meta: {
        filename: "alone.pdf",
        size_bytes: 10,
        mime: "application/pdf",
      },
    });

    const rows = await listPeerMessages(CONV_AB);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body === "" || rows[0]!.body === null).toBe(true);
    expect(rows[0]!.attachment_url).toContain("alone.pdf");
  });
});

describe("Stage A · Bridge 88 posture preserved", () => {
  test("document send does NOT set encrypted=true · plaintext path only", async () => {
    await sendPeerMessage({
      conversation_id: CONV_AB,
      sender_account_id: ACCOUNT_A,
      body: "",
      reply_to_id: null,
      attachment_url: "https://mock/doc.pdf",
      attachment_type: "document",
      attachment_meta: {
        filename: "doc.pdf",
        size_bytes: 10,
        mime: "application/pdf",
      },
    });

    const row = inMemoryState.messages[0]!;
    expect(row.encrypted).toBeFalsy();
  });
});
