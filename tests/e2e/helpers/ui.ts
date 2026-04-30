import { type Page, expect } from "@playwright/test";

export class UiHelper {
  constructor(private page: Page) {}

  async click(testId: string): Promise<void> {
    await this.page.getByTestId(testId).click();
  }

  async clickText(text: string): Promise<void> {
    await this.page.getByText(text, { exact: true }).click();
  }

  async clickButton(name: string): Promise<void> {
    await this.page.getByRole("button", { name }).click();
  }

  async fill(testId: string, value: string): Promise<void> {
    await this.page.getByTestId(testId).fill(value);
  }

  async fillPlaceholder(placeholder: string, value: string): Promise<void> {
    await this.page.getByPlaceholder(placeholder).fill(value);
  }

  async see(text: string): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible();
  }

  async notSee(text: string): Promise<void> {
    await expect(this.page.getByText(text)).not.toBeVisible();
  }

  async seeTestId(testId: string): Promise<void> {
    await expect(this.page.getByTestId(testId)).toBeVisible();
  }

  async notSeeTestId(testId: string): Promise<void> {
    await expect(this.page.getByTestId(testId)).not.toBeVisible();
  }

  async waitForText(text: string, timeout = 5000): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible({ timeout });
  }

  async count(testId: string): Promise<number> {
    return this.page.getByTestId(testId).count();
  }

  // Block until the events WebSocket is open. Set by useEvents in onopen.
  // Prevents races where a test posts an event before the client subscribed.
  async waitForEventsReady(timeout = 5000): Promise<void> {
    await this.page.waitForFunction(
      () => (window as { __GOSOK_EVENTS_READY?: boolean }).__GOSOK_EVENTS_READY === true,
      undefined,
      { timeout },
    );
  }
}
