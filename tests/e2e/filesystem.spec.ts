import { test, expect } from "@playwright/test";
import { setupTestEnv, navigateAndWait } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

function createTempDir(): string {
  return fs.mkdtempSync("/tmp/gosok-fs-test-");
}

function cleanupDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

test.describe("SC.FS.1 - Directory Browsing", () => {
  test("browse directories in editor pane", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const tmpDir = createTempDir();
    fs.mkdirSync(path.join(tmpDir, "subdir-a"));
    fs.mkdirSync(path.join(tmpDir, "subdir-b"));

    const project = await api.post("/api/v1/projects", { name: "fs-test", path: tmpDir });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId("project-mode-editor").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("project-mode-editor");

    await ui.waitForText("subdir-a", 5000);
    await ui.see("subdir-b");

    cleanupDir(tmpDir);
  });
});

test.describe("SC.FS.2 - File Listing", () => {
  test("list files", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const tmpDir = createTempDir();
    fs.writeFileSync(path.join(tmpDir, "file-a.txt"), "content-a");
    fs.writeFileSync(path.join(tmpDir, "file-b.txt"), "content-b");

    const project = await api.post("/api/v1/projects", { name: "files-test", path: tmpDir });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId("project-mode-editor").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("project-mode-editor");

    await ui.waitForText("file-a.txt", 5000);
    await ui.see("file-b.txt");

    cleanupDir(tmpDir);
  });
});

test.describe("SC.FS.3 - File Read/Write", () => {
  test("read file content in editor", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const tmpDir = createTempDir();
    fs.writeFileSync(path.join(tmpDir, "editable.txt"), "original content");

    const project = await api.post("/api/v1/projects", { name: "edit-test", path: tmpDir });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId("project-mode-editor").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("project-mode-editor");
    await ui.clickText("editable.txt");

    await ui.waitForText("original content", 5000);

    cleanupDir(tmpDir);
  });
});

test.describe("SC.FS.4 - Git Changes", () => {
  test("show changed files in diff mode", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const tmpDir = createTempDir();
    spawnSync("git", ["init"], { cwd: tmpDir });
    spawnSync("git", ["config", "user.email", "test@test.com"], { cwd: tmpDir });
    spawnSync("git", ["config", "user.name", "Test"], { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "initial");
    spawnSync("git", ["add", "."], { cwd: tmpDir });
    spawnSync("git", ["commit", "-m", "init"], { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "modified");

    const project = await api.post("/api/v1/projects", { name: "git-test", path: tmpDir });
    await navigateAndWait(page);
    await ui.click(`sidebar-project-${project.id}`);
    await page.getByTestId("project-mode-diff").waitFor({ state: "visible", timeout: 5000 });
    await ui.click("project-mode-diff");
    await page.waitForTimeout(1000);

    // Use a visible locator — the file name appears in multiple panes (editor + diff),
    // but the diff pane shows status labels (M/A/D) next to file names.
    // Wait for the diff pane's changed file entry to be visible.
    await expect(page.getByText("file.txt").last()).toBeVisible({ timeout: 5000 });

    cleanupDir(tmpDir);
  });
});
