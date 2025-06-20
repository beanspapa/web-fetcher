import { Page } from 'playwright';

export interface NavigationOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
  referer?: string;
}

export class NavigationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'NavigationError';
  }
}

export class PageNavigator {
  constructor(private page: Page) {}

  async goto(url: string, options: NavigationOptions = {}): Promise<void> {
    try {
      await this.page.goto(url, {
        waitUntil: options.waitUntil || 'load',
        timeout: options.timeout || 30000,
        referer: options.referer
      });
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Timeout') || error.message.includes('ERR_NAME_NOT_RESOLVED'))) {
        throw new NavigationError(`Navigation timeout: ${error.message}`, 'NAV_TIMEOUT');
      }
      throw new NavigationError(`Navigation failed: ${error}`, 'NAV_FAILED');
    }
  }

  getCurrentUrl(): string {
    return this.page.url();
  }

  async isPageLoaded(): Promise<boolean> {
    try {
      await this.page.waitForLoadState('load', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async waitForSelector(selector: string, timeout: number = 30000): Promise<void> {
    try {
      await this.page.waitForSelector(selector, { timeout });
    } catch (error) {
      throw new NavigationError(`Element not found: ${selector}`, 'ELEMENT_NOT_FOUND');
    }
  }

  async getElementText(selector: string): Promise<string | null> {
    try {
      return await this.page.textContent(selector);
    } catch (error) {
      throw new NavigationError(`Failed to get text: ${selector}`, 'TEXT_FAILED');
    }
  }

  async click(selector: string): Promise<void> {
    try {
      await this.page.click(selector);
    } catch (error) {
      throw new NavigationError(`Click failed: ${selector}`, 'CLICK_FAILED');
    }
  }

  async reload(options: NavigationOptions = {}): Promise<void> {
    try {
      await this.page.reload({
        waitUntil: options.waitUntil || 'load',
        timeout: options.timeout || 30000
      });
    } catch (error) {
      throw new NavigationError(`Reload failed: ${error}`, 'RELOAD_FAILED');
    }
  }
} 