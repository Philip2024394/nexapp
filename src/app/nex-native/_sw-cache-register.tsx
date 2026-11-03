"use client";

// src/app/nex-native/_sw-cache-register.tsx
//
// Service-worker registration for CACHING · 2026-10-02.
// ---------------------------------------------------------------------
// Mounts on every /nex-native/* page. Its only job is to register the
// NEX service worker so the fetch-cache strategies take effect from
// the very first page load.
//
// Deliberately separate from PushSubscribeHub (which handles push
// subscription on a signed-in / VAPID-configured basis) · caching is
// valuable for signed-out visitors too and must not be gated on
// permission state or env vars.
//
// register() is idempotent — PushSubscribeHub calling register() later
// on the same path returns the existing registration, no conflict.

import * as React from "react";

export function SwCacheRegister(): null {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Owner directive 2026-11-03 · "updates are refreshing live
     // working hosting dev" · aggressive dev-mode cleanup. Prior
     // version scope-filtered to "/nex-native/" + prefix "nex-native-"
     // so legacy SW registrations with different scope / cache names
     // leaked through. Dev now UNCONDITIONALLY: unregisters EVERY
     // service worker + deletes EVERY cache + reloads once if any
     // cleanup actually happened (one-shot per session so the fresh
     // compile boots without the SW still intercepting).
     if (process.env.NODE_ENV !== "production") {
       (async () => {
         let didCleanup = false;
         try {
           const regs = await navigator.serviceWorker.getRegistrations();
           for (const reg of regs) {
             const ok = await reg.unregister().catch(() => false);
             if (ok) didCleanup = true;
           }
         } catch { /* ignore */ }
         try {
           if ("caches" in window) {
             const names = await caches.keys();
             for (const name of names) {
               const ok = await caches.delete(name).catch(() => false);
               if (ok) didCleanup = true;
             }
           }
         } catch { /* ignore */ }
         // One-shot reload · gated on sessionStorage so we never loop.
         if (didCleanup && !sessionStorage.getItem("nex-sw-dev-reloaded")) {
           sessionStorage.setItem("nex-sw-dev-reloaded", "1");
           window.location.reload();
         }
       })();
       return;
     }

    // Respect user intent: if the page is served over HTTP (local dev
    // on 127.0.0.1 is fine; prod HTTP is a misconfiguration), skip.
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return;
    }
    navigator.serviceWorker
      .register("/nex-native-sw.js", { scope: "/nex-native/" })
      .catch(() => {
        /* Registration failures (e.g. SW disabled by browser policy)
           are non-fatal · the page still works, just without the
           cache acceleration. */
      });
  }, []);
  return null;
}
