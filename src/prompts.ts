import prompts from "prompts";
import chalk from 'chalk';

export type Framework = "react" | "next";

// Helper function to create styled messages
const style = {
  title: chalk.hex('#FF6B6B').bold,
  subtitle: chalk.hex('#4ECDC4'),
  success: chalk.green.bold,
  info: chalk.blue,
  warning: chalk.yellow,
  error: chalk.red.bold,
  highlight: chalk.hex('#FFD166').bold,
  code: chalk.bgGray.italic
};

// Welcome message
console.log(`
${chalk.hex('#4ECDC4').bold('┌───────────────────────────────────────┐')}
${chalk.hex('#4ECDC4').bold('│')}   ${chalk.hex('#FF6B6B').bold('🚀 Welcome to Quicky Setup!')}    ${chalk.hex('#4ECDC4').bold('│')}
${chalk.hex('#4ECDC4').bold('│')}   ${chalk.hex('#4ECDC4')('The fastest way to set up your')}    ${chalk.hex('#4ECDC4').bold('│')}
${chalk.hex('#4ECDC4').bold('│')}   ${chalk.hex('#4ECDC4')('React/Next.js project')} ${chalk.hex('#FF6B6B').bold('⚡')}           ${chalk.hex('#4ECDC4').bold('│')}
${chalk.hex('#4ECDC4').bold('└───────────────────────────────────────┘')}
`);
export type Language = "js" | "ts";
export type UiLibrary = "none" | "shadcn" | "antd";
export type AuthStorage = "cookie" | "localStorage" | null;

export interface Answers {
  projectName: string;
  framework: Framework;
  routing: "app" | "pages";
  language: Language;
  auth: boolean;
  authStorage: AuthStorage;
  uiLibrary: UiLibrary;
}

export async function askQuestions(): Promise<Answers> {
  const result = await prompts([
    {
      type: "text",
      name: "projectName",
      message: style.highlight("✨ Project name:"),
      initial: "my-app",
      format: (val: string) => style.highlight(val),
      style: 'default',
      onState: (state) => {
        if (state.aborted) {
          process.nextTick(() => process.exit(0));
        }
      }
    },
    {
      type: "select",
      name: "framework",
      message: style.highlight("🚀 Choose your framework:"),
      choices: [
        { title: "React (Vite)", value: "react" },
        { title: "Next.js", value: "next" },
      ],
    },
    {
      type: "select",
      name: "language",
      message: style.highlight("💻 Choose your language:"),
      choices: [
        { title: "JavaScript", value: "js" },
        { title: "TypeScript", value: "ts" },
      ],
    },
    {
      type: (prev: string, values: any) =>
        values.framework === "next" ? "select" : null,
      name: "routing",
      message: style.highlight("🛣️  Choose Next.js routing system:"),
      choices: [
        { title: "App Router (recommended)", value: "app" },
        { title: "Pages Router (classic)", value: "pages" },
      ],
    },
    {
      type: "confirm",
      name: "auth",
      message: style.highlight("🔒 Include Auth + Axios?"),
      initial: true,
    },
    {
      type: (prev: boolean) => (prev ? "select" : null),
      name: "authStorage",
      message: style.highlight("📦 Choose auth storage type:"),
      choices: [
        { title: "Cookie", value: "cookie" },
        { title: "LocalStorage", value: "localStorage" },
      ],
    },
    {
      type: "select",
      name: "uiLibrary",
      message: style.highlight("🎨 Choose a UI library (or none for plain CSS):"),
      choices: [
        { title: "None", value: "none" },
        { title: "Shadcn UI", value: "shadcn" },
        { title: "Ant Design", value: "antd" },
      ],
    },
  ]);

  console.log(`\n${style.success('✓')} ${style.highlight('Configuration complete!')} Let's set up your project...\n`);
  return result as Answers;
}
