# 360° feedback for educational leaders

A 360-degree feedback platform for headteachers, deputies, and business managers. Consultants run review cycles from an admin console; raters answer a questionnaire behind a private, unguessable link; a scoring engine turns the responses into a full leader report.

- **App:** Next.js (App Router) + TypeScript + Tailwind
- **Data:** Supabase (Postgres), accessed via a service-role key — there's no end-user auth yet; access is controlled by knowledge of a rater's token or by reaching the admin routes directly
- **Scoring:** a pure, unit-tested TypeScript library in `src/lib/scoring/`, independent of the database and UI
- **Deploy target:** Vercel

## Running it locally

**Prerequisites:** Node.js 20+, and access to the project's Supabase instance (ask whoever set it up for the values below, or create your own Supabase project for a separate environment).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in the values (see [Environment variables](#environment-variables) below):

   ```bash
   cp .env.example .env.local
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

   The admin console is at [http://localhost:3000/admin](http://localhost:3000/admin) (the root path redirects there). A rater's questionnaire lives at `/respond/[token]` — you won't have a token until you create a cycle and add a rater from the admin console, which generates one.

4. Run the scoring engine's test suite:

   ```bash
   npm test
   ```

### Database schema changes

Migrations live in `supabase/migrations/`. To apply new ones to the project's Supabase database, use the Supabase CLI with a direct database connection string (find it in the Supabase dashboard under **Project Settings → Database → Connection string**):

```bash
npx supabase db push --db-url "postgresql://postgres:<password>@<host>:5432/postgres"
```

This doesn't require `supabase login` — the connection string is enough. Add `--dry-run` first if you want to see what would run without applying it.

## Environment variables

All of these are required. `.env.example` lists them; here's what each one is for:

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API | Safe to expose to the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API | Safe to expose to the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API (click reveal) | **Server-only, never expose to the client.** Bypasses row-level security — this is what the admin console and rater questionnaire both use to read and write data, since there's no end-user auth layer yet |
| `NEXT_PUBLIC_APP_URL` | — | The public URL raters' invite links are built from. `http://localhost:3000` locally; your production domain once deployed |

## Deploying to Vercel

This repo isn't connected to Vercel yet. The standard path (recommended over a one-off CLI deploy, since it gives you automatic deploys on every push and preview deployments on pull requests):

1. **Push this repo to GitHub** (if you haven't already):

   ```bash
   git remote add origin <your-empty-github-repo-url>
   git push -u origin master
   ```

2. **Import the project in Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo.
   - Framework preset should auto-detect as Next.js — leave the build settings as default.

3. **Add the environment variables** from the table above in the Vercel project's **Settings → Environment Variables**, for the Production (and Preview, if you want preview deployments to work against the same Supabase project) environments. Set `NEXT_PUBLIC_APP_URL` to your actual Vercel domain (e.g. `https://your-project.vercel.app`, or a custom domain once you attach one).

4. **Deploy.** Vercel will build and deploy automatically. Every subsequent `git push` to the connected branch deploys again.

### Deploying changes after the initial setup

Once connected, deploying changes is just:

```bash
git add <files>
git commit -m "..."
git push
```

Vercel picks up the push and deploys automatically — no separate deploy step. Check the Vercel dashboard for build logs if a deploy fails.

If a change includes a new database migration, push it to Supabase (see [Database schema changes](#database-schema-changes) above) **before** or at the same time as deploying the app code that depends on it — the app doesn't run migrations itself.

## Project structure

```
src/app/admin/          Admin console: create cycles, invite raters, view the report
src/app/respond/[token] The rater-facing questionnaire
src/lib/scoring/         Pure scoring functions (competency overview, blind spots,
                         rater group comparison, development priorities, etc.) — no
                         Supabase or React imports, fully unit-tested with Vitest
src/lib/report/          Fetches cycle data from Supabase and feeds it through the
                         scoring engine to build the data a report page renders
src/lib/respond/         Shared logic for the rater questionnaire (briefing copy,
                         which items a rater group is assigned)
supabase/migrations/     Database schema, applied in order
scripts/generate_seed.py Regenerates the item-bank seed migration from the source
                         spec spreadsheet, if the item bank ever changes
```
