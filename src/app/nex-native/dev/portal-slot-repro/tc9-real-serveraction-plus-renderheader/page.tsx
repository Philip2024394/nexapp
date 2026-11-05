// TC9 · Real PortraitBloomShell + REAL bound server action +
// renderHeader={<HeaderSearch/>}. If this passes, the real peer
// chat should also work · renderHeader was never the panic cause.

import { PortraitBloomShell } from "@/app/nex-native/chat/_portrait-bloom-shell";
import { HeaderSearch } from "@/components/nex-native/chat-chrome/header-search";
import { tcServerAction } from "../_server-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TC9Page(): React.JSX.Element {
  return (
    <PortraitBloomShell
      scope="tc9-repro"
      displayName="TC9 Test"
      isOfficialPeer={false}
      subtitle="bound server action + renderHeader"
      portraitUrl={null}
      presenceKind="online"
      presenceLabel="online"
      rippleColor="#C6A15B"
      backHref="/nex-native/dev/portal-slot-repro"
      messages={[]}
      composerAction={tcServerAction}
      composerPlaceholder="Test"
      renderHeader={<HeaderSearch />}
    />
  );
}
