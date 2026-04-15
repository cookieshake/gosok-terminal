import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

test.describe("SC.WS.1 - Terminal Connection", () => {
  test("WebSocket connects and terminal is interactive", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const project = await api.post("/api/v1/projects", { name: "ws-conn", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "ws-tab", tab_type: "shell" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    const terminal = new TerminalHelper(page);
    await terminal.type("echo WS_OK\n");
    await terminal.waitForText("WS_OK", 5000);
  });
});

test.describe("SC.WS.2 - Terminal Events", () => {
  test("process exit updates tab status", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const project = await api.post("/api/v1/projects", { name: "ws-exit", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "exit-tab", tab_type: "shell" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    const terminal = new TerminalHelper(page);

    await terminal.type("exit 0\n");
    await page.waitForTimeout(3000);

    const tabData = await api.get(`/api/v1/tabs/${tab.id}`);
    expect(tabData.status.status).toBe("stopped");
  });
});

test.describe("SC.WS.4 - Scrollback on Reconnect", () => {
  test("previous output replayed after page reload", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const project = await api.post("/api/v1/projects", { name: "ws-scroll", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "scroll-tab", tab_type: "shell" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    const terminal = new TerminalHelper(page);

    await terminal.type("echo SCROLLBACK_XYZ\n");
    await terminal.waitForText("SCROLLBACK_XYZ", 5000);

    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();
    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });

    const newTerminal = new TerminalHelper(page);
    await newTerminal.waitForText("SCROLLBACK_XYZ", 10000);
  });
});

test.describe("SC.WS.4 - Scrollback on Reconnect (no duplication)", () => {
  test("scrollback content appears exactly once after reconnect", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const project = await api.post("/api/v1/projects", { name: "ws-dedup", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "dedup-tab", tab_type: "shell" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();
    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    const terminal = new TerminalHelper(page);

    await terminal.type("echo SYNC_DEDUP_MARKER\n");
    await terminal.waitForText("SYNC_DEDUP_MARKER", 5000);

    // Reconnect by navigating away and back
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();
    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });

    const newTerminal = new TerminalHelper(page);
    await newTerminal.waitForText("SYNC_DEDUP_MARKER", 10000);

    // The marker must appear exactly once — serverOffset inflation would cause a full
    // reset+replay on every reconnect, potentially showing the content twice.
    const content = await newTerminal.getContent();
    const occurrences = (content.match(/SYNC_DEDUP_MARKER/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});

test.describe("SC.WS.5 - Real-Time Events", () => {
  test("notification arrives in real-time", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "ws-events", path: "/tmp" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);

    await api.post("/api/v1/notify", { title: "REALTIME_ALERT" });
    await page.waitForTimeout(2000);
    await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("notification-bell");
    await ui.waitForText("REALTIME_ALERT", 5000);
  });
});

test.describe("SC.WS.7 - Events WebSocket Reconnect", () => {
  test("notifications resume after events WS is closed and reconnects", async ({ page, request, context }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "ws-reconnect", path: "/tmp" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);

    // Drop the network to force the app's events WebSocket to close
    await context.setOffline(true);
    // Restore network — the client reconnect loop (backoff starts at 1 s) will fire
    await context.setOffline(false);

    // Wait until the app has reconnected by polling for a notification to arrive
    await api.post("/api/v1/notify", { title: "AFTER_RECONNECT" });
    await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 10_000 });
    await ui.click("notification-bell");
    await ui.waitForText("AFTER_RECONNECT", 10_000);
  });
});

test.describe("SC.WS.6 - Demo Terminal", () => {
  test("demo WebSocket endpoint accepts connection", async ({ page }) => {
    await setupTestEnv(page);

    const connected = await page.evaluate(async () => {
      return new Promise<boolean>((resolve) => {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/demo`);
        ws.onopen = () => { ws.close(); resolve(true); };
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
      });
    });

    expect(connected).toBe(true);
  });
});
