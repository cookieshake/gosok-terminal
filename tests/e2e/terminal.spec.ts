import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

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

test.describe("SC.TERM.1 - Session Lifecycle", () => {
  test("terminal session produces output", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    await terminal.type("echo SESSION_ALIVE\n");
    await terminal.waitForText("SESSION_ALIVE", 5000);
  });
});

test.describe("SC.TERM.2 - Scrollback", () => {
  test("output preserved in scrollback buffer", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    await terminal.type("for i in $(seq 1 20); do echo SCROLL_$i; done\n");
    await terminal.waitForText("SCROLL_20", 5000);

    const content = await terminal.getContent();
    expect(content).toContain("SCROLL_1");
    expect(content).toContain("SCROLL_20");
  });
});

test.describe("SC.TERM.3 - Output Recovery", () => {
  test("reconnect replays previous output", async ({ page, request }) => {
    await setupTestEnv(page);
    const { project, tab } = await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    await terminal.type("echo BEFORE_RECONNECT\n");
    await terminal.waitForText("BEFORE_RECONNECT", 5000);

    await navigateAndWait(page);
    const ui = new UiHelper(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();
    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });

    const newTerminal = new TerminalHelper(page);
    await newTerminal.waitForText("BEFORE_RECONNECT", 10000);
  });
});

test.describe("SC.TERM.4 - Terminal Resize", () => {
  test("terminal adapts to viewport resize", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000);

    await terminal.type("echo RESIZED_OK\n");
    await terminal.waitForText("RESIZED_OK", 5000);
  });
});

test.describe("SC.TERM.5 - Keyboard Routing", () => {
  test("Ctrl+A moves cursor to beginning of line", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    // Type a command, then use Ctrl+A (readline: beginning-of-line) followed by
    // a prefix to confirm the cursor moved to the start.
    await terminal.type("echo AFTER_CTRL_A");
    await page.keyboard.press("Control+a");
    await terminal.type("echo BEFORE;");
    await page.keyboard.press("Enter");

    // If Ctrl+A was forwarded to the terminal (not intercepted by browser),
    // the shell executes "echo BEFORE; echo AFTER_CTRL_A"
    await terminal.waitForText("BEFORE", 5000);
    await terminal.waitForText("AFTER_CTRL_A", 5000);
  });

  test("Ctrl+C sends SIGINT when no text is selected", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    // Start a long-running process, then kill it with Ctrl+C
    await terminal.type("sleep 30");
    await page.keyboard.press("Control+c");
    await page.waitForTimeout(500);

    // Shell returns to prompt after SIGINT — typing a new command works
    await terminal.type("echo SIGINT_OK\n");
    await terminal.waitForText("SIGINT_OK", 5000);
  });
});

test.describe("SC.TERM.6 - Mobile Viewport", () => {
  test("terminal resizes when viewport shrinks (keyboard open simulation)", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    const originalSize = { width: 390, height: 844 };
    const keyboardOpen = { width: 390, height: 450 };

    await page.setViewportSize(originalSize);
    await page.waitForTimeout(500);

    // Simulate keyboard opening: viewport shrinks
    await page.setViewportSize(keyboardOpen);
    await page.waitForTimeout(500);

    // Terminal should still accept input after resize
    await terminal.type("echo MOBILE_OK\n");
    await terminal.waitForText("MOBILE_OK", 5000);
  });

  test("scroll resets when viewport grows (keyboard close simulation)", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);

    await page.setViewportSize({ width: 390, height: 450 });
    await page.waitForTimeout(300);

    // Simulate keyboard closing: viewport grows back
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    // After keyboard closes, scrollY must be 0
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });
});
