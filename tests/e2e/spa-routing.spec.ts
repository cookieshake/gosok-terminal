import { test, expect } from "@playwright/test";
import { setupTestEnv } from "./helpers/test-env";

test.describe("SC.API.4 - SPA Routing", () => {
  test("deep URL returns SPA, not 404", async ({ page }) => {
    await page.goto("/some/deep/route");
    await page.waitForLoadState("networkidle");

    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(body).not.toContain("404");
  });

  test("API routes not caught by SPA fallback", async ({ page }) => {
    const resp = await page.request.get("/api/v1/health");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe("ok");
  });
});
