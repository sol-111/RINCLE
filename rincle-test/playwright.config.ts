import { defineConfig } from "@playwright/test";

export default defineConfig({
  testMatch: "**/*.e2e.ts",
  timeout: 120000,
  use: {
    headless: true,
    actionTimeout: 15000,
  },
});
