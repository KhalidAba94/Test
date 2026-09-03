# Two of Us

A private, mobile-first daily game for couples. Both partners receive the same prompt, answer separately, wait for each other, reveal together, and can save the moment to a shared Memory Vault.

Live beta: https://khalidaba94.github.io/Test/

## MVP flow

1. Partner A creates a room and receives a 6-character invite code.
2. Partner B joins on another device using the code or invite link.
3. Both receive the same Riyadh-date daily prompt.
4. Answers are submitted privately through Supabase RPCs.
5. The database reveals the round only after two distinct answers exist.
6. Both clients update through Supabase Realtime with a 5-second polling fallback.
7. Either partner can save the reveal to the shared Memory Vault.

## Stack

- React 18 + TypeScript + Vite
- Supabase Anonymous Auth, Postgres, RLS/RPC, Realtime
- GitHub Pages beta deployment
- GitHub Actions build check

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

Never put a Supabase service-role/secret key in this frontend.

## Build

```bash
npm install
npm run build
```

## Two-phone acceptance test

- Phone A creates a room.
- Phone B joins.
- Both see the same prompt.
- A answers; A cannot see B's answer.
- B answers; both reveal automatically.
- Save to Memory Vault; verify it appears on both devices.
- Close/reopen both browsers; both remain in the same couple room.
- Repeat on another day/prompt and test iPhone Safari.
