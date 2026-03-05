import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/webmcp-react/playground/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "webmcp-react": path.resolve(__dirname, "../../src/index.ts"),
    },
  },
});
