import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

// Two browser-only WebSocket flows that no other layer exercises:
//   - Reload-replay: on resubscribe the server sends a self-contained VT
//     snapshot synthesized from emulator state, and prior output reappears
//     in xterm.js after terminal.reset() + write(snapshot).
//   - Events reconnect with backoff: when the network drops and recovers,
//     the client must resubscribe and resume receiving events.

test.describe("SC.WS.4 - Scrollback on Reconnect", () => {
  test("previous output replayed after page reload", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const project = await api.post("/api/v1/projects", { name: "ws-scroll", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "scroll-tab" });
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

test.describe("SC.WS.8 - Foreground liveness probe", () => {
  // Returning to the tab must NOT blindly reconnect a healthy socket: a
  // reconnect sends a fresh snapshot, which does terminal.reset() and wipes the
  // user's scroll position. On a live connection the foreground handler instead
  // pings and waits for a pong, leaving the terminal untouched.
  test("healthy connection is not reset on foreground", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const project = await api.post("/api/v1/projects", { name: "ws-probe", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "probe-tab" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId(`terminal-tab-${tab.id}`).click();
    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });

    const terminal = new TerminalHelper(page);
    await terminal.type("echo PROBE_HEALTHY\n");
    await terminal.waitForText("PROBE_HEALTHY", 5000);

    // Count terminal.reset() calls — only a reconnect snapshot triggers one.
    await page.evaluate(() => {
      const term = (window as unknown as { __GOSOK_TERMINAL__: { reset: () => void } }).__GOSOK_TERMINAL__;
      (window as unknown as { __resetCount: number }).__resetCount = 0;
      const orig = term.reset.bind(term);
      term.reset = () => {
        (window as unknown as { __resetCount: number }).__resetCount++;
        return orig();
      };
    });

    // The handler early-returns unless the page is actually visible; assert that
    // so the dispatch below genuinely exercises probeLiveness (not a no-op).
    expect(await page.evaluate(() => document.visibilityState)).toBe("visible");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

    // Wait past PROBE_TIMEOUT_MS (3s): if the pong hadn't cleared the probe, the
    // socket would have been torn down and reset by now.
    await page.waitForTimeout(3500);

    const resetCount = await page.evaluate(() => (window as unknown as { __resetCount: number }).__resetCount);
    expect(resetCount).toBe(0);

    // Same live socket — input still reaches the PTY.
    await terminal.type("echo STILL_ALIVE\n");
    await terminal.waitForText("STILL_ALIVE", 5000);
  });
});
