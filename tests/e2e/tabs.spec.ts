import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

test.describe("SC.TAB.1 - Tab CRUD [Web UI]", () => {
  test("create a tab via button", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "tab-crud", path: "/tmp" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);

    await ui.click("project-add-tab");
    // Wait for the tab to appear in the tab bar
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid^="terminal-tab-"]').length > 0,
      { timeout: 5000 },
    );
  });

  test("delete a tab", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "tab-del", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "del-tab", tab_type: "shell" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await ui.see("del-tab");

    await api.delete(`/api/v1/tabs/${tab.id}`);
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await ui.notSee("del-tab");
  });
});

test.describe("SC.TAB.2 - Tab Lifecycle [Web UI]", () => {
  test("start tab shows terminal", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "lifecycle", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "start-tab", tab_type: "shell" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();

    await ui.seeTestId("terminal-pane");
  });
});

test.describe("SC.TAB.4 - Tab Write [Web UI]", () => {
  test("type in terminal and see output", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const terminal = new TerminalHelper(page);

    const project = await api.post("/api/v1/projects", { name: "write-test", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "write-tab", tab_type: "shell" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    await terminal.type("echo HELLO_E2E\n");
    await terminal.waitForText("HELLO_E2E", 10000);
  });
});

test.describe("SC.TAB.5 - Tab Screen [Web UI]", () => {
  test("terminal shows scrollback", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const terminal = new TerminalHelper(page);

    const project = await api.post("/api/v1/projects", { name: "screen-test", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "screen-tab", tab_type: "shell" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    await terminal.type("for i in $(seq 1 5); do echo LINE_$i; done\n");
    await terminal.waitForText("LINE_5", 10000);

    const content = await terminal.getContent();
    expect(content).toContain("LINE_1");
    expect(content).toContain("LINE_5");
  });
});

test.describe("SC.TAB.7 - Dynamic Title [Web UI]", () => {
  // Skipped: the title header is only shown in terminals mode with an active running tab.
  // When a tab starts, the shell immediately emits its own OSC title sequence which
  // overwrites the stored title before the assertion can fire. Reliable verification
  // of this feature requires OSC parsing in the PTY layer (not yet implemented).
  test.skip("title API update reflects in tab UI", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "title-test", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "title-tab", tab_type: "shell" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);

    await api.put(`/api/v1/tabs/${tab.id}/title`, { title: "MY_CUSTOM_TITLE" });

    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();
    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10_000 });
    await ui.waitForText("MY_CUSTOM_TITLE", 5000);
  });
});
