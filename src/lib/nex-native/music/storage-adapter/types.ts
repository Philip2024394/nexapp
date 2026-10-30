// src/lib/nex-native/music/storage-adapter/types.ts
//
// Owner-authorised 2026-10-29 · DRAFT §5.1.
//
// Provider-neutral storage adapter interface for NEX Music. The
// higher-level service NEVER embeds Supabase / R2 / S3 / filesystem
// details · it consumes only `reference` strings produced by
// `putObject` and short-lived signed URLs minted by
// `getSignedReadUrl`.

export type MusicStorageContentType =
  | "audio/mpeg"
  | "audio/mp4"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export interface PutObjectArgs {
  readonly objectKey: string;
  readonly contentType: MusicStorageContentType;
  readonly bytes: Buffer;
  readonly byteLength: number;
  readonly ownerAccountId: string;
}

export interface SignedReadUrlArgs {
  readonly reference: string;
  readonly expiresInSeconds: number;
  readonly ownerAccountId: string;
}

export interface SignedReadUrlResult {
  readonly signedUrl: string;
  readonly expiresAt: Date;
}

export interface MusicMediaStorage {
  putObject(args: PutObjectArgs): Promise<{ reference: string }>;
  getSignedReadUrl(args: SignedReadUrlArgs): Promise<SignedReadUrlResult>;
  deleteObject(args: { reference: string }): Promise<{ deleted: boolean }>;
  objectExists(args: {
    reference: string;
  }): Promise<{ exists: boolean; byteLength?: number }>;
}
