# NEX App

Minimal standalone NEX authentication + chat surface. Dark navy visual
language with cyan technical accents and NEX orange CTA.

## Routes

- `/` — redirects to `/nexapp`
- `/nexapp` — chat home (gated; unauthenticated visitors bounce to `/nexapp/welcome`)
- `/nexapp/welcome` — create-account landing (name + email + password + face alt)
- `/nexapp/sign-in` — password sign-in (email + password + face alt)
- `/nexapp/face-sign-in` — biometric scan surface (real getUserMedia; honestly
  reports "biometric enrolment not active" until a face-matching backend is wired)

## API

- `POST /api/nex/sign-up` — Supabase `auth.signUp` (email + password + full_name)
- `POST /api/nex/sign-in` — Supabase `auth.signInWithPassword`

## Setup

```bash
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Dev server runs at http://localhost:3009.

## Notes

- The sign-up and sign-in API routes return 503 with a clear message when the
  Supabase env vars are missing, so local dev doesn't 500 before you've set up
  the backend.
- The face sign-in page runs a real camera session and stops all tracks on
  unmount / back / password fallback. It does not fake a successful biometric
  match — swap the second `setTimeout` in `FaceSignInShell.tsx` when you wire
  a real face-verification endpoint.
