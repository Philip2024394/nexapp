import { describe, it, expect } from "vitest";
import {
  parseSupabaseStorageObject,
  collectListingMediaUrls,
} from "../watch-storage-paths";

const APPROVED = new Set<string>(["https://example.supabase.co"]);

describe("parseSupabaseStorageObject", () => {
  it("parses a public storage URL", () => {
    const r = parseSupabaseStorageObject(
      "https://example.supabase.co/storage/v1/object/public/nex-watches/42.jpg",
      APPROVED,
    );
    expect(r).toEqual({ bucket: "nex-watches", path: "42.jpg" });
  });

  it("parses a signed storage URL (ignores the query string)", () => {
    const r = parseSupabaseStorageObject(
      "https://example.supabase.co/storage/v1/object/sign/nex-watches/42.jpg?token=abc",
      APPROVED,
    );
    expect(r).toEqual({ bucket: "nex-watches", path: "42.jpg" });
  });

  it("parses a nested path", () => {
    const r = parseSupabaseStorageObject(
      "https://example.supabase.co/storage/v1/object/public/nex-watches/user-42/front.jpg",
      APPROVED,
    );
    expect(r).toEqual({ bucket: "nex-watches", path: "user-42/front.jpg" });
  });

  it("parses the render/image public URL", () => {
    const r = parseSupabaseStorageObject(
      "https://example.supabase.co/storage/v1/render/image/public/nex-watches/42.jpg?width=200",
      APPROVED,
    );
    expect(r).toEqual({ bucket: "nex-watches", path: "42.jpg" });
  });

  it("decodes URL-encoded path segments", () => {
    const r = parseSupabaseStorageObject(
      "https://example.supabase.co/storage/v1/object/public/nex-watches/user%2042/photo%20front.jpg",
      APPROVED,
    );
    expect(r).toEqual({
      bucket: "nex-watches",
      path: "user 42/photo front.jpg",
    });
  });

  it("returns null for a foreign origin", () => {
    expect(
      parseSupabaseStorageObject(
        "https://attacker.example/storage/v1/object/public/nex-watches/42.jpg",
        APPROVED,
      ),
    ).toBeNull();
  });

  it("returns null for a URL that doesn't match any known shape", () => {
    expect(
      parseSupabaseStorageObject(
        "https://example.supabase.co/not-a-storage-path/42.jpg",
        APPROVED,
      ),
    ).toBeNull();
  });

  it("returns null for a bogus URL string", () => {
    expect(parseSupabaseStorageObject("not a url", APPROVED)).toBeNull();
  });
});

describe("collectListingMediaUrls", () => {
  it("returns an empty array when both fields are null", () => {
    expect(
      collectListingMediaUrls({
        cover_image_url: null,
        gallery_image_urls: null,
      }),
    ).toEqual([]);
  });

  it("returns the cover + gallery URLs in order", () => {
    const urls = collectListingMediaUrls({
      cover_image_url: "https://a/x.jpg",
      gallery_image_urls: ["https://a/y.jpg", "https://a/z.jpg"],
    });
    expect(urls).toEqual(["https://a/x.jpg", "https://a/y.jpg", "https://a/z.jpg"]);
  });

  it("deduplicates identical URLs across cover + gallery", () => {
    const urls = collectListingMediaUrls({
      cover_image_url: "https://a/x.jpg",
      gallery_image_urls: ["https://a/x.jpg", "https://a/y.jpg"],
    });
    expect(urls).toEqual(["https://a/x.jpg", "https://a/y.jpg"]);
  });
});
