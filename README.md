# Firstbase

CLI scaffold for starting a React or Next.js app with a production-oriented Tailwind foundation.

## What it does

- Creates a new project folder from an interactive prompt
- Supports `Next.js` and `React + Vite`
- Targets the current stable React 19 and Next.js 16 lines
- Writes a Tailwind theme, starter page, and shared CSS variables
- Adds optional shadcn-ready component wiring
- Adds an optional Husky pre-commit hook
- Writes a minimal Axios client with a response interceptor
- Generates `.env.local` and `.env.example`
- Generates a production `.gitignore`
- Adds Prettier with import sorting
- Adds a GitHub Actions CI workflow with dependency audit
- Adds a PR-only GitHub Dependency Review workflow
- Adds an optional Socket Security workflow when `SOCKET_SECURITY_API_KEY` and `SOCKET_ORG` are configured in GitHub
- Generates a production `.gitignore` with build, cache, log, editor, and env entries
- Offers a fast default setup or an advanced mode with React Query, SEO metadata, tests, and language support
- Advanced mode can also add auth scaffolding, validated forms, a toast system, and an i18n language switcher
- Generates a stack-aware README inside the created app so the selected tech choices are documented automatically
- Includes a version manifest in the generated app README so installed package versions are visible after setup
- Generates `docs/production-setup.md` inside each app with package versions, selected modules, quality commands, and integration steps
- Adds secure defaults for project-name validation, env placeholders, secret file ignores, Axios timeouts, Next.js security headers, and release guardrails
- Generates a Vite alias config for React so shadcn-style imports work in the browser too
- Uses animated CLI step messages

## Install

```bash
npx @aksh_npm/firstbase@latest
```

If you are developing this package locally:

```bash
npm install
npm run build
npm run start
```

## Usage

Run the CLI and answer the prompts:

```bash
npx @aksh_npm/firstbase
```

The prompts let you choose:

- Project name
- Framework: `React (Vite)` or `Next.js`
- Language: `JavaScript` or `TypeScript`
- Next.js routing: `App Router` or `Pages Router`
- UI library: `None` or `Shadcn UI`
- Husky pre-commit hook: on or off
- Advanced setup: `Skip extra setup` or `Go advanced`
- Advanced mode extras:
  - React Query
  - Auth scaffold
  - Forms stack
  - Toast system
  - Language support
  - SEO metadata for Next.js
  - Test setup

## Generated foundation

The theme setup writes:

- `tailwind.config.js` or `tailwind.config.ts`
- `app/globals.css` for Next.js App Router
- `styles/globals.css` for Next.js Pages Router
- `src/index.css` for React + Vite
- a starter page that uses Tailwind utility classes immediately
- a floating dark/light theme toggle on the starter page

The optional shadcn setup writes:

- `components.json`
- `components/ui/button`, `components/ui/card`, `components/ui/badge`, `components/ui/input`, `components/ui/label`, `components/ui/textarea`, and `components/ui/separator`
- `lib/utils` or `src/lib/utils`

The optional Husky setup writes:

- `prepare` and `check` scripts in the generated `package.json`
- `.husky/pre-commit`
- a pre-commit quality gate that runs `npm run check`
- no network calls in the default hook

The API client writes:

- `lib/api.js` or `lib/api.ts` for Next.js
- `src/lib/api.js` or `src/lib/api.ts` for React + Vite
- `lib/env.js` or `lib/env.ts` for Next.js
- `src/lib/env.js` or `src/lib/env.ts` for React + Vite
- a basic response interceptor that redirects `401` responses to `/login`
- a 15 second timeout
- same-origin request enforcement for the configured API instance
- `.env.local` and `.env.example` with the API base URL variable

The formatting and CI setup writes:

- `.prettierrc.cjs`
- `.prettierignore`
- `.github/workflows/ci.yml`
- `.github/workflows/socket.yml`
- `.nvmrc` and `.node-version` pinned to Node `20.19.0`
- `eslint.config.mjs` for Next.js projects
- `next.config.*` with baseline security headers for Next.js projects
- `format` and `format:check` scripts in the generated `package.json`
- `check` script in the generated `package.json`
- `.gitignore`

The advanced setup can additionally write:

- `query-client` and `Providers` for React Query
- `auth` provider and demo auth panel
- `contact-form` scaffold built with React Hook Form and Zod
- `toast-demo` scaffold and `sonner` wiring
- `i18n` provider and language switcher
- homepage feature sections that appear based on the advanced selections
- `vitest.config.*`, `test/setup.*`, and a sample component test
- selected-module tests for auth and forms when those modules are enabled
- SEO metadata for Next.js App Router or Pages Router

The generated app also receives:

- `docs/production-setup.md`
- a package version manifest tailored to the selected setup
- integration steps for env setup, local development, tests, Husky, CI, and production builds

## Notes

- The generator now writes starter content with real Tailwind classes so the build does not start from an empty content scan.
- The API client now validates the env value before creating Axios, so a missing URL fails fast with a clear error.
- Prettier is configured to sort imports consistently.
- Generated projects include a production `.gitignore` and an initial README note about the first commit being prepared.
- The CLI now animates the major scaffold steps, not just the intro banner.
- The generator keeps the fast path short and only asks advanced questions when you choose `Go advanced`.
- The advanced flow now includes auth, forms, toast, and language prompts in addition to React Query, SEO, and tests.
- The generated homepage now visibly shows the selected advanced sections.
- The generated homepage now includes an interactive showcase for auth, forms, and toasts.
- The generated app README is tailored to the selected stack, features, and layout.
- React + Vite projects now get a runtime `@` alias in `vite.config.*` plus matching shadcn alias config.
- React projects target React `19.2.5`; Next.js projects target Next.js `16.2.4` and React `19.2.5`.
- Next.js 16 uses Turbopack by default, and the generator uses `eslint .` instead of the removed `next lint` command.
- Direct CLI package dependencies are pinned exactly, and generated app install commands use exact versions with `--save-exact`.
- Generated CI runs `npm audit --audit-level=high`; Husky does not run audit so commits do not trigger network calls.
- Generated GitHub Dependency Review runs in its own pull-request workflow so push CI does not show a skipped dependency-review step. It passes with a plain log message until GitHub dependency graph support is enabled for the repository.
- Generated Socket Security workflow always runs a preflight job, skips cleanly when the Socket token is not configured, and requires the repository variable `SOCKET_ORG` to contain the Socket organization slug.
- npm publishing is guarded by CI-only release workflow checks, npm provenance, dry-run package inspection, and release checksums.
- The CLI does not collect telemetry.
- The CLI refuses to scaffold into a non-empty folder so stale files do not leak into new runs.
- The CLI now prints a friendly error instead of a raw stack trace when setup fails.
- If you want a clean fresh generation, delete the output folder and rerun the CLI.

## Development

```bash
npm install
npm run build
```

The compiled binary is written to `dist/bin/firstbase.js`.
