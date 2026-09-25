// Root redirects to the NEX app home.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX", robots: { index: false } };

export default function Home(): never {
  redirect("/nexapp");
}
