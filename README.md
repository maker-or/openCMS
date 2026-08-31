# OpenCMS

OpenCMS is a Bun workspace monorepo for a developer-first headless CMS: a cloud dashboard/API, a terminal CLI, and a shared TypeScript SDK.

## Workspace layout

```text
apps/
  web/       Next.js dashboard/API, Tailwind CSS, Clerk, Elysia
  cli/       Bun CLI: create, login, logout, dev, deploy
packages/
  db/        Drizzle ORM schema and Neon HTTP client
  sdk/       Typed API client and Clerk request-auth helper
```

## Getting started

1. Install Bun 1.4 or newer.
2. Copy `.env.example` to `apps/web/.env.local` and fill in Clerk keys and `DATABASE_URL`.
3. Install all workspace dependencies:

   ```bash
   bun install
   ```

4. Start the web app:

   ```bash
   bun run dev
   ```

5. In another terminal, run the OpenTUI client:

   ```bash
   OPENCMS_CLERK_TOKEN=your_session_token bun run dev:cli
   ```

The web app serves the Elysia API at `/api/health`, `/api/projects`, and `/api/projects/:id/pages`. Project and page endpoints require a Clerk session token and store records in Neon through Drizzle.

## CLI workflow

The CLI pulls the canonical Next.js app from a separately versioned GitHub template repository. Set `OPENCMS_TEMPLATE_REPO` to that repository while developing locally. The template should include a `cms/` directory and consume `NEXT_PUBLIC_OPENCMS_PROJECT_ID`, `OPENCMS_API_URL`, and `OPENCMS_ENVIRONMENT`.

```bash
npx opencms login
npx opencms create
cd my-project
npx opencms dev
npx opencms deploy
```

`opencms create` authenticates in the browser, creates a cloud project, clones the template, writes `.env.local`, adds `cms/opencms.ts`, and installs dependencies. The CLI stores its session token in `~/.config/opencms/config.json`; `OPENCMS_CLERK_TOKEN` can be used for non-interactive local testing.

Set `VERCEL_TOKEN` when `opencms deploy` should also run the Vercel production deployment for the current application. Without it, deploy promotes CMS content only.

## Database commands

Run these from the repository root after setting `DATABASE_URL`:

```bash
bun run db:generate
bun run db:migrate
```

For quick local iteration, `bun run db:push` applies the schema without creating a migration file.
