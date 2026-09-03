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
4. Both receive the same shared prompt.
5. Answers are submitted privately through Supabase RPCs.
6. The database reveals the round only after two distinct answers exist.
7. Either partner can save the reveal to the shared Memory Vault.
8. Either partner can start the next question; the other phone follows automatically through Realtime with a 5-second polling fallback.
9. Completed rounds and answers are retained, so multiple rounds can be played on the same Riyadh date without overwriting earlier tests.

## Retained test history

Completed rounds are not reset when a new question starts. `daily_rounds` stores sequential `round_number` values per couple/date and `answers` remains linked to each round. This gives us a durable history to use for repeat avoidance, future history views, resurfacing old answers, streaks, personalization, and content-quality analysis. Memory Vault is intentionally a curated subset of that broader round history.

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

TypeScript/Vite build failures remain blocking in CI; the dependency audit is advisory so an upstream vulnerability notice cannot by itself prevent an otherwise valid beta build.

## Two-phone acceptance test

- Phone A creates a room.
- Share the generated invite link to Phone B and confirm it opens directly on Join with the code prefilled.
- Phone B joins.
- Both see the same prompt.
- A answers; A cannot see B's answer.
- B answers; both reveal automatically.
- Save to Memory Vault; verify it appears on both devices and the button becomes saved.
- Start **Next question** on either device and confirm the other device follows to the same new round.
- Complete at least three questions on the same date and confirm earlier answers are not overwritten.
- Navigate Memories → Today and confirm saved state remains tied to the correct round.
- Close/reopen both browsers; both remain in the same couple room and return to the latest round.
- Test creator cancellation from a waiting room.
- Repeat the core flow on iPhone Safari.
