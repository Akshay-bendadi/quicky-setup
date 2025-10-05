import fs from 'fs';
import path from 'path';

type Framework = 'react' | 'next';

interface EnvSetupOptions {
    framework: Framework;
    projectPath: string;
}

/**
 * Setup environment files (.env and .env.example)
 * for React (Vite) or Next.js projects.
 */
export async function setupEnvFiles({ framework, projectPath }: EnvSetupOptions): Promise<void> {
    const envPath = path.join(projectPath, '.env');
    const envExamplePath = path.join(projectPath, '.env.example');

    // Framework-specific environment variable prefixes
    const apiVar = framework === 'next' ? 'NEXT_PUBLIC_API_URL' : 'VITE_API_URL';
    const socketVar = framework === 'next' ? 'NEXT_PUBLIC_SOCKET_URL' : 'VITE_SOCKET_URL';
    const authSecretVar = framework === 'next' ? 'NEXTAUTH_SECRET' : 'VITE_AUTH_SECRET';

    // Main .env content
    const envContent = `# API Base URL
${apiVar}=http://localhost:3000/api

# WebSocket server URL
${socketVar}=http://localhost:3000

# Authentication secret
${authSecretVar}=${generateRandomString(32)}

# Environment
NODE_ENV=development
`;

    // Write .env if not exists
    if (!fs.existsSync(envPath)) {
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Created .env file');
    }

    // Update .gitignore to ignore env files
    const gitignorePath = path.join(projectPath, '.gitignore');
    const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
    if (!gitignoreContent.includes('.env')) {
        fs.appendFileSync(gitignorePath, '\n# Environment variables\n.env\n.env.local\n.env.*.local\n');
        console.log('✅ Updated .gitignore to exclude .env files');
    }
}

// Helper to generate random string for auth secret
function generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charsLength = chars.length;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * charsLength));
    }
    return result;
}

export default setupEnvFiles;
