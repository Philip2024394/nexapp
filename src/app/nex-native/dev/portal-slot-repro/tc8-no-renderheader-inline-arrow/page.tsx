// TC8 · Real PortraitBloomShell WITHOUT renderHeader + inline arrow
// composerAction (same as TC6/TC7 used). If this panics, then
// the panic is from composerAction, not renderHeader.

import { PortraitBloomShell } from "@/app/nex-native/chat/_portrait-bloom-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TC8Page(): React.JSX.Element {
  return (
    <PortraitBloomShell
      scope="tc8-repro"
      displayName="TC8 Test"
      isOfficialPeer={false}
      subtitle="no renderHeader + inline arrow composerAction"
      portraitUrl={null}
      presenceKind="online"
      presenceLabel="online"
      rippleColor="#C6A15B"
      backHref="/nex-native/dev/portal-slot-repro"
      messages={[]}
      composerAction={async () => {}}
      composerPlaceholder="Test"
    />
  );
}
