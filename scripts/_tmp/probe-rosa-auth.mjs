import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8");
const url = env.match(/^NEXT_PUBLIC_NEX_SUPABASE_URL=(.*)$/m)[1].trim();
const key = env.match(/^NEX_SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)[1].trim();
if (!url.includes("kdstoyyeygcopkogqsyv")) throw new Error("not sandbox");
const supa = createClient(url, key);

// List users and find p6-seller
const { data, error } = await supa.auth.admin.listUsers({ perPage: 200 });
if (error) throw error;
const seller = data.users.find((u) => u.email === "p6-seller@nex.invalid");
console.log("seller:", JSON.stringify({ id: seller?.id, email: seller?.email, confirmed_at: seller?.email_confirmed_at, last_sign_in_at: seller?.last_sign_in_at, updated_at: seller?.updated_at }, null, 2));

// Try to sign in with the known password to verify
const anonKey = env.match(/^NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();
if (anonKey) {
  const anon = createClient(url, anonKey);
  const res = await anon.auth.signInWithPassword({
    email: "p6-seller@nex.invalid",
    password: "fA1pgYwWjE93d79yULj3JaRm",
  });
  console.log("signIn:", res.error ? `ERROR ${res.error.message}` : `OK user ${res.data.user?.id}`);
}
