import prompts from "prompts";

export type Framework = "react" | "next";
export type Language = "js" | "ts";
export type UiLibrary = "none" | "shadcn" | "antd";
export type AuthStorage = "cookie" | "localStorage" | null;

export interface Answers {
  projectName: string;
  framework: Framework;
  routing: "app" | "pages";
  language: Language;
  redux: boolean;
  auth: boolean;
  authStorage: AuthStorage;
  uiLibrary: UiLibrary;
}

export async function askQuestions(): Promise<Answers> {
  const result = await prompts([
    {
      type: "text",
      name: "projectName",
      message: "Enter project name:",
      initial: "my-app",
    },
    {
      type: "select",
      name: "framework",
      message: "Choose framework:",
      choices: [
        { title: "React (Vite)", value: "react" },
        { title: "Next.js", value: "next" },
      ],
    },
    {
      type: "select",
      name: "language",
      message: "Choose language:",
      choices: [
        { title: "JavaScript", value: "js" },
        { title: "TypeScript", value: "ts" },
      ],
    },
    {
      type: (prev: string, values: any) =>
        values.framework === "next" ? "select" : null,
      name: "routing",
      message: "Choose Next.js routing system:",
      choices: [
        { title: "App Router (recommended)", value: "app" },
        { title: "Pages Router (classic)", value: "pages" },
      ],
    },
    {
      type: "confirm",
      name: "redux",
      message: "Include Redux Toolkit?",
      initial: true,
    },
    {
      type: "confirm",
      name: "auth",
      message: "Include Auth + Axios?",
      initial: true,
    },
    {
      type: (prev: boolean) => (prev ? "select" : null),
      name: "authStorage",
      message: "Auth storage type:",
      choices: [
        { title: "Cookie", value: "cookie" },
        { title: "LocalStorage", value: "localStorage" },
      ],
    },
    {
      type: "select",
      name: "uiLibrary",
      message: "Choose UI library:",
      choices: [
        { title: "None", value: "none" },
        { title: "Shadcn UI", value: "shadcn" },
        { title: "Ant Design", value: "antd" },
      ],
    },
  ]);

  return result as Answers;
}
