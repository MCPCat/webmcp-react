import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["webmcp-react"],
  webpack: (config) => {
    config.resolve!.alias = {
      ...(config.resolve!.alias as Record<string, string>),
      "webmcp-react": path.resolve(__dirname, "../../src/index.ts"),
    };
    return config;
  },
};

export default nextConfig;
