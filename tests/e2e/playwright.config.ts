import { defineConfig } from "@playwright/test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

const PORT = parseInt(process.env.E2E_PORT || "18436", 10);
const DB_DIR = path.join(os.tmpdir(), "gosok-e2e");
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = process.env.E2E_DB_PATH || path.join(DB_DIR, "gosok.db");

export { DB_PATH, PORT };

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `rm -f "${DB_PATH}" "${DB_PATH}-wal" "${DB_PATH}-shm" && ../../bin/gosok`,
    port: PORT,
    env: {
      GOSOK_DB_PATH: DB_PATH,
      GOSOK_PORT: String(PORT),
    },
    reuseExistingServer: false,
    timeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
