import { test } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";

test.describe("SC.SET.1 - Settings CRUD [Web UI]", () => {
  test("view settings page", async ({ page, request }) => {
    await setupTestEnv(page);
    const ui = new UiHelper(page);

    await ui.click("sidebar-settings");
    await ui.waitForText("Font Size", 5000);
    await ui.see("Terminal");
  });

  test("changed setting reflects in UI", async ({ page, request }) => {
    await setupTestEnv(page);
    const ui = new UiHelper(page);

    // terminal_font_size is a client-side setting stored in localStorage
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem("gosok-client-settings") || "{}");
      settings.terminal_font_size = 18;
      localStorage.setItem("gosok-client-settings", JSON.stringify(settings));
    });
    await navigateAndWait(page);
    await ui.click("sidebar-settings");
    await page.waitForTimeout(1000);
    await ui.see("18");
  });
});

test.describe("SC.SET.2 - Default Settings [Web UI]", () => {
  test("defaults present on fresh start", async ({ page }) => {
    await setupTestEnv(page);
    const ui = new UiHelper(page);

    await ui.click("sidebar-settings");
    await ui.waitForText("Font Size", 5000);
  });

  test("reset restores default value", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    await api.put("/api/v1/settings/terminal_font_size", { value: 20 });
    await api.delete("/api/v1/settings/terminal_font_size");
    await navigateAndWait(page);
    await ui.click("sidebar-settings");
    await ui.waitForText("Font Size", 5000);
    await ui.see("14");
  });
});
