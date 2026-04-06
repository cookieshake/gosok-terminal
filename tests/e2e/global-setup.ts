import * as fs from "fs";

/**
 * Runs once before webServer starts.
 * Deletes the test DB so the server creates a fresh one.
 */
export default function globalSetup() {
  const dbPath = process.env.E2E_DB_PATH || "/tmp/gosok-e2e-test.db";
  console.log(`[global-setup] Deleting DB: ${dbPath}`);
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(dbPath + suffix);
      console.log(`[global-setup] Deleted ${dbPath}${suffix}`);
    } catch {
      console.log(`[global-setup] ${dbPath}${suffix} doesn't exist`);
    }
  }
  console.log(`[global-setup] Done`);
}
