# Store Analytics Assistant (web)

Next.js 14 app for Vercel. Data, cache and logs live in Supabase Postgres. Gemini models run through Google's Gemini API. Design: see `../templates/PRD.md` and `../templates/ARCHITECTURE.md`.

Flow: login (role) -> type in the chat -> cache -> planner (small model, big on failure; may clarify or refuse) -> code guard -> checker -> read-only execute as the role's DB user -> cross-check -> narrator -> answer -> log.

## Set up
1. Create a Supabase project. In the SQL editor run `supabase/schema.sql`, then `supabase/roles.sql`.
2. In the same editor run `supabase/functions.sql` (the `run_readonly` and `cache_touch` functions).
3. `cp .env.example .env.local` and fill `SUPABASE_URL` (Project Settings > API), `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` and `SESSION_SECRET`.
4. `python ../make_data.py` (builds `../retail.db`), then `npm install && npm run seed`.
5. `npm run dev`. Run the guard tests with `npm test`.

## Deploy on Vercel
- Import the repo, set the **Root Directory** to `BuildDay/web`, and add the env vars from `.env.example` in the project settings.
- Optional: a Vercel cron can call a route that runs `cachePurge()` to delete expired cache rows (expired rows are never served either way).

## Notes
- Roles: CEO (all three tables), Sales head (`sales`), Product head (`products`), Store head (`stores`). Enforced in the prompt, in `lib/guard.ts` and by Postgres grants (`SET LOCAL ROLE`).
- Cache: 2 hours from the latest search, key = question + role scope. Only cross-checked answers are cached.
- Logs never store returned rows. The Log tab shows a role its own queries and the CEO all of them.
- Cost figures use placeholder rupee prices (`RS_PER_MTOK_IN/OUT`). Set real ones.
- Login is a profile picker with a signed cookie, as scoped in the PRD. It is not real authentication.
