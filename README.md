# Firstbase

A CLI for scaffolding React or Next.js projects with a practical Tailwind baseline.

Firstbase creates a new app from an interactive prompt and can add common project foundations such as styling, environment files, formatting, API client setup, optional UI components, tests, auth scaffolding, forms, toasts, i18n, and SEO helpers.

## Install

Run it directly with `npx`:

```bash
npx create-firstbase-app@latest
```

## Usage

```bash
npx create-firstbase-app
```

The CLI asks for the project name and setup choices, then creates a new project folder.

## Options

Firstbase can generate:

- React + Vite or Next.js apps
- JavaScript or TypeScript projects
- Tailwind theme setup with starter pages
- Optional shadcn-ready component wiring
- Environment file templates
- Axios API client setup
- Formatting scripts and Prettier config
- Optional Husky pre-commit setup
- Optional advanced modules for React Query, auth, forms, toasts, i18n, SEO, and tests

## Generated Project

Each generated app includes a README tailored to the choices you selected. It documents the installed stack, scripts, project structure, and follow-up setup steps for that app.

## Local Development

If you are working on this CLI locally:

```bash
npm install
npm run build
npm run start
```

The compiled CLI entrypoint is written to `dist/bin/firstbase.js`.

## Requirements

Firstbase requires Node.js `22.22.2` or newer.

## License

MIT
