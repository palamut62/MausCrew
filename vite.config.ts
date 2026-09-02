import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const APP_VERSION = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
).version as string;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [react(), tailwindcss()],
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "electron/**/*.test.mjs", "src/**/*.test.ts"],
    setupFiles: ["server/testing/setup.ts"],
    // the suite spawns fake provider CLIs and a real harness server;
    // parallel files introduce load-sensitive flakes for no win
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          icons: ["@phosphor-icons/react"],
          markdown: ["react-markdown", "remark-gfm", "shiki"],
          analytics: ["posthog-js"],
          qrcode: ["qrcode.react"],
          styling: ["clsx", "tailwind-merge"],
        },
      },
    },
  },
  server: {
    // IPv4 explicitly — a bare ::1 bind makes localhost a coin-flip for
    // clients that resolve IPv4 first
    host: "127.0.0.1",
    port: 5199,
    // packager output lands inside the repo — its HTML files must never
    // trigger dev full-page reloads
    watch: {
      ignored: ["**/release/**", "**/build/**", "**/dist/**", "**/electron/resources/**"],
    },
    // the harness server owns every provider process; the app only ever
    // talks to /api — clients hold no transports
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.MAUSCREW_PORT || 8799}`,
      },
    },
  },
});
