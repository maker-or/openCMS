# OpenCMS CLI

The developer-first CLI for creating and connecting Next.js applications to OpenCMS.

## Requirements

- Node.js 20 or newer
- Git

## Usage

```bash
npx opencms create
npx opencms login
npx opencms logout
npx opencms dev
npx opencms deploy
```

`opencms create` authenticates you, creates an OpenCMS project, pulls the Next.js template, writes the project configuration, and installs dependencies.

The CLI stores its local login configuration in `~/.config/opencms/config.json` (or `$XDG_CONFIG_HOME/opencms/config.json` when configured).
