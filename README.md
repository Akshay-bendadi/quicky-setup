# Quicky-Setup 🚀

A powerful CLI tool to quickly scaffold and set up modern web applications with best practices, pre-configured tools, and ready-to-use templates.

## Features ✨

- 🛠️ **Project Scaffolding**: Quickly set up new projects with a single command
- ⚡ **Framework Support**: Works with React, Next.js, and more
- 🔧 **Built-in Templates**: Pre-configured with TypeScript, Redux, and other essential tools
- 🎨 **Theming**: Easy theming support out of the box
- 📦 **Zero-Config**: Sensible defaults with zero configuration required
- 🔄 **Update Management**: Keep your project dependencies up-to-date

## Prerequisites

- Node.js 16.0.0 or later
- npm 7.0.0 or later or Yarn 1.22.0 or later
- Git (for version control)

## Installation

```bash
# Using npm
npx quicky-setup@latest

# Or using Yarn
yarn create quicky-setup
```

## Usage

### Create a new project

```bash
# Interactive mode
npx quicky-setup init

# Quick start with default options
npx quicky-setup init my-app --template=next-ts
```

### Available Commands

```
init [project-name]  Create a new project
add [feature]      Add features to existing project
update             Update Quicky-Setup to the latest version
help               Show help information
```

### Available Templates

- `next-ts` - Next.js with TypeScript
- `react-ts` - React with TypeScript
- `next-js` - Next.js with JavaScript
- `react-js` - React with JavaScript

## Project Structure

```
my-app/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/          # Application pages
│   ├── store/          # State management
│   ├── styles/         # Global styles
│   └── utils/          # Utility functions
├── public/            # Static files
├── .gitignore
├── package.json
└── README.md
```

## Adding Features

Add features to your existing project:

```bash
# Add Redux state management
npx quicky-setup add redux

# Add API service layer
npx quicky-setup add api

# Add authentication
npx quicky-setup add auth
```

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Link the package for local development:
   ```bash
   npm link
   ```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue on our [GitHub repository](https://github.com/yourusername/quicky-setup/issues).

---

Built with ❤️ by [Your Name]