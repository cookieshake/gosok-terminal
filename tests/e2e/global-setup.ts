import * as fs from "fs";
import { DB_PATH } from "./playwright.config";

export default function globalSetup() {
  console.log(`[global-setup] Deleting DB: ${DB_PATH}`);
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(DB_PATH + suffix);
      console.log(`[global-setup] Deleted ${DB_PATH}${suffix}`);
    } catch {
      console.log(`[global-setup] ${DB_PATH}${suffix} doesn't exist`);
    }
  }
  console.log(`[global-setup] Done`);
}
