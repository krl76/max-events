import { defineConfig } from "@playwright/test";

const live = process.env.LIVE_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  retries: 0,
  workers: 1,
  use: {
    baseURL: live || "http://localhost:5173",
  },
  projects: [{ name: "chrome", use: { channel: "chrome" } }],
  webServer: live
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        env: { VITE_USE_MOCK: "1" },
        timeout: 120_000,
      },
});
