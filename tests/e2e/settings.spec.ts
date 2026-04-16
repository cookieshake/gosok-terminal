import { test, expect } from "@playwright/test";
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

test.describe("SC.SET.3 - Shortcuts Management", () => {
  test("add a shortcut and it appears in settings list", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    await api.put("/api/v1/settings/shortcuts", { value: [] });
    const ui = new UiHelper(page);

    await ui.click("sidebar-settings");
    await ui.waitForText("Shortcuts", 5000);
    await ui.clickText("Shortcuts");

    await ui.clickButton("Add");
    await ui.fillPlaceholder("Label", "MyTool");
    await ui.fillPlaceholder("command", "mytool --run");
    await ui.clickButton("Save");

    await navigateAndWait(page);
    await ui.click("sidebar-settings");
    await ui.clickText("Shortcuts");
    await ui.see("MyTool");
  });

  test("disabled shortcut is not shown in tab bar", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    await api.put("/api/v1/settings/shortcuts", {
      value: [{ label: "VisibleTool", command: "visibletool", enabled: true }],
    });
    await navigateAndWait(page);

    const project = await api.post("/api/v1/projects", { name: "sc-set3", path: "/tmp" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await ui.see("VisibleTool");

    await api.put("/api/v1/settings/shortcuts", {
      value: [{ label: "VisibleTool", command: "visibletool", enabled: false }],
    });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await ui.notSee("VisibleTool");
  });

  test("appendEnter toggle persists after save", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    await api.put("/api/v1/settings/shortcuts", { value: [] });
    const ui = new UiHelper(page);

    await ui.click("sidebar-settings");
    await ui.waitForText("Shortcuts", 5000);
    await ui.clickText("Shortcuts");

    await ui.clickButton("Add");
    await ui.fillPlaceholder("Label", "EnterTool");
    await ui.fillPlaceholder("command", "entertool");

    // Toggle appendEnter on
    await page.getByTestId("shortcut-append-enter-0").click();
    await ui.clickButton("Save");

    await navigateAndWait(page);
    await ui.click("sidebar-settings");
    await ui.clickText("Shortcuts");

    // appendEnter toggle should remain on after reload
    const checked = await page.getByTestId("shortcut-append-enter-0").evaluate(
      (el: HTMLElement) => el.getAttribute("data-state") === "on" || el.getAttribute("aria-checked") === "true"
        || (el as any).dataset.appendEnter === "true"
    );
    expect(checked).toBe(true);
  });

  test("unsaved changes do not persist after navigation", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    await api.put("/api/v1/settings/shortcuts", { value: [] });
    const ui = new UiHelper(page);

    await ui.click("sidebar-settings");
    await ui.waitForText("Shortcuts", 5000);
    await ui.clickText("Shortcuts");

    await ui.clickButton("Add");
    await ui.fillPlaceholder("Label", "TempTool");
    // Navigate away WITHOUT saving
    await navigateAndWait(page);

    await ui.click("sidebar-settings");
    await ui.clickText("Shortcuts");
    await ui.notSee("TempTool");
  });
});
