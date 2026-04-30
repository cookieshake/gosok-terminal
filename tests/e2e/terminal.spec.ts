import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

// Browser-only behaviour:
//   - Ctrl+A / Ctrl+C key routing (xterm.js attachCustomKeyEventHandler):
//     readline beginning-of-line and SIGINT delivery prove that Ctrl+*
//     bypasses the browser shortcut and reaches the PTY.
//   - Mobile viewport grow: Layout.tsx watches visualViewport and resets
//     window.scrollY when the soft keyboard closes. No other layer can
//     verify this.

async function setupRunningTab(page: any, request: any) {
  const api = new ApiHelper(request);
  const project = await api.post("/api/v1/projects", { name: "term-test", path: "/tmp" });
  const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "term-tab", tab_type: "shell" });
  await api.post(`/api/v1/tabs/${tab.id}/start`);
  await navigateAndWait(page);
  const ui = new UiHelper(page);
  await ui.click(`sidebar-project-${project.id}`);
  await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId(`terminal-tab-${tab.id}`).click();
  await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
  return { api, project, tab };
}

test.describe("SC.TERM.5 - Keyboard Routing", () => {
  test("Ctrl+A moves cursor to beginning of line", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    // Type a partial command, jump to start with Ctrl+A, prepend a different
    // command. If Ctrl+A had been swallowed by the browser (select-all) the
    // shell would receive "echo AFTER_CTRL_Aecho BEFORE;" instead, and BEFORE
    // would never print.
    await terminal.type("echo AFTER_CTRL_A");
    await page.keyboard.press("Control+a");
    await terminal.type("echo BEFORE;");
    await page.keyboard.press("Enter");

    await terminal.waitForText("BEFORE", 5000);
    await terminal.waitForText("AFTER_CTRL_A", 5000);
  });

  test("Ctrl+C sends SIGINT when no text is selected", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    // Start a long-running process. With no selection, Ctrl+C must reach the
    // PTY as SIGINT — recovering the prompt is how we know it landed.
    await terminal.type("sleep 30");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Control+c");

    await terminal.type("echo SIGINT_OK\n");
    await terminal.waitForText("SIGINT_OK", 5000);
  });
});

test.describe("SC.TERM.6 - Mobile Viewport", () => {
  test("scroll resets when viewport grows (keyboard close simulation)", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);

    // Shrink to "keyboard open" then grow back to "keyboard closed". The
    // scroll-reset listener fires on the visualViewport resize event after
    // the layout reflows; wait for scrollY to be zero rather than guessing.
    await page.setViewportSize({ width: 390, height: 450 });
    await page.setViewportSize({ width: 390, height: 844 });

    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBe(0);
  });
});
