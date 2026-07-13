# Vastos_ARC

## Environments

Three environments, backed by separate Supabase projects (except Dev, which is local):

| Environment | Supabase project | Notes |
|---|---|---|
| Production | `vasto-arch-crm` (`weckowkvqpamnlcqwvfh`) | Live data. Hardcoded fallback in `src/lib/supabase.ts` — works with no env vars set. |
| Staging | `vasto-arch-crm-staging` (`uxmkieetbzegunhakcxk`) | Schema-identical clone of Production, seeded with the demo firm's data. Point `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` at it (see `.env.example`). |
| Dev | Local via Supabase CLI | No cloud project — free, and keeps local iteration off the shared project quota (org is capped at 2 active free cloud projects). |

### Local Dev setup

```bash
npx supabase login          # first time only
npx supabase link --project-ref weckowkvqpamnlcqwvfh   # optional, only if you need to pull further schema changes
npx supabase start          # boots local Postgres/Auth/Storage in Docker, replays supabase/migrations/
```

`supabase start` prints a local API URL + anon key — copy those into `.env.local` (gitignored) as `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, or export them in your shell before `npm run dev`. Because the demo-firm seed data is baked into `supabase/migrations/10_seed_firm_regions_categories.sql` onward, a fresh `supabase start` (or `supabase db reset` to replay from scratch) already gives you a working demo firm to develop against — no manual seeding needed.

Run `npm run dev` as usual; it reads `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from your environment via Vite's standard `.env.local` handling.
