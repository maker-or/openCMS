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

The web app serves the Elysia API at `/api/health`, `/api/projects`, `/api/projects/:id/schema`, and `/api/projects/:id/pages`. Project, schema, and page endpoints require a Clerk session token and store records in Neon through Drizzle.

## CLI workflow

The CLI pulls the canonical Next.js app from the separately versioned [nextjs-template repository](https://github.com/maker-or/nextjs-template). Set `OPENCMS_TEMPLATE_REPO` to that repository while developing locally. The template includes a `cms/` directory and consumes `NEXT_PUBLIC_OPENCMS_PROJECT_ID`, `OPENCMS_API_URL`, and `OPENCMS_ENVIRONMENT`.

The CLI endpoint is configured with `OPENCMS_URL`, which should point to the OpenCMS dashboard/API origin. The CLI does not embed a deployment-specific Vercel URL. `OPENCMS_API_URL` and `OPENCMS_DASHBOARD_URL` are supported for separate legacy deployments.

```bash
npx @maker-or/opencms login
npx @maker-or/opencms create
cd my-project
npx @maker-or/opencms dev
npx @maker-or/opencms deploy
```

`opencms create` authenticates in the browser, creates a cloud project, clones the template, writes `.env.local`, adds `cms/opencms.ts` and the starter `cms/schema.json`, and installs dependencies. Pages use JSON content made of ordered blocks; Markdown is not part of the content model. The CLI syncs `cms/schema.json` to the development environment before `dev` and `deploy`. The CLI stores its session token in `~/.config/opencms/config.json`; `OPENCMS_CLERK_TOKEN` can be used for non-interactive local testing.

### Defining content

After creating a project, edit `cms/schema.json` in the generated Next.js application. A schema declares reusable blocks and content types. The starter schema includes a `page` type with `heading`, `text`, `quote`, and `feature-list` blocks:

```json
{
  "version": 1,
  "blocks": {
    "hero": {
      "label": "Hero",
      "fields": {
        "headline": { "type": "text", "required": true },
        "centered": { "type": "boolean" }
      }
    }
  },
  "contentTypes": {
    "page": {
      "label": "Page",
      "fields": {
        "title": { "type": "text", "required": true },
        "slug": { "type": "slug", "required": true, "unique": true }
      },
      "blocks": ["hero"]
    }
  }
}
```

The supported field types are `text`, `slug`, `number`, and `boolean`. Run `npx @maker-or/opencms dev` after changing the file to sync it to development. Development and production schemas are isolated: an incompatible development schema is rejected while pages still use removed blocks, and `deploy` promotes the development schema with the published page snapshot. The dashboard uses the selected environment's schema when reading pages, and each page is stored as JSON with an ordered `blocks` array.

Set `VERCEL_TOKEN` when `opencms deploy` should also run the Vercel production deployment for the current application. The CLI supplies the OpenCMS project ID, API origin, and production environment to both the Vercel build and runtime. Without `VERCEL_TOKEN`, deploy promotes published development content to the read-only production environment but does not deploy the Next.js application.

## Release checks

Run the same gate used by CI before pushing:

```bash
bun run check
```

This runs lint with zero warnings, package tests, all TypeScript checks, and the production dashboard build. Set `TEST_DATABASE_URL` to an isolated Neon database to include the deployment integration test.

## Database commands

Run these from the repository root after setting `DATABASE_URL`:

```bash
bun run db:generate
bun run db:migrate
```

For quick local iteration, `bun run db:push` applies the schema without creating a migration file.
