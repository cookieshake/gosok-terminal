import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";

// Form-state persistence across navigation is the only browser-only piece
// worth testing: the appendEnter toggle is local state that must survive
// a Save → navigate-away → return cycle. CRUD/defaults/reset is API
// behaviour and lives in the integration tests.

test.describe("SC.SET.3 - Shortcuts Management", () => {
  test("appendEnter toggle persists after save", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    await api.put("/api/v1/settings/shortcuts", { value: [] });
    await navigateAndWait(page);
    const ui = new UiHelper(page);

    await ui.click("sidebar-settings");
    await ui.waitForText("Shortcuts", 5000);
    await ui.clickText("Shortcuts");

    await ui.clickButton("Add");
    await ui.fillPlaceholder("Label", "EnterTool");
    await ui.fillPlaceholder("command", "entertool");

    await page.getByTestId("shortcut-append-enter-0").click();

    // Wait for the Save PUT to complete before navigating away — otherwise
    // the navigation can race the request and drop the persisted change.
    const savePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/v1/settings/shortcuts") &&
        resp.request().method() === "PUT" &&
        resp.ok(),
      { timeout: 5000 },
    );
    await ui.clickButton("Save");
    await savePromise;

    await navigateAndWait(page);
    await ui.click("sidebar-settings");
    await ui.clickText("Shortcuts");
    await page.getByTestId("shortcut-append-enter-0").waitFor({ state: "visible", timeout: 10_000 });

    const checked = await page.getByTestId("shortcut-append-enter-0").evaluate(
      (el: HTMLElement) =>
        el.getAttribute("data-state") === "on" ||
        el.getAttribute("aria-checked") === "true" ||
        (el as any).dataset.appendEnter === "true",
    );
    expect(checked).toBe(true);
  });
});
