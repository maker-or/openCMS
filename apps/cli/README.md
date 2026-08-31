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

The CLI stores its local login configuration in `~/.config/opencms/config.json` (or `$XDG_CONFIG_HOME/opencms/config.json` when configured).
