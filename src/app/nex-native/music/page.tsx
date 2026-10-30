// src/app/nex-native/music/page.tsx
//
// Owner-authorised 2026-10-29 · DRAFT §14 S2.4.
// Library index · same component as the upload page but navigates
// to upload. For v1 we simply redirect to the Create → Upload Music
// surface so there is one entry point. A future expansion can split
// Library and Upload if the owner authors a separate contract.

import { redirect } from "next/navigation";

export default function MusicLibraryIndex(): never {
  redirect("/nex-native/create/upload-music");
}
