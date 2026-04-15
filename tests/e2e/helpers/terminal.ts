import { type Page } from "@playwright/test";

/**
 * Helper for interacting with xterm.js terminal in the browser.
 *
 * xterm.js renders to a canvas, so DOM text queries don't work.
 * We use the xterm.js API exposed via window.__GOSOK_TERMINAL__ to read buffer content.
 */
export class TerminalHelper {
  constructor(private page: Page) {}

  async type(text: string): Promise<void> {
    const terminalEl = this.page.locator(".xterm-helper-textarea");
    await terminalEl.focus();
    for (const char of text) {
      if (char === "\n") {
        await this.page.keyboard.press("Enter");
      } else {
        await this.page.keyboard.type(char, { delay: 10 });
      }
    }
  }

  async waitForText(target: string, timeout = 10000): Promise<void> {
    await this.page.waitForFunction(
      (text: string) => {
        const term = (window as any).__GOSOK_TERMINAL__;
        if (!term) return false;
        const buffer = term.buffer.active;
        let content = "";
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) content += line.translateToString(true) + "\n";
        }
        return content.includes(text);
      },
      target,
      { timeout },
    );
  }

  async getContent(): Promise<string> {
    return this.page.evaluate(() => {
      const term = (window as any).__GOSOK_TERMINAL__;
      if (!term) return "";
      const buffer = term.buffer.active;
      let content = "";
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) content += line.translateToString(true) + "\n";
      }
      return content;
    });
  }
}
