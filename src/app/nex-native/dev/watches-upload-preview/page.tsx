// src/app/nex-native/dev/watches-upload-preview/page.tsx
//
// Owner directive 2026-10-26 · dev-only mirror of the Shop > Watches
// upload page skeleton at /manage/watches/new. The /manage/* path is
// sealed behind sign-in · this /dev/ route lets the owner preview the
// form during build without logging in. UI-identical · same client.

import { UploadClient } from "../../manage/watches/new/_upload-client";

export const metadata = {
  title: "Dev · Watches Upload Preview · NEX",
  description:
    "Dev-only preview of the shop watches upload page skeleton. Does not persist.",
};

export default async function DevUploadPreviewPage(): Promise<React.JSX.Element> {
  return <UploadClient />;
}
