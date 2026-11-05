// TC5 · Real HeaderSearch rendered VIA Shell slot.
// Expected: 500 if the panic is specific to HeaderSearch in slot.

import { TestShell } from "../_test-shell";
import { HeaderSearch } from "@/components/nex-native/chat-chrome/header-search";

export const dynamic = "force-dynamic";

export default function TC5Page(): React.JSX.Element {
  return <TestShell label="TC5" renderHeader={<HeaderSearch />} />;
}
