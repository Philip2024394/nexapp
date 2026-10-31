// Vitest stub for Next.js `server-only` sentinel.
// In production builds, `server-only` throws if imported from a client
// component. Tests run in Node where that constraint is irrelevant and
// the real `server-only` module throws at import time inside vitest's
// Node loader. Aliasing to this empty module unblocks unit tests for
// server-only utilities (resolve-app-identity, music services, etc.).
export {};
