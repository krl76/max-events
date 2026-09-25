import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * `--mode mock` включает витрину на моках: `main.tsx` смотрит на `VITE_USE_MOCK`, и здесь этот флаг
 * подставляется самой сборкой. Файла `.env.mock` нет намеренно — `.env*` в этом репозитории отданы
 * секретам, и держать рядом с ними безобидный флаг значит путать одно с другим.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: mode === "mock" ? { "import.meta.env.VITE_USE_MOCK": '"1"' } : {},
  server: {
    port: 5173,
    proxy: {
      // Live-mode dev: forward API calls to the local backend (bun run dev:backend).
      "/api": "http://localhost:3100",
      // Своя подложка карты: архив PMTiles и глифы лежат на сервере под /tiles (DEPLOY.md), не в репозитории —
      // 350 МБ данных не место в git. В dev они берутся с dev-стенда, в сборке — с того же домена, что и приложение.
      "/tiles": { target: "https://dev.events.versacegus.cc", changeOrigin: true },
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
}));
