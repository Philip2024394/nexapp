// src/lib/nex-native/emergency/_kms.ts
//
// NEX Emergency Help · KMS abstraction.
// Owner-authorised 2026-10-25 (Phase D of the continuous-build plan).
//
// Pluggable KMS interface + a mock backend for dev + tests. The real
// backend (AWS KMS or GCP KMS · Decision #7 held open on region
// pending Persona processing-location response) implements the same
// interface and plugs in via `createKmsFromEnv()`.
//
// Honest-copy: this module does NOT claim encryption is live. It
// provides the abstraction. The crypto module + the feature flag
// `profileEncryptionLive` govern whether real data is encrypted at
// rest in any environment.
//
// Design: envelope encryption. The KMS holds a MASTER KEY per
// tenant/region (`master_key_id` identifies which generation).
// The crypto module generates a fresh DATA KEY per encryption,
// encrypts the data with the data key, then encrypts the data key
// with the master key. Both are stored together in the row.
// Rotation: incrementing the master-key version re-encrypts data
// keys only · ciphertext stays stable (cheap rotation).

export interface DataKeyMaterial {
  /** The plaintext data key · 32 bytes · consumed immediately then zeroed. */
  readonly plaintext: Uint8Array;
  /** The data key wrapped (encrypted) by the master key · persistable. */
  readonly ciphertext: Uint8Array;
  /** Which master-key version wrapped this data key. */
  readonly masterKeyVersion: number;
}

export interface KmsAdapter {
  /** Generate a fresh 32-byte data key and return both plaintext +
   *  wrapped forms. Callers consume the plaintext for one AES-GCM
   *  encryption, then discard it (zeroise + drop reference). The
   *  wrapped form is persisted alongside the ciphertext. */
  generateDataKey(): Promise<DataKeyMaterial>;

  /** Unwrap a previously-wrapped data key. Fails if the master-key
   *  version used to wrap is no longer available. */
  unwrapDataKey(
    wrapped: Uint8Array,
    masterKeyVersion: number,
  ): Promise<Uint8Array>;

  /** Current master-key version · used by callers to tag new rows. */
  currentMasterKeyVersion(): number;

  /** Rotation hook · increments the master-key version. The real
   *  implementation re-wraps active data keys under the new version.
   *  The mock simply bumps the counter. */
  rotateMasterKey(): Promise<number>;
}

// ─── Mock KMS adapter · for dev + tests ONLY ────────────────────────
//
// Uses a deterministic 32-byte master "key" derived from a seed. The
// seed is a module-local constant · nothing persists · each test
// gets a fresh mock. The mock IS NOT a security boundary · the
// `profileEncryptionLive` feature flag MUST be false in any
// environment that mounts the mock.

// Note: this adapter uses Node's `crypto` module. Both `require` and
// dynamic `import` paths work in vitest.

interface MockState {
  readonly masterKeys: Map<number, Uint8Array>;
  currentVersion: number;
}

async function getNodeCrypto(): Promise<typeof import("node:crypto")> {
  return await import("node:crypto");
}

export function createMockKmsAdapter(seed?: Uint8Array): KmsAdapter {
  const state: MockState = {
    masterKeys: new Map(),
    currentVersion: 0,
  };

  async function initMasterKey(): Promise<void> {
    if (state.masterKeys.has(1)) return;
    const crypto = await getNodeCrypto();
    // Deterministic derivation when seed is provided; random otherwise.
    const material = seed
      ? crypto.createHash("sha256").update(Buffer.from(seed)).digest()
      : crypto.randomBytes(32);
    state.masterKeys.set(1, new Uint8Array(material));
    state.currentVersion = 1;
  }

  async function wrapKey(
    plaintext: Uint8Array,
    masterKeyVersion: number,
  ): Promise<Uint8Array> {
    const crypto = await getNodeCrypto();
    const masterKey = state.masterKeys.get(masterKeyVersion);
    if (!masterKey) {
      throw new Error(
        `mock KMS: master key version ${masterKeyVersion} not available`,
      );
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from(masterKey),
      iv,
    );
    const ct = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Layout: iv || tag || ct
    return new Uint8Array(Buffer.concat([iv, tag, ct]));
  }

  async function unwrapKey(
    wrapped: Uint8Array,
    masterKeyVersion: number,
  ): Promise<Uint8Array> {
    const crypto = await getNodeCrypto();
    const masterKey = state.masterKeys.get(masterKeyVersion);
    if (!masterKey) {
      throw new Error(
        `mock KMS: master key version ${masterKeyVersion} not available`,
      );
    }
    const b = Buffer.from(wrapped);
    if (b.length < 12 + 16 + 1) {
      throw new Error("mock KMS: wrapped data key too short");
    }
    const iv = b.subarray(0, 12);
    const tag = b.subarray(12, 28);
    const ct = b.subarray(28);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(masterKey),
      iv,
    );
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return new Uint8Array(pt);
  }

  return {
    async generateDataKey(): Promise<DataKeyMaterial> {
      await initMasterKey();
      const crypto = await getNodeCrypto();
      const plaintext = new Uint8Array(crypto.randomBytes(32));
      const ciphertext = await wrapKey(plaintext, state.currentVersion);
      return {
        plaintext,
        ciphertext,
        masterKeyVersion: state.currentVersion,
      };
    },
    async unwrapDataKey(
      wrapped: Uint8Array,
      masterKeyVersion: number,
    ): Promise<Uint8Array> {
      await initMasterKey();
      return unwrapKey(wrapped, masterKeyVersion);
    },
    currentMasterKeyVersion(): number {
      return state.currentVersion;
    },
    async rotateMasterKey(): Promise<number> {
      await initMasterKey();
      const crypto = await getNodeCrypto();
      const nextVersion = state.currentVersion + 1;
      state.masterKeys.set(
        nextVersion,
        new Uint8Array(crypto.randomBytes(32)),
      );
      state.currentVersion = nextVersion;
      return nextVersion;
    },
  };
}

/**
 * Factory. Returns a mock KMS in all non-production environments.
 * The real-provider branch is intentionally not implemented here ·
 * Decision #7 holds the KMS region open pending Persona processing-
 * location response. Attempting to call this in production without
 * a wired-up real adapter throws, by design (fail-closed).
 */
export function createKmsFromEnv(): KmsAdapter {
  const nodeEnv =
    typeof process !== "undefined" && process.env
      ? process.env.NODE_ENV
      : "development";
  if (nodeEnv !== "production") {
    return createMockKmsAdapter();
  }
  throw new Error(
    "KMS not configured for production · Decision #7 region/provider pending. " +
      "Enable the live KMS adapter in a separate authorised slice before setting " +
      "NEX_EMERGENCY_PROFILE_ENCRYPTION_LIVE=1.",
  );
}
