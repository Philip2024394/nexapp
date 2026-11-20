#!/usr/bin/env node
// scripts/probe-disposable-auth-sandbox.mjs
//
// Read-only + non-mutating credential probe · asks the sandbox:
//   (A) does p6-customer@nex.invalid exist, and is its email confirmed?
//   (B) does p6-seller@nex.invalid exist, and is its email confirmed?
//   (C) does the password in `.env.playwright.p6` still sign in through
//       the normal password-grant path (no admin-key auth, same path the
//       login form uses)?
//
// This script makes NO INSERTs, NO UPDATEs, NO DELETEs. It only reads
// via admin-list and then issues a single signInWithPassword (which is
// a /auth/v1/token read — the Supabase auth log records a login event
// but no row is created/mutated in application tables).
//
// Refuses to run against anything other than the sealed sandbox
// `kdstoyyeygcopkogqsyv`.
//
// 2026-11-18 · prompt-2 Task #146.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env.playwright.p6"));

const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;
const serviceKey =
  process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_NEX_SUPABASE_URL / NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY" +
      " / service role key.",
  );
  process.exit(2);
}

const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
if (!url.includes(SANDBOX_REF)) {
  console.error(
    `REFUSED · URL ${url} is not sandbox (${SANDBOX_REF}). This probe runs` +
      " only against sandbox.",
  );
  process.exit(3);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  // Paginated list — the sandbox is small enough for this to terminate
  // quickly. Returns the first match or null.
  let page = 1;
  // Hard cap so we don't loop forever on unexpected sandbox size.
  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return { error: error.message };
    if (!data || !data.users || data.users.length === 0) return { user: null };
    const match = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (match) {
      return {
        user: {
          id: match.id,
          email: match.email,
          email_confirmed_at: match.email_confirmed_at ?? null,
          confirmed_at: match.confirmed_at ?? null,
          last_sign_in_at: match.last_sign_in_at ?? null,
          created_at: match.created_at,
        },
      };
    }
    if (data.users.length < 200) return { user: null };
    page++;
  }
  return { user: null, note: "pagination exhausted without match" };
}

async function trySignIn(email, password) {
  const { data, error } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { ok: false, code: error.code ?? null, message: error.message };
  // Immediately sign out · do not persist a session.
  await anon.auth.signOut();
  return {
    ok: true,
    userId: data.user?.id ?? null,
    expires_in: data.session?.expires_in ?? null,
  };
}

const EMAILS = [
  {
    role: "customer/buyer",
    email: process.env.PLAYWRIGHT_P6_CUSTOMER_EMAIL ?? "p6-customer@nex.invalid",
    password: process.env.PLAYWRIGHT_P6_CUSTOMER_PASSWORD ?? "",
  },
  {
    role: "seller",
    email: process.env.PLAYWRIGHT_P6_SELLER_EMAIL ?? "p6-seller@nex.invalid",
    password: process.env.PLAYWRIGHT_P6_SELLER_PASSWORD ?? "",
  },
];

const results = {
  project_ref: SANDBOX_REF,
  ts: new Date().toISOString(),
  accounts: [],
};

for (const entry of EMAILS) {
  const lookup = await findUserByEmail(entry.email);
  let signIn = { skipped: true, reason: "account not found" };
  if (lookup.user) {
    if (!entry.password) {
      signIn = { skipped: true, reason: "no password in env" };
    } else {
      signIn = await trySignIn(entry.email, entry.password);
    }
  }
  results.accounts.push({
    role: entry.role,
    email: entry.email,
    account: lookup.user ?? null,
    lookup_error: lookup.error ?? null,
    sign_in: signIn,
  });
}

console.log(JSON.stringify(results, null, 2));
process.exit(0);
