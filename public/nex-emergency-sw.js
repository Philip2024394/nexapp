// NEX Emergency Help · service worker v1 · scope /nex-native/emergency-help/
//
// Honest limits documented in
// docs/doctrine/nex-emergency-background-capability-2026-10-10.md
//
// This scaffold exists so responder-side push notifications and the
// honest "periodic sync" no-op can land now. Live push wake-up requires
// VAPID keys + a server-side sender; those are deferred founder
// decisions, not this file's job.

self.addEventListener("install", (event) => {
  // Take over as soon as installed · the controlling tab is already
  // the requester view, we want new workers active without a reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notifications · responder-side wake-up. Honest degradation:
// if event.data is absent (e.g. push without payload on some
// browsers) we show a generic alert rather than crash.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "NEX Emergency", body: "An alert needs your attention" };
  }
  const title = payload.title ?? "NEX Emergency Help";
  const body = payload.body ?? "";
  const data = payload.data ?? {};
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/nex-emergency/safety-concern.png",
      badge: "/nex-emergency/safety-concern.png",
      tag: data.incidentId ?? "nex-emergency-generic",
      requireInteraction: true,
      data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const incidentId = event.notification.data?.incidentId;
  const url = incidentId
    ? `/nex-native/emergency-help/incident/${incidentId}`
    : "/nex-native/emergency-help";
  event.waitUntil(self.clients.openWindow(url));
});

// Periodic sync (Chrome-only · heavily throttled by the browser · may
// never fire). This is honest no-op v1 scaffolding: the server-side
// polling is driven by the requester's ActiveIncidentView tab staying
// open. True always-on background location tracking is deferred to a
// native companion app · see the capability doctrine.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "nex-emergency-last-known-location") {
    // Intentional no-op · documented honest limit.
  }
});
