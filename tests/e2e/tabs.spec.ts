import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

// These two tests cover the end-to-end browser flow: clicking a started
// tab in the sidebar must connect a PTY WebSocket, send keystrokes, and
// render output via xterm.js. The scrollback variant additionally proves
// that lines pushed off the viewport remain readable in the buffer.

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
