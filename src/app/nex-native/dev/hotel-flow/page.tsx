// src/app/nex-native/dev/hotel-flow/page.tsx
// Entry point · redirects to /discover.

import { redirect } from "next/navigation";

export default function HotelFlowRoot(): never {
  redirect("/nex-native/dev/hotel-flow/discover");
}
