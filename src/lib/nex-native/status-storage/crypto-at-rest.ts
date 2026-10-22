// src/lib/nex-native/status-storage/crypto-at-rest.ts
//
// NEX Status · encryption-at-rest helper · v1 STUB.
//
// TODO: v1 ships NO encryption at rest · status media stays plaintext
// in IndexedDB. The function signatures below exist so callers can be
// migrated to a real encryption pipeline later without touching call
// sites. The future implementation will use AES-GCM via SubtleCrypto
// with a per-owner key derived from the account id plus a user-chosen
// passphrase (same pattern as the Vault key hierarchy; see
// `src/lib/nex-native/vault/key-hierarchy.ts`).
//
// Why a stub rather than defer: callers in store.ts / composer flows
// may optionally invoke encryptBlob() before saveStatus() and
// decryptBlob() after getStatus() · the no-op pass-through keeps v1
// safe but makes the migration a one-file change later.
//
// IMPORTANT · v1 pass-through is intentional. Do NOT remove this stub
// to "simplify" · changing the module's public surface requires a
// coordinated migration across every caller.

export type StatusCryptoKeyMaterial = {
  /** Account id the key is derived against. Future: HKDF salt. */
  ownerAccountId: string;
  /**
   * Optional user-chosen passphrase. Future: PBKDF2 / Argon2 derived
   * key material · never persisted · zeroised after use.
   */
  passphrase?: string;
};

/**
 * Encrypt a status media Blob for at-rest storage.
 *
 * v1: pass-through. Returns the input Blob unchanged.
 * Future: AES-GCM wrap under per-owner derived key.
 */
export function encryptBlob(
  blob: Blob,
  _keyMaterial: StatusCryptoKeyMaterial,
): Promise<Blob> {
  // Explicit silence on unused arg so lint / future callers do not
  // accidentally rely on side-effects of this stub.
  void _keyMaterial;
  return Promise.resolve(blob);
}

/**
 * Decrypt a status media Blob loaded from at-rest storage.
 *
 * v1: pass-through. Returns the input Blob unchanged.
 * Future: AES-GCM unwrap under per-owner derived key.
 */
export function decryptBlob(
  blob: Blob,
  _keyMaterial: StatusCryptoKeyMaterial,
): Promise<Blob> {
  void _keyMaterial;
  return Promise.resolve(blob);
}
