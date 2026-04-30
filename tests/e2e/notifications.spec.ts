import { test } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";

test.describe("SC.NOTIF.1 - Send Notification", () => {
  test("notification appears in panel", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "notif-test", path: "/tmp" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await ui.waitForEventsReady();

    await api.post("/api/v1/notify", { title: "Test Alert", body: "Something happened" });
    await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("notification-bell");
    await ui.waitForText("Test Alert", 5000);
    await ui.see("Something happened");
  });

  test("notification with flag", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "notif-flag", path: "/tmp" });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await ui.waitForEventsReady();

    await api.post("/api/v1/notify", { title: "Flagged Alert", flag: true });
    await page.getByTestId("notification-bell").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("notification-bell");
    await ui.waitForText("Flagged Alert", 5000);
  });
});
