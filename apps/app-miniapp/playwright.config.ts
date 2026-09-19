import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
  },
  projects: [{ name: "chrome", use: { channel: "chrome" } }],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    env: { VITE_USE_MOCK: "1" },
    timeout: 120_000,
  },
});
