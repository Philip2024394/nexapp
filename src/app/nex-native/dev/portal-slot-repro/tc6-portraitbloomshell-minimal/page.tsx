// TC6 · Mount REAL PortraitBloomShell (not TestShell) with minimal
// props + renderHeader=<HeaderSearch/>. If this panics, the Shell
// itself is the culprit · if not, the full peer-chat prop set is.

import { PortraitBloomShell } from "@/app/nex-native/chat/_portrait-bloom-shell";
import { HeaderSearch } from "@/components/nex-native/chat-chrome/header-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TC6Page(): React.JSX.Element {
  return (
    <PortraitBloomShell
      scope="tc6-repro"
      displayName="TC6 Test"
      isOfficialPeer={false}
      subtitle="minimal repro"
      portraitUrl={null}
      presenceKind="online"
      presenceLabel="online"
      rippleColor="#C6A15B"
      backHref="/nex-native/dev/portal-slot-repro"
      messages={[]}
      composerAction={async () => {}}
      composerPlaceholder="Test"
      renderHeader={<HeaderSearch />}
    />
  );
}
