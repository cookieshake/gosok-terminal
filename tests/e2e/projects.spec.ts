import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";

test.describe("SC.PROJ.1 - Project CRUD [Web UI]", () => {
  test("create a project", async ({ page, request }) => {
    await setupTestEnv(page);
    const ui = new UiHelper(page);

    await ui.click("sidebar-new-project");
    await ui.fill("create-project-path", "/tmp/test-project");
    await ui.clickButton("Create");
    await ui.see("test-project");
  });

  test("view project details", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "detail-test", path: "/tmp/detail" });
    await navigateAndWait(page);

    await ui.click(`sidebar-project-${project.id}`);
    await ui.seeTestId("project-view");
  });

  test("delete project disappears", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "to-delete", path: "/tmp/del" });
    await navigateAndWait(page);
    await ui.seeTestId(`sidebar-project-${project.id}`);

    await api.delete(`/api/v1/projects/${project.id}`);
    await navigateAndWait(page);
    await ui.notSeeTestId(`sidebar-project-${project.id}`);
  });
});

test.describe("SC.PROJ.2 - Project Reorder [Web UI]", () => {
  test("reorder reflects in sidebar", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);

    const p1 = await api.post("/api/v1/projects", { name: "Project-A", path: "/tmp/a" });
    const p2 = await api.post("/api/v1/projects", { name: "Project-B", path: "/tmp/b" });
    const p3 = await api.post("/api/v1/projects", { name: "Project-C", path: "/tmp/c" });

    // Get all existing projects and prepend our 3 in desired order
    const allProjects = await api.get("/api/v1/projects");
    const otherIds = allProjects
      .filter((p: any) => ![p1.id, p2.id, p3.id].includes(p.id))
      .map((p: any) => p.id);
    await api.put("/api/v1/projects/reorder", { ids: [p3.id, p1.id, p2.id, ...otherIds] });
    await navigateAndWait(page);

    // Verify our 3 projects are in the correct relative order
    const p3El = page.getByTestId(`sidebar-project-${p3.id}`);
    const p1El = page.getByTestId(`sidebar-project-${p1.id}`);
    const p2El = page.getByTestId(`sidebar-project-${p2.id}`);
    await expect(p3El).toBeVisible();
    await expect(p1El).toBeVisible();
    await expect(p2El).toBeVisible();

    // Check order by getting bounding boxes
    const p3Box = await p3El.boundingBox();
    const p1Box = await p1El.boundingBox();
    const p2Box = await p2El.boundingBox();
    expect(p3Box!.y).toBeLessThan(p1Box!.y);
    expect(p1Box!.y).toBeLessThan(p2Box!.y);
  });
});
