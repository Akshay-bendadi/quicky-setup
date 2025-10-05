import { execa } from "execa";
import fs from "fs";
import path from "path";
import type { Answers } from "./prompts.js";

function createFolder(folder: string): void {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
}

function createFolders(projectPath: string, framework: Answers["framework"]): void {
  const folders = [
    "public",
  ];

  if (framework === "next") {
    // For Next.js, only create folders that don't conflict with app directory structure
    folders.push(
      "components",
      "hooks",
      "lib",
      "styles",
      "types",
      "services"
    );
  } else if (framework === "react") {
    // For React (Vite/React), use src/ structure
    folders.push(
      "src/components",
      "src/hooks",
      "src/layouts",
      "src/services",
      "src/styles",
      "src/utils",
      "src/pages",
      "src/routes"
    );
  } else {
    // Fallback for other frameworks
    folders.push(
      "src/components",
      "src/hooks",
      "src/layouts",
      "src/services",
      "src/styles",
      "src/utils"
    );
  }

  folders.forEach((folder) => createFolder(path.join(projectPath, folder)));
}

export async function scaffoldProject(answers: Answers): Promise<void> {
  const projectPath = path.resolve(process.cwd(), answers.projectName);

  // Create only the project directory first
  createFolder(projectPath);
  process.chdir(projectPath);

  console.log("🚀 Creating base project...");

  // 1. Initialize base project first
  if (answers.framework === "next") {

    // Install specific stable version of Next.js
    const nextVersion = "14.2.3";
    const args = [
      `create-next-app@${nextVersion}`,
      ".",
      "--use-npm",
      "--import-alias",
      "@/*",
      "--eslint",
      "--tailwind",
      "--no-src-dir",
      "--no-https",
      "--turbo"
    ];

    // Add React and React DOM dependencies with compatible versions
    const dependencies = {
      "next": `^${nextVersion}`,
      "react": "^18.2.0",
      "react-dom": "^18.2.0"
    };

    args.push(answers.language === "ts" ? "--typescript" : "--js");

    if (answers.routing === "app") {
      args.push("--app");
    } else {
      args.push("--no-app");
    }

    await execa("npx", ["--yes", ...args], {
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",  // Disable telemetry
        NEXT_DISABLE_CREATE_NEXT_APP_UPDATE_NOTIFICATION: "1"  // Disable update notification
      }
    });

    const packageJsonPath = path.join(projectPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      packageJson.dependencies = {
        ...packageJson.dependencies,
        ...dependencies
      };

      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        "@types/node": "^20.11.0",
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "autoprefixer": "^10.4.0",
        "eslint": "^8.0.0",
        "eslint-config-next": `^${nextVersion}`,
        "postcss": "^8.0.0",
        "tailwindcss": "^3.4.0",
        "typescript": "^5.0.0"
      };

      packageJson.scripts = packageJson.scripts || {};
      packageJson.scripts["dev"] = "next dev --turbo";
      packageJson.scripts["build"] = "next build";
      packageJson.scripts["start"] = "next start";
      packageJson.scripts["lint"] = "next lint";
      packageJson.scripts["dev:turbo"] = "next dev --turbo";

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
  } else {
    await execa(
      "npx",
      [
        "create-vite@5.2.0",
        ".",
        "--template",
        answers.language === "ts" ? "react-ts" : "react",
      ],
      { stdio: "inherit" }
    );

    await execa("npm", ["install", "react-router-dom"], { stdio: "inherit" });

    console.log("🎨 Installing Tailwind CSS...");
    await execa("npm", ["install", "-D", "tailwindcss@latest", "postcss@latest", "autoprefixer@latest"], {
      stdio: "inherit"
    });

    const tailwindConfigPath = path.join(projectPath, "tailwind.config.js");
    const tailwindConfig = answers.language === "ts"
      ? "/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  content: [\n    \"./index.html\",\n    \"./src/**/*.{js,ts,jsx,tsx}\",\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}"
      : "module.exports = {\n  content: [\n    \"./index.html\",\n    \"./src/**/*.{js,ts,jsx,tsx}\",\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}";

    fs.writeFileSync(tailwindConfigPath, tailwindConfig);

    // No need for PostCSS config when using @tailwindcss/vite

    // Update CSS file
    const cssPath = path.join(projectPath, "src", "index.css");
    if (!fs.existsSync(path.dirname(cssPath))) {
      fs.mkdirSync(path.dirname(cssPath), { recursive: true });
    }

    // Create index.css with just the @import directive
    fs.writeFileSync(cssPath, "@import \"tailwindcss\";\n");

    // Install @tailwindcss/vite
    console.log("🔧 Configuring Vite with @tailwindcss/vite...");
    await execa("npm", ["install", "-D", "@tailwindcss/vite"], { stdio: "inherit" });

    // Update Vite config to use @tailwindcss/vite
    const viteConfigExt = answers.language === 'ts' ? 'ts' : 'js';
    const viteConfigPath = path.join(projectPath, `vite.config.${viteConfigExt}`);

    if (fs.existsSync(viteConfigPath)) {
      // Create the new Vite config with @tailwindcss/vite
      const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})`;

      fs.writeFileSync(viteConfigPath, viteConfig);
    }

    console.log("✅ Tailwind CSS installed and configured!");
  }


  console.log("✅ Base project created!");

  // 2. Now create our directory structure
  console.log("📂 Setting up project structure...");
  createFolders(projectPath, answers.framework);
  console.log("✅ Directory structure created");
  // Setup environment files
  console.log("🔧 Setting up environment files...");
  try {
    const { setupEnvFiles } = await import('./env-setup.js');
    await setupEnvFiles({
      framework: answers.framework,
      projectPath
    });
  } catch (error) {
    console.warn("⚠️  Could not set up environment files:", error);
  }

  // Update jsconfig.json with proper configuration
  const jsConfigPath = path.join(projectPath, 'jsconfig.json');
  if (fs.existsSync(jsConfigPath)) {
    const jsConfig = {
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["./*"]
        }
      }
    };
    fs.writeFileSync(jsConfigPath, JSON.stringify(jsConfig, null, 2));
    console.log("✅ Updated jsconfig.json with proper configuration");
  }

  // 4. Set up Auth + Axios if needed
  if (answers.auth) {
    console.log("🔑 Setting up Auth + Axios...");
    await execa("npm", ["install", "axios", "js-cookie"], { stdio: "inherit" });
    const { scaffoldApiService } = await import("./scaffolders/apiService.js");
    scaffoldApiService(projectPath, answers.language, answers.authStorage ?? undefined, answers.framework);
    console.log("✅ Axios + Auth utils added!");
  }

  // UI Library
  if (answers.uiLibrary === "shadcn") {
    await execa(
      "npm",
      [
        "install",
        "lucide-react",
        "class-variance-authority",
        "tailwind-merge",
        "clsx",
      ],
      { stdio: "inherit" }
    );
    console.log("⚡ For Shadcn UI, run: npx shadcn-ui@latest init");
  }
  if (answers.uiLibrary === "antd") {
    await execa("npm", ["install", "antd"], { stdio: "inherit" });
    console.log("✅ Ant Design installed!");
  }

  // Create production folder structure
  createFolders(projectPath, answers.framework);

  // Readme and git init
  fs.writeFileSync(
    path.join(projectPath, "README.md"),
    `# ${answers.projectName}\n\nGenerated by [quicky-setup](https://github.com/your-org/quicky-setup) 🚀\n`
  );
  await execa("git", ["init"], { stdio: "ignore" });
  await execa("git", ["add", "."], { stdio: "ignore" });
  await execa("git", ["commit", "-m", "Initial commit (via quicky-setup)"], {
    stdio: "ignore",
  });

  // Success message
  console.log("\n🎉 Project setup complete! Next steps:");
  console.log(`   cd ${answers.projectName}`);
  if (answers.framework === "next") {
    console.log(`   npm run dev        # Start development server`);
    console.log(`   npm run dev:turbo  # Start with TurboPack for faster development`);
  } else {
    console.log(`   npm run dev`);
  }
  if (answers.uiLibrary === "shadcn") {
    console.log(`   npx shadcn-ui@latest init # (for Shadcn UI setup)`);
  }
  console.log("\nHappy hacking! 🧑‍💻");
}