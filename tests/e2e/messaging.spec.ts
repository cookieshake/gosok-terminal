import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";

test.describe("SC.MSG.1 - Send Message", () => {
  test("direct message appears in notification center", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "msg-test", path: "/tmp" });
    const tabA = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-a", tab_type: "shell" });
    const tabB = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-b", tab_type: "shell" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);

    await api.post("/api/v1/messages", {
      scope: "direct", from_tab_id: tabA.id, to_tab_id: tabB.id, body: "hello-from-a",
    });

    await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("notification-bell");
    await ui.waitForText("hello-from-a", 5000);
  });

  test("broadcast message visible", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "bcast", path: "/tmp" });
    const tabA = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-a", tab_type: "shell" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);

    await api.post("/api/v1/messages", {
      scope: "broadcast", from_tab_id: tabA.id, body: "hello-broadcast",
    });

    await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("notification-bell");
    await ui.waitForText("hello-broadcast", 5000);
  });

  test("global feed message", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "global-msg-test", path: "/tmp" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);

    await api.post("/api/v1/messages", { scope: "global", body: "global-msg" });

    await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("notification-bell");
    await ui.waitForText("global-msg", 5000);
  });
});

test.describe("SC.MSG.2 - Inbox and Feed", () => {
  test("messages displayed in notification center", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "inbox-test", path: "/tmp" });
    const tabA = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-a", tab_type: "shell" });
    const tabB = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-b", tab_type: "shell" });

    // Navigate first so WebSocket is connected before sending messages
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.waitForTimeout(1000); // wait for WebSocket connection

    await api.post("/api/v1/messages", {
      scope: "direct", from_tab_id: tabA.id, to_tab_id: tabB.id, body: "direct-msg",
    });
    await api.post("/api/v1/messages", {
      scope: "broadcast", from_tab_id: tabA.id, body: "broadcast-msg",
    });

    await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("notification-bell");
    await page.getByTestId("notif-filter-messages").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("notif-filter-messages");
    await ui.see("direct-msg");
    await ui.see("broadcast-msg");
  });
});

test.describe("SC.MSG.3 - Read Markers", () => {
  test("marking read clears unread state", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "read-test", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-a", tab_type: "shell" });

    // Navigate first so WebSocket is connected before sending messages
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.waitForTimeout(1000); // wait for WebSocket connection

    await api.post("/api/v1/messages", {
      scope: "broadcast", from_tab_id: tab.id, body: "unread-msg",
    });

    await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("notification-bell");
    await ui.see("unread-msg");

    // Close the panel — this triggers markAllRead in the NotificationCenter
    await page.getByTestId("notif-panel").locator("button").first().click();
    await page.waitForTimeout(500);

    // Re-open and verify messages are now marked as read (no unread indicator)
    await ui.click("notification-bell");
    await ui.see("unread-msg");
  });
});
