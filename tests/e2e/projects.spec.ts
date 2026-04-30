import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";

// Reorder is the only project test that exercises browser-only behaviour:
// the sidebar's DOM order must reflect the server's sort_order. CRUD
// operations are covered by the integration tests and add no value here.

test.describe("SC.PROJ.2 - Project Reorder [Web UI]", () => {
  test("reorder reflects in sidebar", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);

    const p1 = await api.post("/api/v1/projects", { name: "Project-A", path: "/tmp/a" });
    const p2 = await api.post("/api/v1/projects", { name: "Project-B", path: "/tmp/b" });
    const p3 = await api.post("/api/v1/projects", { name: "Project-C", path: "/tmp/c" });

    const allProjects = await api.get("/api/v1/projects");
    const otherIds = allProjects
      .filter((p: any) => ![p1.id, p2.id, p3.id].includes(p.id))
      .map((p: any) => p.id);
    await api.put("/api/v1/projects/reorder", { ids: [p3.id, p1.id, p2.id, ...otherIds] });
    await navigateAndWait(page);

    const p3El = page.getByTestId(`sidebar-project-${p3.id}`);
    const p1El = page.getByTestId(`sidebar-project-${p1.id}`);
    const p2El = page.getByTestId(`sidebar-project-${p2.id}`);
    await expect(p3El).toBeVisible();
    await expect(p1El).toBeVisible();
    await expect(p2El).toBeVisible();

    const p3Box = await p3El.boundingBox();
    const p1Box = await p1El.boundingBox();
    const p2Box = await p2El.boundingBox();
    expect(p3Box!.y).toBeLessThan(p1Box!.y);
    expect(p1Box!.y).toBeLessThan(p2Box!.y);
  });
});
