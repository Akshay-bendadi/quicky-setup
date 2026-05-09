# Firstbase Production Scaffold

This document records what the CLI generates for production-oriented React and Next.js starters.

## Generated Project Baseline

- Frameworks: React + Vite or Next.js.
- Languages: JavaScript or TypeScript.
- Styling: Tailwind CSS with CSS variables, dark mode, responsive starter page, and real utility classes for content scanning.
- UI: optional shadcn/ui-compatible local primitives generated as source files.
- API: Axios client, environment helper, `.env.local`, and `.env.example`.
- Quality: Prettier, import sorting, GitHub Actions CI, dependency audit, optional Socket policy scan, generated `.gitignore`, and optional Husky pre-commit hook.
- Advanced modules: React Query, auth scaffold, validated forms, Sonner toasts, i18n language switcher, SEO metadata, and Vitest tests.
- Node target: generated apps use `>=22.22.2` so both Next.js 16 and Vite 8 tooling are supported on the current Node 22 security line.
- Node version files: generated apps include `.nvmrc` and `.node-version` pinned to `22.22.2`.

## Generated Package Versions

| Package | Version | Used For |
| --- | --- | --- |
| create-next-app | 16.2.6 | Next.js bootstrap command |
| create-vite | 9.0.6 | React + Vite bootstrap command |
| next | 16.2.6 | Next.js generated apps |
| vite | 8.0.11 | React generated apps |
| @vitejs/plugin-react | 6.0.1 | React Fast Refresh for Vite |
| react | 19.2.6 | UI runtime |
| react-dom | 19.2.6 | DOM renderer |
| eslint | 10.3.0 | Next.js linting through ESLint CLI |
| eslint-config-next | 16.2.6 | Next.js ESLint rules |
| @types/react | 19.2.14 | React TypeScript definitions |
| @types/react-dom | 19.2.3 | React DOM TypeScript definitions |
| @types/node | 22.19.18 | Node.js TypeScript definitions |
| typescript | 6.0.3 | Generated TypeScript projects |
| tailwindcss | 3.4.19 | Styling foundation |
| postcss | 8.5.14 | Tailwind processing |
| autoprefixer | 10.5.0 | CSS vendor prefixing |
| axios | 1.16.0 | API client |
| lucide-react | 1.14.0 | Icons |
| prettier | 3.8.3 | Formatting |
| @trivago/prettier-plugin-sort-imports | 6.0.2 | Import sorting |
| husky | 9.1.7 | Optional pre-commit hook |
| class-variance-authority | 0.7.1 | shadcn-style variants |
| clsx | 2.1.1 | Class composition |
| tailwind-merge | 3.5.0 | Tailwind class merging |
| tailwindcss-animate | 1.0.7 | Animation utilities |
| @tanstack/react-query | 5.100.9 | Advanced server-state setup |
| react-hook-form | 7.75.0 | Advanced forms |
| zod | 4.4.3 | Form validation |
| @hookform/resolvers | 5.2.2 | React Hook Form + Zod resolver |
| sonner | 2.0.7 | Toast notifications |
| vitest | 4.1.5 | Advanced test runner |
| jsdom | 29.1.1 | DOM test environment |
| @testing-library/react | 16.3.2 | Component tests |
| @testing-library/jest-dom | 6.9.1 | DOM matchers |
| socket | 1.1.92 | Optional Socket Security CI policy scan |

## Generated Scripts

- `npm run dev` starts the local app.
- `npm run build` creates the production build.
- `npm run format` writes Prettier changes.
- `npm run format:check` verifies formatting.
- `npm run lint` is generated for Next.js projects and runs the ESLint CLI.
- `npm run test` runs Vitest once when advanced tests are selected.
- `npm run test:watch` runs Vitest in watch mode when advanced tests are selected.
- `npm run check` is the production quality gate used by CI and Husky.
- `npm audit --audit-level=high` runs in CI only so the default Husky hook never makes network requests.

## CLI Package Direct Versions

The CLI package itself pins direct dependencies exactly:

| Package | Version | Used For |
| --- | --- | --- |
| chalk | 5.6.2 | CLI terminal output |
| prompts | 2.4.2 | Interactive prompt flow |
| axios | 1.16.0 | Generated API client dependency |
| lucide-react | 1.14.0 | Generated icon dependency |
| class-variance-authority | 0.7.1 | Generated shadcn-style variants |
| clsx | 2.1.1 | Generated class composition |
| tailwind-merge | 3.5.0 | Generated Tailwind class merging |
| @tanstack/react-query | 5.100.9 | Generated React Query module |
| react-hook-form | 7.75.0 | Generated forms module |
| zod | 4.4.3 | Generated validation module |
| @hookform/resolvers | 5.2.2 | Generated form resolver |
| sonner | 2.0.7 | Generated toast module |
| typescript | 6.0.3 | CLI build and generated TypeScript apps |
| @types/node | 22.19.18 | Node.js TypeScript definitions |
| @types/prompts | 2.4.9 | Prompt library TypeScript definitions |
| prettier | 3.8.3 | Formatting |
| react | 19.2.6 | Test peer dependency and generated React runtime pin |
| react-dom | 19.2.6 | Test peer dependency and generated DOM renderer pin |
| @trivago/prettier-plugin-sort-imports | 6.0.2 | Import sorting |
| husky | 9.1.7 | Hook generation support |
| vitest | 4.1.5 | Generated test runner |
| jsdom | 29.1.1 | Generated DOM test environment |
| @testing-library/react | 16.3.2 | Generated component tests |
| @testing-library/jest-dom | 6.9.1 | Generated DOM matchers |
| tailwindcss-animate | 1.0.7 | Generated animation utilities |

## Husky And CI

When Husky is selected, the generated app gets:

- `prepare: husky` in `package.json`.
- `.husky/pre-commit` running `npm run check`.
- `git config core.hooksPath .husky` during scaffold creation.

The generated GitHub Actions CI workflow uses Node `22.22.2`, installs with `npm ci`, runs `npm audit --audit-level=high`, and runs `npm run check`, so local hooks and CI use the same gate.

The generated Dependency Review workflow runs only on pull requests, so push CI does not include a skipped dependency-review step. It preflights GitHub dependency graph support and passes with a plain log message until the repository can run Dependency Review.

Generated apps also include `.nvmrc` and `.node-version` so local Node managers can match CI.

Next.js 16 uses Turbopack by default for `next dev` and `next build`, so no `--turbo` flag is generated.

The default Husky hook only runs local scripts. It does not make network requests and does not interpolate user input.

The generated `socket.yml` workflow always runs a preflight job and skips cleanly when the Socket token is not configured. It requires the repository variable `SOCKET_ORG` to contain the Socket organization slug. The Socket CLI install is pinned to `socket@1.1.92`.

## shadcn/ui-Compatible Files

When shadcn is selected, the generator writes these local primitives:

- `button`
- `card`
- `badge`
- `input`
- `label`
- `textarea`
- `separator`

The generator also writes `components.json` and `lib/utils` or `src/lib/utils` with `clsx` and `tailwind-merge`.

## Advanced Test Coverage

When advanced tests are selected, the generator writes:

- `vitest.config.ts` for TypeScript projects or `vitest.config.mjs` for JavaScript projects.
- `test/setup.ts` or `test/setup.js` with Testing Library cleanup and jest-dom matchers.
- `test/theme-toggle.*` for the theme toggle.
- `test/auth-panel.*` when auth is selected.
- `test/contact-form.*` when forms are selected.

The generated `npm run check` includes tests only when the user selects the advanced test setup.

## Generated Security Defaults

- Install commands use exact package versions and `--save-exact`.
- `.env.example` uses fake placeholder values such as `YOUR_API_BASE_URL_HERE`.
- `.gitignore` excludes `.env`, `.env.local`, `.env.production`, `.npmrc`, private keys, certificates, and service account JSON files.
- The Axios client sets a 15 second timeout.
- The Axios client blocks cross-origin absolute requests from the configured API instance and removes authorization headers before throwing.
- Next.js projects receive `next.config.*` with baseline security headers and a Content Security Policy.
- GitHub Dependency Review runs in `.github/workflows/dependency-review.yml` on pull requests when GitHub dependency graph support is available.
- CI includes an optional Socket policy scan for malicious package behavior and install-script risk when `SOCKET_SECURITY_API_KEY` and `SOCKET_ORG` are set in GitHub.

## Generated Project Documentation

Every generated app receives `docs/production-setup.md`. That file is tailored to the selected framework, language, routing mode, shadcn choice, Husky choice, advanced modules, Node engine, quality commands, and package versions.

## CLI Package Release Security

- This repository pins direct dependencies exactly in `package.json`.
- `.npmignore` excludes source templates, scripts, local config, test fixtures, and secret-like files from published packages.
- Templates are local code bundled in the CLI; `npm run build` writes `dist/template-manifest.json` and `dist/template-manifest.sha256`.
- `npm run template:verify` verifies the generated template manifest before CI/release passes.
- `npm run pack:dry-run` shows exactly what would be shipped.
- `prepublishOnly` blocks local publish attempts except dry runs.
- The release workflow publishes from the protected `npm-publish` GitHub environment with npm provenance.
- Release tarballs and SHA-256 checksums are attached to GitHub releases.
- `SECURITY.md` defines vulnerability reporting expectations.
- `.github/workflows/dependency-review.yml` runs GitHub Dependency Review only on pull requests and passes with a plain log message when the repository does not support it yet.
- `.github/workflows/socket.yml` runs a pinned Socket CLI policy scan when `SOCKET_SECURITY_API_KEY` and `SOCKET_ORG` are configured.
