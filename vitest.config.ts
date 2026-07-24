import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "playwright-report/",
        "playwright/",
        "vitest.config.ts",
        "vitest.setup.ts",
        "next.config.mjs",
        "postcss.config.mjs",
        "tailwind.config.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@/lib": resolve(__dirname, "lib"),
      "@/components": resolve(__dirname, "components"),
      "@/types": resolve(__dirname, "types"),
    },
  },
});
