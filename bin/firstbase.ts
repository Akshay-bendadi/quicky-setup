#!/usr/bin/env node

const MIN_NODE_VERSION = [22, 22, 2] as const;

function parseVersion(version: string): [number, number, number] {
  const [major = "0", minor = "0", patch = "0"] = version.split(".");
  return [Number(major), Number(minor), Number(patch)];
}

function isAtLeast(version: string, minimum: readonly [number, number, number]): boolean {
  const current = parseVersion(version);

  for (let index = 0; index < minimum.length; index += 1) {
    if (current[index] > minimum[index]) {
      return true;
    }

    if (current[index] < minimum[index]) {
      return false;
    }
  }

  return true;
}

if (!isAtLeast(process.versions.node, MIN_NODE_VERSION)) {
  console.error(
    [
      "",
      "✗ create-firstbase-app requires Node.js >=22.22.2.",
      `  Current Node.js: ${process.version}`,
      "",
      "  Upgrade Node.js, then run:",
      "  npx create-firstbase-app@latest",
      "",
    ].join("\n")
  );
  process.exit(1);
}

void import("../src/main.js")
  .then(({ main }) => main())
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ ${message}`);
    process.exitCode = 1;
  });
