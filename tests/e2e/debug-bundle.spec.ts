import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

// Browser-only behaviour: the debug button collects xterm.js buffer + browser
// state, merges it with the server's /api/v1/tabs/{id}/debug response, and
// triggers a Blob download. The Blob assembly and download flow are
// untestable from Go.

async function setupRunningTab(page: any, request: any) {
  const api = new ApiHelper(request);
  const project = await api.post("/api/v1/projects", { name: "debug-test", path: "/tmp" });
  const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "debug-tab" });
  await api.post(`/api/v1/tabs/${tab.id}/start`);
  await navigateAndWait(page);
  const ui = new UiHelper(page);
  await ui.click(`sidebar-project-${project.id}`);
  await page.getByTestId(`terminal-tab-${tab.id}`).waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId(`terminal-tab-${tab.id}`).click();
  await page.waitForSelector(".xterm-helper-textarea", { timeout: 10_000 });
  return { api, project, tab };
}

test.describe("Debug bundle download", () => {
  test("downloads a markdown bundle with server + client sections", async ({ page, request }) => {
    await setupTestEnv(page);
    const { tab } = await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    // Put a recognizable marker into the PTY so it lands in both the server's
    // raw ring and the client's xterm scrollback. The bundle should contain
    // the marker in at least one of those sections.
    const marker = `GOSOK_DEBUG_MARKER_${Date.now()}`;
    await terminal.type(`echo ${marker}`);
    await page.keyboard.press("Enter");
    await terminal.waitForText(marker, 5_000);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("terminal-debug").click(),
    ]);

    expect(download.suggestedFilename()).toContain(tab.id);
    expect(download.suggestedFilename()).toMatch(/\.md$/);

    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = await import("node:fs/promises");
    const md = await fs.readFile(path!, "utf8");

    expect(md).toContain("# Gosok Debug Bundle");
    expect(md).toContain(`Tab ID: ${tab.id}`);
    expect(md).toContain("## Server: PTY Session State");
    expect(md).toContain("## Server: Raw PTY Tail");
    expect(md).toContain("## Client: Browser & Viewport");
    expect(md).toContain("## Client: xterm State");
    expect(md).toContain(marker);
  });
});
