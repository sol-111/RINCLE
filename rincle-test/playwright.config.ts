import { defineConfig } from "@playwright/test";

export default defineConfig({
  testMatch: "**/*.e2e.ts",
  timeout: 120000,
  use: {
    headless: false,
    actionTimeout: 15000,
  },
});
