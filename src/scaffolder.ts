import { spawn } from "child_process";
import type { Readable } from "stream";
import fs from "fs";
import path from "path";
import chalk from 'chalk';
import type { Answers } from "./prompts.js";

// Styled console messages
const statusIcon = chalk.hex("#4ECDC4").bold("◆");
const log = {
  info: (message: string) => console.log(chalk.blue(`${statusIcon} ${message}`)),
  success: (message: string) => console.log(chalk.green(`${statusIcon} ${message}`)),
  warning: (message: string) => console.log(chalk.yellow(`${statusIcon} ${message}`)),
  error: (message: string) => console.error(chalk.red(`${statusIcon} ${message}`)),
  step: async (message: string) => {
    const frames = ["◐", "◓", "◑", "◒"];
    for (const frame of frames) {
      process.stdout.write(`\r${chalk.magenta(`${statusIcon} ${message} ${frame}`)}`);
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    process.stdout.write(`\r${chalk.magenta(`${statusIcon} ${message}`)}\n`);
  },
  highlight: (message: string) => console.log(chalk.hex('#FF6B6B')(message)),
  divider: () => console.log(chalk.gray('─'.repeat(process.stdout.columns || 50)))
};

function createFolder(folder: string): void {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

function sanitizeProjectName(projectName: string): string {
  const normalized = stripAnsi(projectName).trim();

  if (!normalized) {
    throw new Error("Project name is required.");
  }

  if (normalized.length > 80) {
    throw new Error("Project name must be 80 characters or fewer.");
  }

  if (normalized.includes("\0") || normalized.includes("/") || normalized.includes("\\") || normalized.includes("..")) {
    throw new Error("Project name cannot contain path traversal characters.");
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(normalized)) {
    throw new Error("Project name can only contain letters, numbers, dashes, and underscores, and must start with a letter or number.");
  }

  const reservedNames = new Set([".", "..", "node_modules", "dist", "build", ".git"]);
  if (reservedNames.has(normalized.toLowerCase())) {
    throw new Error("Project name is reserved. Choose a different name.");
  }

  return normalized;
}

function resolveSafeProjectPath(baseDir: string, projectName: string): string {
  const basePath = path.resolve(baseDir);
  const outputPath = path.resolve(basePath, projectName);

  if (outputPath !== basePath && !outputPath.startsWith(`${basePath}${path.sep}`)) {
    throw new Error("Invalid project name. Refusing to write outside the current directory.");
  }

  return outputPath;
}

function ensureEmptyTarget(projectPath: string, projectName: string): void {
  if (!fs.existsSync(projectPath)) {
    return;
  }

  const entries = fs.readdirSync(projectPath).filter((entry) => entry !== ".DS_Store");
  if (entries.length > 0) {
    throw new Error(
      `Target directory already exists and is not empty: ${projectName}. Remove it or choose a new project name before scaffolding.`
    );
  }
}

function appendBoundedOutput(current: string, next: string, maxLength = 12_000): string {
  const combined = current + next;
  return combined.length > maxLength ? combined.slice(combined.length - maxLength) : combined;
}

function printableCommand(command: string, args: string[]): string {
  return [command, ...args].join(" ");
}

function attachOutputCapture(stream: Readable | null, onData: (chunk: string) => void): void {
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk: string) => onData(chunk));
}

function printCapturedOutput(command: string, args: string[], output: string): void {
  const trimmed = output.trim();

  if (!trimmed) {
    return;
  }

  console.error(chalk.red(`${statusIcon} ${printableCommand(command, args)} output:`));
  console.error(trimmed);
}

async function runCommand(
  command: string,
  args: string[],
  options: {
    stdio?: "inherit" | "ignore";
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    loadingMessage?: string;
    timeoutMs?: number;
  } = {}
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
    let capturedOutput = "";
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio === "ignore" ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: false,
    });

    if (options.stdio === "ignore") {
      attachOutputCapture(child.stdout, (chunk) => {
        capturedOutput = appendBoundedOutput(capturedOutput, chunk);
      });
      attachOutputCapture(child.stderr, (chunk) => {
        capturedOutput = appendBoundedOutput(capturedOutput, chunk);
      });
    }

    const spinnerFrames = ["◐", "◓", "◑", "◒"];
    const loadingMessage = options.loadingMessage ?? `Running ${command}`;
    let spinnerIndex = 0;
    const spinner = setInterval(() => {
      process.stdout.write(
        `\r${chalk.magenta(`${statusIcon} ${loadingMessage} ${spinnerFrames[spinnerIndex % spinnerFrames.length]}`)}`
      );
      spinnerIndex += 1;
    }, 120);
    process.stdout.write(`\r${chalk.magenta(`${statusIcon} ${loadingMessage} ${spinnerFrames[0]}`)}`);

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      clearInterval(spinner);
      process.stdout.write(`\r${chalk.red(`${statusIcon} ${loadingMessage} timed out`)}\n`);
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }, 5_000);
      printCapturedOutput(command, args, capturedOutput);
      reject(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      clearInterval(spinner);
      printCapturedOutput(command, args, capturedOutput);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      clearInterval(spinner);
      process.stdout.write(`\r${chalk.magenta(`${statusIcon} ${loadingMessage}`)}\n`);
      if (code === 0) {
        resolve();
        return;
      }
      printCapturedOutput(command, args, capturedOutput);
      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

function npmInstallArgs(packages: string[], dev = false): string[] {
  return ["install", "--save-exact", "--no-audit", "--no-fund", "--silent", ...(dev ? ["-D"] : []), ...packages];
}

const PACKAGE_VERSIONS = {
  createNextApp: "16.2.6",
  createVite: "9.0.6",
  next: "16.2.6",
  react: "19.2.6",
  reactDom: "19.2.6",
  vite: "8.0.11",
  viteReactPlugin: "6.0.1",
  tailwindcss: "3.4.19",
  postcss: "8.5.14",
  autoprefixer: "10.5.0",
  axios: "1.16.0",
  lucideReact: "1.14.0",
  classVarianceAuthority: "0.7.1",
  clsx: "2.1.1",
  tailwindMerge: "3.5.0",
  tailwindcssAnimate: "1.0.7",
  husky: "9.1.7",
  prettier: "3.8.3",
  prettierSortImports: "6.0.2",
  reactQuery: "5.100.9",
  reactHookForm: "7.75.0",
  zod: "4.4.3",
  hookformResolvers: "5.2.2",
  sonner: "2.0.7",
  vitest: "4.1.5",
  jsdom: "29.1.1",
  testingLibraryReact: "16.3.2",
  testingLibraryJestDom: "6.9.1",
  typescript: "6.0.3",
  typesNode: "22.19.18",
  typesReact: "19.2.14",
  typesReactDom: "19.2.3",
  eslint: "10.3.0",
  socketCli: "1.1.92",
} as const;

function versionedPackage(packageName: string, version: string): string {
  return `${packageName}@${version}`;
}

function createFolders(projectPath: string, framework: Answers["framework"]): void {
  const folders = ["public"];

  if (framework === "next") {
    folders.push("components", "hooks", "lib", "services", "styles", "types", "utils");
  } else {
    folders.push(
      "src/components",
      "src/hooks",
      "src/lib",
      "src/services",
      "src/styles",
      "src/types",
      "src/utils",
      "src/pages",
      "src/routes"
    );
  }

  folders.forEach((folder) => createFolder(path.join(projectPath, folder)));
}

function parseJsonLike(content: string): Record<string, unknown> {
  const withoutBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  const withoutTrailingCommas = withoutLineComments.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(withoutTrailingCommas);
}

function updateAliasConfig(projectPath: string): void {
  const configCandidates = ["tsconfig.json", "jsconfig.json"];
  const configPath = configCandidates
    .map((fileName) => path.join(projectPath, fileName))
    .find((candidate) => fs.existsSync(candidate)) ?? path.join(projectPath, "jsconfig.json");

  const existing = fs.existsSync(configPath)
    ? (() => {
        try {
          return parseJsonLike(fs.readFileSync(configPath, "utf8"));
        } catch {
          return {};
        }
      })()
    : {};
  const compilerOptions = ((existing as { compilerOptions?: Record<string, unknown> }).compilerOptions ?? {}) as Record<string, unknown>;

  compilerOptions.paths = {
    "@/*": ["./*", "./src/*"],
  };

  existing.compilerOptions = compilerOptions;
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
}

function writeFileIfChanged(filePath: string, content: string): void {
  createFolder(path.dirname(filePath));

  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf8");
    if (existing.trim() === content.trim()) {
      return;
    }
  }

  fs.writeFileSync(filePath, content);
}

function huskyHookContent(): string {
  return `#!/usr/bin/env sh
npm run check
`;
}

function makeExecutable(filePath: string): void {
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {
    // Ignore platforms that do not support chmod in the same way.
  }
}

function checkScriptFor(framework: Answers["framework"], includeTests: boolean): string {
  const commands = framework === "next"
    ? ["npm run lint", "npm run format:check"]
    : ["npm run format:check"];

  if (includeTests) {
    commands.push("npm run test");
  }

  commands.push("npm run build");
  return commands.join(" && ");
}

function nodeEngineFor(answers: Answers): string {
  void answers;
  return ">=22.22.2";
}

function formatDuration(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.round(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function folderSizeInMb(folderPath: string): number {
  let totalBytes = 0;

  function walk(currentPath: string): void {
    if (!fs.existsSync(currentPath)) {
      return;
    }

    const stats = fs.lstatSync(currentPath);
    if (stats.isSymbolicLink()) {
      return;
    }

    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(currentPath)) {
        walk(path.join(currentPath, entry));
      }
      return;
    }

    totalBytes += stats.size;
  }

  walk(folderPath);
  return totalBytes / (1024 * 1024);
}

function packageDownloadSizeInMb(projectPath: string): number {
  return folderSizeInMb(path.join(projectPath, "node_modules"));
}

function frameworkLabel(answers: Answers): string {
  return answers.framework === "next" ? "Next.js" : "React + Vite";
}

function routingLabel(answers: Answers): string {
  if (answers.framework !== "next") {
    return "N/A";
  }

  return answers.routing === "app" ? "App Router" : "Pages Router";
}

function advancedFeaturesList(answers: Answers): string[] {
  const features: string[] = [];

  if (answers.reactQuery) features.push("React Query");
  if (answers.auth) features.push("Auth scaffold");
  if (answers.forms) features.push("Forms stack");
  if (answers.toasts) features.push("Toast system");
  if (answers.i18n) features.push("Language support");
  if (answers.seo) features.push("SEO metadata");
  if (answers.tests) features.push("Test setup");

  return features;
}

type PackageManifestItem = {
  name: string;
  version: string;
  purpose: string;
};

function packageManifestItems(answers: Answers): PackageManifestItem[] {
  const items: PackageManifestItem[] = [
    {
      name: answers.framework === "next" ? "create-next-app" : "create-vite",
      version: answers.framework === "next" ? PACKAGE_VERSIONS.createNextApp : PACKAGE_VERSIONS.createVite,
      purpose: "Project bootstrap command",
    },
    {
      name: answers.framework === "next" ? "next" : "vite",
      version: answers.framework === "next" ? PACKAGE_VERSIONS.next : PACKAGE_VERSIONS.vite,
      purpose: answers.framework === "next" ? "Application framework" : "Development server and bundler",
    },
    { name: "react", version: PACKAGE_VERSIONS.react, purpose: "UI runtime" },
    { name: "react-dom", version: PACKAGE_VERSIONS.reactDom, purpose: "DOM renderer" },
    { name: "tailwindcss", version: PACKAGE_VERSIONS.tailwindcss, purpose: "Utility-first styling" },
    { name: "postcss", version: PACKAGE_VERSIONS.postcss, purpose: "Tailwind processing pipeline" },
    { name: "autoprefixer", version: PACKAGE_VERSIONS.autoprefixer, purpose: "CSS vendor prefixing" },
    { name: "axios", version: PACKAGE_VERSIONS.axios, purpose: "API client" },
    { name: "prettier", version: PACKAGE_VERSIONS.prettier, purpose: "Code formatting" },
    {
      name: "@trivago/prettier-plugin-sort-imports",
      version: PACKAGE_VERSIONS.prettierSortImports,
      purpose: "Deterministic import ordering",
    },
  ];

  if (answers.framework === "next") {
    items.push(
      { name: "eslint", version: PACKAGE_VERSIONS.eslint, purpose: "Next.js lint command support" },
      { name: "eslint-config-next", version: PACKAGE_VERSIONS.next, purpose: "Next.js lint rules" }
    );
  } else {
    items.push({ name: "@vitejs/plugin-react", version: PACKAGE_VERSIONS.viteReactPlugin, purpose: "React Fast Refresh plugin for Vite" });
  }

  if (answers.framework === "next" || answers.uiLibrary === "shadcn") {
    items.push({ name: "lucide-react", version: PACKAGE_VERSIONS.lucideReact, purpose: "Icon primitives" });
  }

  if (answers.language === "ts") {
    items.push(
      { name: "typescript", version: PACKAGE_VERSIONS.typescript, purpose: "Type checking" },
      { name: "@types/node", version: PACKAGE_VERSIONS.typesNode, purpose: "Node.js type definitions" },
      { name: "@types/react", version: PACKAGE_VERSIONS.typesReact, purpose: "React type definitions" },
      { name: "@types/react-dom", version: PACKAGE_VERSIONS.typesReactDom, purpose: "React DOM type definitions" }
    );
  }

  if (answers.setupHusky) {
    items.push({ name: "husky", version: PACKAGE_VERSIONS.husky, purpose: "Git pre-commit quality gate" });
  }

  if (answers.uiLibrary === "shadcn") {
    items.push(
      { name: "class-variance-authority", version: PACKAGE_VERSIONS.classVarianceAuthority, purpose: "Variant-ready UI primitives" },
      { name: "clsx", version: PACKAGE_VERSIONS.clsx, purpose: "Conditional class composition" },
      { name: "tailwind-merge", version: PACKAGE_VERSIONS.tailwindMerge, purpose: "Tailwind class conflict resolution" },
      { name: "tailwindcss-animate", version: PACKAGE_VERSIONS.tailwindcssAnimate, purpose: "Animation utilities for shadcn-style components" }
    );
  }

  if (answers.reactQuery) {
    items.push({ name: "@tanstack/react-query", version: PACKAGE_VERSIONS.reactQuery, purpose: "Server state cache and provider" });
  }

  if (answers.forms) {
    items.push(
      { name: "react-hook-form", version: PACKAGE_VERSIONS.reactHookForm, purpose: "Form state management" },
      { name: "zod", version: PACKAGE_VERSIONS.zod, purpose: "Schema validation" },
      { name: "@hookform/resolvers", version: PACKAGE_VERSIONS.hookformResolvers, purpose: "Zod resolver for React Hook Form" }
    );
  }

  if (answers.toasts) {
    items.push({ name: "sonner", version: PACKAGE_VERSIONS.sonner, purpose: "Toast notifications" });
  }

  if (answers.tests) {
    items.push(
      { name: "vitest", version: PACKAGE_VERSIONS.vitest, purpose: "Unit and component test runner" },
      { name: "jsdom", version: PACKAGE_VERSIONS.jsdom, purpose: "DOM environment for tests" },
      { name: "@testing-library/react", version: PACKAGE_VERSIONS.testingLibraryReact, purpose: "React component testing" },
      { name: "@testing-library/jest-dom", version: PACKAGE_VERSIONS.testingLibraryJestDom, purpose: "DOM assertions" }
    );
  }

  items.push({ name: "socket", version: PACKAGE_VERSIONS.socketCli, purpose: "Optional Socket Security CI policy scan" });

  return items;
}

function installedVersionLines(answers: Answers): string[] {
  return packageManifestItems(answers).map(
    (item) => `- ${item.name} \`${item.version}\` - ${item.purpose}`
  );
}

function projectSetupDocsContent(answers: Answers): string {
  const advancedFeatures = advancedFeaturesList(answers);
  const packageRows = packageManifestItems(answers)
    .map((item) => `| ${item.name} | ${item.version} | ${item.purpose} |`)
    .join("\n");
  const shadcnComponents = ["button", "card", "badge", "input", "label", "textarea", "separator"];
  const qualityCommands = [
    "`npm run format` - write formatted files",
    "`npm run format:check` - verify formatting",
    answers.framework === "next" ? "`npm run lint` - run Next.js linting" : "",
    answers.tests ? "`npm run test` - run Vitest once for CI/Husky" : "",
    answers.tests ? "`npm run test:watch` - run Vitest in watch mode" : "",
    "`npm run build` - create the production build",
    "`npm run check` - run the full quality gate used by CI and Husky",
  ].filter(Boolean);

  return `# Production Setup

This project was generated by Firstbase with the selected stack documented below.

## Stack Decisions

- Project: ${answers.projectName}
- Framework: ${frameworkLabel(answers)}
- Language: ${answers.language === "ts" ? "TypeScript" : "JavaScript"}
- Routing: ${routingLabel(answers)}
- UI library: ${answers.uiLibrary === "shadcn" ? "shadcn/ui-compatible local primitives" : "None"}
- Husky: ${answers.setupHusky ? "Enabled" : "Disabled"}
- Node engine: ${nodeEngineFor(answers)}
- Advanced modules: ${advancedFeatures.length ? advancedFeatures.join(", ") : "None"}

## Package Versions

| Package | Version | Purpose |
| --- | --- | --- |
${packageRows}

## Integration Steps

1. Install dependencies with \`npm install\` when cloning this project elsewhere.
2. Copy \`.env.example\` to \`.env.local\` and set the API base URL.
3. Start local development with \`npm run dev\`.
4. Run \`npm run check\` before opening a pull request or shipping.
5. Use \`npm run build\` to verify the production bundle independently.
6. Run \`npm audit --audit-level=high\` before releases; CI already runs this.

## Quality Gate

${qualityCommands.map((command) => `- ${command}`).join("\n")}
- \`npm audit --audit-level=high\` - run in CI only, not in Husky, to avoid network calls during local commits
- GitHub Dependency Review - runs in \`.github/workflows/dependency-review.yml\` on pull requests when GitHub dependency graph support is available
- Socket Security policy scan - runs in \`.github/workflows/socket.yml\` when \`SOCKET_SECURITY_API_KEY\` and \`SOCKET_ORG\` are configured in GitHub

${answers.setupHusky ? "Husky is configured to run `npm run check` from `.husky/pre-commit`, so commits fail if format, tests, lint, or build fail. The default hook does not make network requests and does not interpolate user input.\n" : "Husky was not enabled for this scaffold. CI still runs the generated quality gate and dependency audit.\n"}
## shadcn/ui Setup

${answers.uiLibrary === "shadcn"
  ? `The scaffold writes \`components.json\`, \`lib/utils\`, and these local UI primitives: ${shadcnComponents.map((component) => `\`${component}\``).join(", ")}. They are intentionally generated as source files so you can tune the design system without waiting on a registry call.`
  : "shadcn/ui was not selected. The starter uses direct Tailwind markup and can be upgraded later by adding `components.json`, `lib/utils`, and local UI primitives."}

## Advanced Modules

${advancedFeatures.length
  ? advancedFeatures.map((feature) => `- ${feature}`).join("\n")
  : "- No advanced modules were selected."}

## Testing Strategy

${answers.tests
  ? "Vitest is configured with jsdom and Testing Library. The generated tests cover the theme toggle and any selected interactive modules such as auth and forms."
  : "Tests were not selected. Re-run the scaffold with advanced test setup when you want Vitest, jsdom, and Testing Library wiring generated automatically."}

## Security Defaults

- Dependencies are installed with exact versions and \`--save-exact\`.
- CI runs \`npm audit --audit-level=high\` before the quality gate.
- GitHub Dependency Review runs in its own pull-request workflow and passes with a plain log message when the repository does not support it yet.
- CI includes an optional pinned Socket Security scan when \`SOCKET_SECURITY_API_KEY\` and \`SOCKET_ORG\` are configured in GitHub.
- Secret-bearing files such as \`.env\`, \`.npmrc\`, \`*.pem\`, \`*.key\`, and service account JSON files are ignored by git.
- \`.env.example\` uses fake placeholder values and must not contain real keys.
- The API client validates the public API base URL, sets a 15 second timeout, and blocks cross-origin absolute requests from that client instance.
${answers.framework === "next" ? "- Next.js security headers, including a baseline Content Security Policy, are configured in `next.config`.\n" : ""}

## Generated Structure

- API client and env helper: ${answers.framework === "react" ? "`src/lib/`" : "`lib/`"}
- Shared components: ${answers.framework === "react" ? "`src/components/`" : "`components/`"}
- Theme entry: ${answers.framework === "react" ? "`src/index.css`" : answers.routing === "app" ? "`app/globals.css`" : "`styles/globals.css`"}
- CI workflow: \`.github/workflows/ci.yml\`
- Dependency Review workflow: \`.github/workflows/dependency-review.yml\`
- Node version markers: \`.nvmrc\` and \`.node-version\`
- Setup documentation: \`docs/production-setup.md\`

Keep this file updated when package versions, quality scripts, or generated modules change.
`;
}

function projectReadmeContent(answers: Answers): string {
  const techStack = [
    `Framework: ${frameworkLabel(answers)}`,
    `Language: ${answers.language === "ts" ? "TypeScript" : "JavaScript"}`,
    `Routing: ${routingLabel(answers)}`,
    `UI library: ${answers.uiLibrary === "shadcn" ? "shadcn/ui" : "None"}`,
    `Husky: ${answers.setupHusky ? "Enabled" : "Disabled"}`,
  ];
  const advancedFeatures = advancedFeaturesList(answers);
  const installedVersions = installedVersionLines(answers);
  const starterStructure =
    answers.framework === "react"
      ? ["src/components/", "src/lib/", "src/pages/", "src/routes/"]
      : answers.routing === "app"
        ? ["app/", "components/", "lib/", "styles/"]
        : ["pages/", "components/", "lib/", "styles/"];

  return `# ${answers.projectName}

${frameworkLabel(answers)} starter generated by [Firstbase](https://github.com/Akshay-bendadi/firstbase).

## Stack

${techStack.map((item) => `- ${item}`).join("\n")}

## Included

- Tailwind foundation with a designed landing page
- Dark/light theme toggle
- API client with interceptor and env files
- Production gitignore file
- First commit prepared for you
- Production setup documentation in \`docs/production-setup.md\`
${answers.uiLibrary === "shadcn" ? "- shadcn/ui component set" : "- Plain HTML fallback when shadcn is not selected"}
${advancedFeatures.length ? `- Advanced modules: ${advancedFeatures.join(", ")}` : ""}

## Installed Versions

${installedVersions.join("\n")}

## Start

\`\`\`bash
npm run dev
\`\`\`

## Quality Gate

\`\`\`bash
npm run check
\`\`\`

${answers.framework === "next" ? "## Next.js Notes\n\n- App Router and Pages Router are supported from the scaffold.\n- Next.js 16 uses Turbopack by default for `npm run dev` and `npm run build`.\n- Use `npm run dev:webpack` only if you need to debug with webpack.\n\n" : ""}
## Project Layout

${starterStructure.map((item) => `- ${item}`).join("\n")}

## Conventions

- Keep UI blocks utility-first and production oriented.
- Extend the generated API client instead of wiring fetch logic ad hoc.
- Add new advanced modules through the scaffold flow when possible.

Generated with the first commit already prepared.
`;
}

export async function scaffoldProject(answers: Answers): Promise<void> {
  const startedAt = Date.now();
  const rawProjectName = sanitizeProjectName(answers.projectName);
  answers = { ...answers, projectName: rawProjectName };
  const projectPath = resolveSafeProjectPath(process.cwd(), rawProjectName);

  ensureEmptyTarget(projectPath, rawProjectName);
  // Create the output folder up front so framework bootstrappers have a stable target.
  createFolder(projectPath);

  log.divider();
  await log.step(chalk.bold.cyan('Creating your project'));
  log.divider();

  // 1. Initialize base project first
  if (answers.framework === "next") {

    // Install specific stable version of Next.js
    const nextVersion = PACKAGE_VERSIONS.next;
    const args = [
      versionedPackage("create-next-app", PACKAGE_VERSIONS.createNextApp),
      ".",
      "--import-alias",
      "@/*",
      "--eslint",
      "--tailwind",
      "--no-react-compiler",
      "--no-src-dir",
      "--use-npm"
    ];

    // Add React and React DOM dependencies with compatible versions
    const dependencies = {
      "next": nextVersion,
      "react": PACKAGE_VERSIONS.react,
      "react-dom": PACKAGE_VERSIONS.reactDom,
      "axios": PACKAGE_VERSIONS.axios,
      "lucide-react": PACKAGE_VERSIONS.lucideReact
    };

    args.push(answers.language === "ts" ? "--typescript" : "--js");

    if (answers.routing === "app") {
      args.push("--app");
    } else {
      args.push("--no-app");
    }

    await runCommand("npx", ["--yes", ...args], {
      stdio: "ignore",
      cwd: projectPath,
      loadingMessage: "Creating Next.js app",
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",  // Disable telemetry
        NEXT_DISABLE_CREATE_NEXT_APP_UPDATE_NOTIFICATION: "1"  // Disable update notification
      }
    });

    const packageJsonPath = path.join(projectPath, "package.json");
    const packageJson = fs.existsSync(packageJsonPath)
      ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      : {
          name: rawProjectName,
          version: "0.1.0",
          private: true,
          scripts: {},
          dependencies: {},
          devDependencies: {},
        };

    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...dependencies
    };

    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      "autoprefixer": PACKAGE_VERSIONS.autoprefixer,
      "eslint": PACKAGE_VERSIONS.eslint,
      "eslint-config-next": nextVersion,
      "postcss": PACKAGE_VERSIONS.postcss,
      "tailwindcss": PACKAGE_VERSIONS.tailwindcss,
    };
    delete packageJson.devDependencies["@tailwindcss/postcss"];

    if (answers.language === "ts") {
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        "@types/node": PACKAGE_VERSIONS.typesNode,
        "@types/react": PACKAGE_VERSIONS.typesReact,
        "@types/react-dom": PACKAGE_VERSIONS.typesReactDom,
        "typescript": PACKAGE_VERSIONS.typescript,
      };
    }

    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts["dev"] = "next dev";
    packageJson.scripts["build"] = "next build";
    packageJson.scripts["start"] = "next start";
    packageJson.scripts["lint"] = "eslint .";
    packageJson.scripts["dev:webpack"] = "next dev --webpack";
    packageJson.scripts["format"] = "prettier . --write";
    packageJson.scripts["format:check"] = "prettier . --check";
    packageJson.scripts["check"] = checkScriptFor("next", answers.tests);
    if (answers.setupHusky) {
      packageJson.scripts["prepare"] = "husky";
    }
    if (answers.tests) {
      packageJson.scripts["test"] = "vitest --run";
      packageJson.scripts["test:watch"] = "vitest";
    }
    packageJson.engines = {
      ...packageJson.engines,
      node: nodeEngineFor(answers),
    };

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    await runCommand("npm", npmInstallArgs([
      versionedPackage("axios", PACKAGE_VERSIONS.axios),
      versionedPackage("lucide-react", PACKAGE_VERSIONS.lucideReact),
    ]), {
      stdio: "ignore",
      cwd: projectPath,
      loadingMessage: "Installing base dependencies",
    });
  } else {
    await runCommand(
      "npx",
      [
        "--yes",
        versionedPackage("create-vite", PACKAGE_VERSIONS.createVite),
        ".",
        "--template",
        answers.language === "ts" ? "react-ts" : "react",
      ],
      { stdio: "ignore", cwd: projectPath, loadingMessage: "Creating React app" }
    );

    await log.step('Installing theme dependencies');
    const packageJsonPath = path.join(projectPath, "package.json");
    const packageJson = fs.existsSync(packageJsonPath)
      ? JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
      : {
          name: rawProjectName,
          version: "0.1.0",
          private: true,
          scripts: {},
          dependencies: {},
          devDependencies: {},
        };

    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts["format"] = "prettier . --write";
    packageJson.scripts["format:check"] = "prettier . --check";
    packageJson.scripts["check"] = checkScriptFor("react", answers.tests);
    if (answers.setupHusky) {
      packageJson.scripts["prepare"] = "husky";
    }
    if (answers.tests) {
      packageJson.scripts["test"] = "vitest --run";
      packageJson.scripts["test:watch"] = "vitest";
    }
    packageJson.dependencies = {
      ...packageJson.dependencies,
      "react": PACKAGE_VERSIONS.react,
      "react-dom": PACKAGE_VERSIONS.reactDom,
    };
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      "@vitejs/plugin-react": PACKAGE_VERSIONS.viteReactPlugin,
      "vite": PACKAGE_VERSIONS.vite,
    };
    if (answers.language === "ts") {
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        "@types/react": PACKAGE_VERSIONS.typesReact,
        "@types/react-dom": PACKAGE_VERSIONS.typesReactDom,
        "typescript": PACKAGE_VERSIONS.typescript,
      };
    }
    packageJson.engines = {
      ...packageJson.engines,
      node: nodeEngineFor(answers),
    };

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    await runCommand("npm", npmInstallArgs([
      versionedPackage("tailwindcss", PACKAGE_VERSIONS.tailwindcss),
      versionedPackage("postcss", PACKAGE_VERSIONS.postcss),
      versionedPackage("autoprefixer", PACKAGE_VERSIONS.autoprefixer),
    ], true), {
      stdio: "ignore",
      cwd: projectPath,
      loadingMessage: "Installing theme dependencies",
    });
    await runCommand("npm", npmInstallArgs([versionedPackage("axios", PACKAGE_VERSIONS.axios)]), {
      stdio: "ignore",
      cwd: projectPath,
      loadingMessage: "Installing API client",
    });
    log.success("React theme stack installed and ready");
  }

  if (answers.uiLibrary === "shadcn") {
    await log.step("Installing shadcn starter packages");
    await runCommand("npm", npmInstallArgs([
      versionedPackage("lucide-react", PACKAGE_VERSIONS.lucideReact),
      versionedPackage("clsx", PACKAGE_VERSIONS.clsx),
      versionedPackage("tailwind-merge", PACKAGE_VERSIONS.tailwindMerge),
      versionedPackage("class-variance-authority", PACKAGE_VERSIONS.classVarianceAuthority),
    ]), {
      stdio: "ignore",
      cwd: projectPath,
      loadingMessage: "Installing shadcn starter",
    });
    await runCommand("npm", npmInstallArgs([
      versionedPackage("tailwindcss-animate", PACKAGE_VERSIONS.tailwindcssAnimate),
    ], true), {
      stdio: "ignore",
      cwd: projectPath,
      loadingMessage: "Installing shadcn animation plugin",
    });
    log.success("shadcn starter installed");
  }

  if (answers.setupHusky) {
    await log.step("Installing Husky");
    await runCommand("npm", npmInstallArgs([versionedPackage("husky", PACKAGE_VERSIONS.husky)], true), {
      stdio: "ignore",
      cwd: projectPath,
      loadingMessage: "Installing Husky",
    });
    log.success("Husky installed");
  }

  await log.step("Installing formatting and CI tooling");
  await runCommand("npm", npmInstallArgs([
    versionedPackage("prettier", PACKAGE_VERSIONS.prettier),
    versionedPackage("@trivago/prettier-plugin-sort-imports", PACKAGE_VERSIONS.prettierSortImports),
  ], true), {
    stdio: "ignore",
    cwd: projectPath,
    loadingMessage: "Installing formatting and CI tooling",
  });
  log.success("Formatting and CI tooling installed");

  log.divider();
  log.highlight(chalk.bold.green('Project created successfully!'));
  log.divider();
  log.info(chalk.bold('Next steps:'));
  log.info(`1. ${chalk.cyan('cd ' + answers.projectName)}`);
  log.info(`2. ${chalk.cyan('npm run dev')} to start the development server`);
  log.info(`3. Happy coding! ${chalk.bold.red('❤️')}`);
  log.divider();

  // 2. Now create our directory structure
  log.info("Setting up project structure");
  createFolders(projectPath, answers.framework);

  updateAliasConfig(projectPath);
  log.success("Updated path aliases with proper configuration");

  // 4. Set up Theme
  await log.step("Writing theme files");
  const { scaffoldTheme } = await import("./scaffolders/themeSetup.js");
  scaffoldTheme(
    projectPath,
    answers.language,
    answers.routing,
    answers.framework,
    answers.uiLibrary,
    answers.seo,
    [
      answers.reactQuery ? "React Query provider" : "",
      answers.auth ? "Auth scaffold" : "",
      answers.forms ? "Forms stack" : "",
      answers.toasts ? "Toast system" : "",
      answers.i18n ? "Language support" : "",
      answers.tests ? "Vitest setup" : "",
    ].filter(Boolean) as string[],
    answers.i18n
  );
  log.success("Theme added");

  await log.step("Writing API client");
  const { scaffoldApiClient } = await import("./scaffolders/apiClient.js");
  scaffoldApiClient(projectPath, answers.language, answers.framework);
  log.success("API client added");

  await log.step("Writing quality tooling");
  const { scaffoldQualityFiles } = await import("./scaffolders/qualitySetup.js");
  scaffoldQualityFiles(projectPath, answers.framework, answers.tests, answers.language);
  log.success("Quality tooling added");

  if (answers.advancedMode === "go_advanced") {
    await log.step("Writing advanced setup");
    const { scaffoldAdvancedSetup } = await import("./scaffolders/advancedSetup.js");
    scaffoldAdvancedSetup(projectPath, answers);
    log.success("Advanced setup added");
  }

  if (answers.advancedMode === "go_advanced") {
    if (answers.reactQuery) {
      await log.step("Installing React Query");
      await runCommand("npm", npmInstallArgs([
        versionedPackage("@tanstack/react-query", PACKAGE_VERSIONS.reactQuery),
      ]), {
        stdio: "ignore",
        cwd: projectPath,
        loadingMessage: "Installing React Query",
      });
      log.success("React Query installed");
    }

    if (answers.forms) {
      await log.step("Installing forms stack");
      await runCommand("npm", npmInstallArgs([
        versionedPackage("react-hook-form", PACKAGE_VERSIONS.reactHookForm),
        versionedPackage("zod", PACKAGE_VERSIONS.zod),
        versionedPackage("@hookform/resolvers", PACKAGE_VERSIONS.hookformResolvers),
      ]), {
        stdio: "ignore",
        cwd: projectPath,
        loadingMessage: "Installing forms stack",
      });
      log.success("Forms stack installed");
    }

    if (answers.toasts) {
      await log.step("Installing toast system");
      await runCommand("npm", npmInstallArgs([versionedPackage("sonner", PACKAGE_VERSIONS.sonner)]), {
        stdio: "ignore",
        cwd: projectPath,
        loadingMessage: "Installing toast system",
      });
      log.success("Toast system installed");
    }

    if (answers.tests) {
      await log.step("Installing test setup");
      await runCommand("npm", npmInstallArgs([
        versionedPackage("vitest", PACKAGE_VERSIONS.vitest),
        versionedPackage("jsdom", PACKAGE_VERSIONS.jsdom),
        versionedPackage("@testing-library/react", PACKAGE_VERSIONS.testingLibraryReact),
        versionedPackage("@testing-library/jest-dom", PACKAGE_VERSIONS.testingLibraryJestDom),
      ], true), {
        stdio: "ignore",
        cwd: projectPath,
        loadingMessage: "Installing test setup",
      });
      log.success("Test setup installed");
    }
  }

  // Create production folder structure
  createFolders(projectPath, answers.framework);

  // Readme and git init
  fs.writeFileSync(path.join(projectPath, "README.md"), projectReadmeContent(answers));
  writeFileIfChanged(path.join(projectPath, "docs", "production-setup.md"), projectSetupDocsContent(answers));
  await runCommand("git", ["init"], {
    stdio: "ignore",
    cwd: projectPath,
    loadingMessage: "Initializing git",
  });
  if (answers.setupHusky) {
    await log.step("Setting up Husky");
    await runCommand("git", ["config", "core.hooksPath", ".husky"], {
      cwd: projectPath,
      loadingMessage: "Configuring Husky hooks",
    });
    const hookPath = path.join(projectPath, ".husky", "pre-commit");
    writeFileIfChanged(hookPath, huskyHookContent());
    makeExecutable(hookPath);
    log.success("Husky hooks added");
  }
  await runCommand("git", ["add", "."], {
    stdio: "ignore",
    cwd: projectPath,
    loadingMessage: "Staging initial commit",
  });
  await runCommand("git", ["commit", "-m", "Initial commit (via firstbase)"], {
    stdio: "ignore",
    cwd: projectPath,
    loadingMessage: "Creating initial commit",
  });

  // Success message
  console.log("\nProject setup complete. Next steps:");
  log.info(`cd ${answers.projectName}`);
  if (answers.framework === "next") {
    log.info("npm run dev to start the development server");
    log.info("Next.js 16 uses Turbopack by default; use npm run dev:webpack only when needed");
  } else {
    log.info("npm run dev");
  }
  log.info(`package download footprint: ${packageDownloadSizeInMb(projectPath).toFixed(1)} MB`);
  log.info(`total time: ${formatDuration(Date.now() - startedAt)}`);
  console.log("\nHappy hacking!");
}
