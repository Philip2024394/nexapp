// TC11 · PortraitBloomShell + REAL sendPeerMessageOrShareProductAction
// (same action peer-chat binds) + renderHeader. If this panics but
// TC10 doesn't, the specific server-action implementation + renderHeader
// combination is the trigger.

import { PortraitBloomShell } from "@/app/nex-native/chat/_portrait-bloom-shell";
import { HeaderSearch } from "@/components/nex-native/chat-chrome/header-search";
import { sendPeerMessageOrShareProductAction } from "@/app/nex-native/_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TC11Page(): React.JSX.Element {
  const bound = sendPeerMessageOrShareProductAction.bind(null, "test-peer-id");
  return (
    <PortraitBloomShell
      scope="tc11-repro"
      displayName="TC11 Test"
      isOfficialPeer={false}
      subtitle="real peer action + renderHeader"
      portraitUrl={null}
      presenceKind="online"
      presenceLabel="online"
      rippleColor="#C6A15B"
      backHref="/nex-native/dev/portal-slot-repro"
      messages={[]}
      composerAction={bound}
      composerPlaceholder="Test"
      renderHeader={<HeaderSearch />}
    />
  );
}
