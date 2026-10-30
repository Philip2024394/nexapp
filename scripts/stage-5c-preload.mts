// scripts/stage-5c-preload.mts
//
// Node `--import` preload that resolves the `server-only` module
// to a no-op. The real guard is a compile-time boundary enforcing
// that server-only code never ends up in a client bundle; running
// the repo module from a Node test script is NOT a client-bundle
// situation and the guard raises a false positive. We stub it
// strictly for the Stage 5C test harness.

import { Module } from "node:module";

const originalResolveFilename = (Module as unknown as {
  _resolveFilename: (req: string, parent: unknown, isMain: boolean, options?: unknown) => string;
})._resolveFilename;

const noopPath = new URL("./server-only-shim.cjs", import.meta.url).pathname.replace(/^\//, "");

(Module as unknown as {
  _resolveFilename: (req: string, parent: unknown, isMain: boolean, options?: unknown) => string;
})._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") {
    return noopPath;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
