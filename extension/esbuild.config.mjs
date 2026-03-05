import { build, context } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "fs";

const isWatch = process.argv.includes("--watch");
const isExtensionOnly = process.argv.includes("--extension-only");

const shared = {
  bundle: true,
  sourcemap: !isExtensionOnly,
  logLevel: "info",
};

const browserConfigs = [
  {
    ...shared,
    entryPoints: ["src/content-main.ts"],
    outfile: "dist/content-main.js",
    format: "iife",
    platform: "browser",
    target: "chrome120",
  },
  {
    ...shared,
    entryPoints: ["src/content-isolated.ts"],
    outfile: "dist/content-isolated.js",
    format: "iife",
    platform: "browser",
    target: "chrome120",
  },
  {
    ...shared,
    entryPoints: ["src/background.ts"],
    outfile: "dist/background.js",
    format: "esm",
    platform: "browser",
    target: "chrome120",
  },
  {
    ...shared,
    entryPoints: ["src/popup/popup.ts"],
    outfile: "dist/popup.js",
    format: "esm",
    platform: "browser",
    target: "chrome120",
  },
];

const serverConfigs = [
  {
    ...shared,
    entryPoints: ["src/mcp-server/index.ts"],
    outfile: "dist/mcp-server.js",
    format: "esm",
    platform: "node",
    target: "node18",
    banner: { js: "#!/usr/bin/env node" },
    external: ["@modelcontextprotocol/sdk", "ws"],
  },
  {
    ...shared,
    entryPoints: ["src/mcp-server/index.ts"],
    outfile: "../packages/webmcp-server/bin/webmcp-server.js",
    format: "esm",
    platform: "node",
    target: "node18",
    banner: { js: "#!/usr/bin/env node" },
    external: ["@modelcontextprotocol/sdk", "ws"],
  },
];

const configs = isExtensionOnly ? browserConfigs : [...browserConfigs, ...serverConfigs];

function cleanDist() {
  rmSync("dist", { recursive: true, force: true });
}

function copyStaticFiles() {
  mkdirSync("dist", { recursive: true });
  cpSync("manifest.json", "dist/manifest.json");
  cpSync("src/popup/popup.html", "dist/popup.html");
  cpSync("src/popup/popup.css", "dist/popup.css");
  cpSync("icons", "dist/icons", { recursive: true });
}

if (isWatch) {
  const contexts = await Promise.all(configs.map((c) => context(c)));
  copyStaticFiles();
  await Promise.all(contexts.map((c) => c.watch()));
  console.log("Watching for changes...");
} else {
  cleanDist();
  await Promise.all(configs.map((c) => build(c)));
  copyStaticFiles();
}
