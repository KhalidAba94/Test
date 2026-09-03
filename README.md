# Two of Us

A private, mobile-first daily game for couples. Both partners receive the same prompt, answer separately, wait for each other, reveal together, and can save the moment to a shared Memory Vault.

## Live beta

GitHub Pages is the single deployment target for the current beta:

- https://khalidaba94.github.io/Test/
- Every push to `main` runs CI and deploys through `.github/workflows/deploy-pages.yml`.

## MVP flow

1. Partner A creates a room and receives a 6-character invite code.
2. Partner A shares the invite link or code.
3. Partner B opening the invite link is routed directly to the join screen with the code prefilled.
4. Both receive the same Riyadh-date daily prompt.
5. Answers are submitted privately through Supabase RPCs.
6. The database reveals the round only after two distinct answers exist.
7. Both clients update through Supabase Realtime with a 5-second polling fallback.
8. Either partner can save the reveal to the shared Memory Vault.

## Stack

- React 18 + TypeScript + Vite
- Supabase Anonymous Auth, Postgres, RLS/RPC, Realtime
- GitHub Pages deployment
- GitHub Actions CI

## Supabase security model

The Supabase project URL and publishable key are client-visible by design. They are not treated as secrets. Access control is enforced server-side with authenticated anonymous sessions, RLS, restricted RPC grants, and answer privacy rules. The current join throttle is an abuse guard, not a complete brute-force boundary.

`join_couple_room` limits each anonymous session to 5 invite-code attempts per 10-minute window. A caller can create a fresh anonymous session (subject to Supabase Auth rate limits), so this does not substitute for IP/edge throttling or CAPTCHA if the beta becomes public. The 6-character hexadecimal code space contains 16,777,216 possibilities, which makes casual guessing impractical but does not remove the need for stronger public-launch controls.

Never put a Supabase service-role/secret key in this frontend.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The application contains no fallback credentials. Vite validates the required Supabase variables while resolving the build config, so `npm run build` fails before producing an artifact when configuration is missing.

## Build

```bash
npm install
npm run build
```

## Two-phone acceptance test

- Phone A creates a room.
- Share the generated invite link to Phone B and confirm it opens directly on Join with the code prefilled.
- Phone B joins.
- Both see the same prompt.
- A answers; A cannot see B's answer.
- B answers; both reveal automatically.
- Save to Memory Vault; verify it appears on both devices.
- Navigate Memories → Today and confirm the current round remains correctly marked saved.
- Close/reopen both browsers; both remain in the same couple room.
- Repeat on another Riyadh-date round and confirm the new round is not incorrectly pre-marked saved.
- Test creator cancellation from a waiting room.
- Repeat the core flow on iPhone Safari.
