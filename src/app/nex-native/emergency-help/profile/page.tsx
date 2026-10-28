// src/app/nex-native/emergency-help/profile/page.tsx
//
// NEX Emergency Help · one-time Emergency Profile setup. Collects the
// details a responder needs to recognise + reach a member in a real
// emergency (face photo, legal name, DOB, sex, home address, mobile,
// government ID). This surface is the friction wall that keeps the
// Emergency button serious · pranksters won't bother to enrol a photo
// of their face and upload a copy of their driving licence.
//
// Owner-authorised 2026-10-25 (verbatim intent):
//   "lets build protertype page for when user wants to avivate their
//    emergcey button on nex - we need the following details - live face
//    image with their phone - their home address - name - age - mobile
//    number - copy of driving linces or passprt or minor will require
//    parnets id or birthcert / what do you suggest , haveing them give
//    information stops people spam the system easy for fun."
//
// Prototype status · no persistence, no DB write, no file upload to any
// server. Honest "Illustrative design · Not stored, not shared" footer
// stays until the real face-enrol + ID verification pipeline lands.
//
// Dev-pass pattern · guest viewer can preview in dev; production keeps
// the sealed sign-in redirect.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { EmergencyProfileClient } from "./_profile-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your Emergency Profile · NEX",
  description:
    "The details a responder needs to recognise and reach you in an emergency. Required before you can activate NEX Emergency Help.",
};

export default async function EmergencyProfilePage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session && process.env.NODE_ENV === "production") {
    redirect("/nex-native/sign-in");
  }
  return <EmergencyProfileClient />;
}
