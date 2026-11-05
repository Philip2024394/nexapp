// TC4 · Real HeaderSearch rendered DIRECTLY by server page.
// Expected: 200 (same as Chat Header 99901 renders it).

import { HeaderSearch } from "@/components/nex-native/chat-chrome/header-search";

export const dynamic = "force-dynamic";

export default function TC4Page(): React.JSX.Element {
  return (
    <main style={{ padding: 20, color: "#F2F5F8", background: "#123D2B", minHeight: "100dvh" }}>
      <h1>TC4 · HeaderSearch rendered DIRECTLY</h1>
      <HeaderSearch />
    </main>
  );
}
