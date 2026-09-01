# OpenCMS CLI

The developer-first CLI for creating and connecting Next.js applications to OpenCMS.

## Requirements

- Node.js 20 or newer
- Git

## Usage

```bash
npx @maker-or/opencms create
npx @maker-or/opencms login
npx @maker-or/opencms logout
npx @maker-or/opencms dev
npx @maker-or/opencms deploy
```

`opencms create` authenticates you, creates an OpenCMS project, pulls the Next.js template, writes the project configuration, and installs dependencies.

`opencms login` refreshes the saved browser session. The CLI also retries a management request once with a fresh browser session when the saved session has expired.

The generated `cms/schema.json` file defines the project's content types and allowed blocks. The CLI syncs it to the development environment when `dev` or `deploy` runs.

`opencms deploy` promotes the development schema and only published development pages as one production snapshot. Draft pages stay out of production and production pages no longer present in the published development snapshot are removed. When `VERCEL_TOKEN` is set, the command also deploys the application with its project ID, API origin, and production CMS environment supplied to Vercel at build time and runtime.

The CLI stores its local login configuration in `~/.config/opencms/config.json` (or `$XDG_CONFIG_HOME/opencms/config.json` when configured).

The CLI uses the OpenCMS control-plane origin from `OPENCMS_URL`. Set it to the dashboard/API origin for your hosted, local, or self-hosted instance. `OPENCMS_API_URL` and `OPENCMS_DASHBOARD_URL` remain supported as separate legacy overrides, but there is no baked-in deployment URL.

For example:

```bash
export OPENCMS_URL=https://your-opencms-domain.example
npx @maker-or/opencms login
```
