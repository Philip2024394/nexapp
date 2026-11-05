// TC10 · Real PortraitBloomShell + BOUND server action (via .bind())
// + renderHeader. Mimics the exact real peer-chat shape.

import { PortraitBloomShell } from "@/app/nex-native/chat/_portrait-bloom-shell";
import { HeaderSearch } from "@/components/nex-native/chat-chrome/header-search";
import { tcServerAction } from "../_server-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TC10Page(): React.JSX.Element {
  // Same binding pattern as real peer-chat: action.bind(null, context).
  const bound = tcServerAction.bind(null);
  return (
    <PortraitBloomShell
      scope="tc10-repro"
      displayName="TC10 Test"
      isOfficialPeer={false}
      subtitle="BOUND server action + renderHeader"
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
