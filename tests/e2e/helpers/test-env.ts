import { type Page } from "@playwright/test";

/**
 * Navigate to the app and wait for it to be fully loaded.
 * Waits for the sidebar dashboard button as a signal that React has rendered.
 */
export async function setupTestEnv(page: Page): Promise<void> {
  await navigateAndWait(page);
}

/**
 * Navigate to root and wait for the app to fully render.
 * Use this after api calls to refresh the page with new data.
 */
export async function navigateAndWait(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("sidebar-dashboard").waitFor({ state: "visible", timeout: 10_000 });
}
