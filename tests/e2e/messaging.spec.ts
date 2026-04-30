import { test } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";

// These tests cover the events WebSocket → DOM flow: a message published via
// the API must arrive in the running browser session and surface in the
// notification center. waitForEventsReady avoids a race where we publish
// before the client has finished subscribing.

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
    await ui.waitForEventsReady();

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
    await ui.waitForEventsReady();

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
    await ui.waitForEventsReady();

    await api.post("/api/v1/messages", { scope: "global", body: "global-msg" });

    await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("notification-bell");
    await ui.waitForText("global-msg", 5000);
  });
});
