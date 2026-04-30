import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

// Two browser-only WebSocket flows that no other layer exercises:
//   - Reload-replay: client sends its byte offset, server returns
//     BytesSince(offset) and the missing output reappears in xterm.js.
//   - Events reconnect with backoff: when the network drops and recovers,
//     the client must resubscribe and resume receiving events.

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

test.describe("SC.WS.7 - Events WebSocket Reconnect", () => {
  test("notifications resume after events WS is closed and reconnects", async ({ page, request, context }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "ws-reconnect", path: "/tmp" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await ui.waitForEventsReady();

    // Drop the network to force the events WS to close, then restore.
    // The client backoff loop will reconnect; on connect, __GOSOK_EVENTS_READY
    // flips back to true.
    await context.setOffline(true);
    await context.setOffline(false);

    // Notifications are pure pub/sub: a publish that lands before the new
    // subscription is dropped on the floor. Retry posting until the bell
    // becomes visible — that's our signal that a publish hit a live sub.
    await expect(async () => {
      await api.post("/api/v1/notify", { title: "AFTER_RECONNECT" });
      await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 1500 });
    }).toPass({ timeout: 15_000, intervals: [500, 1000, 2000] });

    await ui.click("notification-bell");
    await ui.waitForText("AFTER_RECONNECT", 10_000);
  });
});
