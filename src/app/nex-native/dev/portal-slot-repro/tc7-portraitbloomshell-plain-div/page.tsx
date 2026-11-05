// TC7 · Real PortraitBloomShell + renderHeader=<div>HELLO</div>.
// Isolates whether the Shell panics with ANY renderHeader value or
// only with portal-using descendants.

import { PortraitBloomShell } from "@/app/nex-native/chat/_portrait-bloom-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TC7Page(): React.JSX.Element {
  return (
    <PortraitBloomShell
      scope="tc7-repro"
      displayName="TC7 Test"
      isOfficialPeer={false}
      subtitle="plain div in slot"
      portraitUrl={null}
      presenceKind="online"
      presenceLabel="online"
      rippleColor="#C6A15B"
      backHref="/nex-native/dev/portal-slot-repro"
      messages={[]}
      composerAction={async () => {}}
      composerPlaceholder="Test"
      renderHeader={<div data-nex-tc7-marker>HELLO FROM TC7</div>}
    />
  );
}
