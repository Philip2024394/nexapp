// src/app/nex-native/live-commerce/go-live/page.tsx
//
// Owner directive 2026-10-28 · "the live stream page control page
// for owner is url - go live". The URL /go-live is the owner-facing
// live-control URL, but the broadcaster state machine actually lives
// on /enter-broadcast-room. When the broadcaster taps "Go Live" the
// idle state transitions to live and `window.history.replaceState`
// swaps the browser URL to /go-live without unmounting the engine
// (see URL-morph effect in enter-broadcast-room/_go-live-client.tsx).
//
// This page handles the direct-navigation + refresh case: landing on
// /go-live without an active broadcast lands the user back on the
// idle entry screen so the engine boots cleanly.

import { redirect } from "next/navigation";

export const metadata = {
  title: "NEX · Nex Live",
  description: "Broadcast live from your device to your customers.",
};

export default function GoLivePage(): never {
  redirect("/nex-native/live-commerce/enter-broadcast-room");
}
