import { Page, Cookie } from 'playwright';
import { BrowserManager, BrowserOptions } from './browser-manager.js';
import { PageNavigator, NavigationOptions } from './page-navigator.js';
import { SessionManager } from './session-manager.js';

export class BrowserIntegration {
  private browserManager: BrowserManager;
  private currentPage: Page | null = null;
  private pageNavigator: PageNavigator | null = null;
  private sessionManager: SessionManager | null = null;

  constructor(options: BrowserOptions = {}) {
    this.browserManager = new BrowserManager(options);
  }

  async initialize(): Promise<void> {
    await this.browserManager.initialize();
    this.currentPage = await this.browserManager.newPage();
    this.pageNavigator = new PageNavigator(this.currentPage);
    this.sessionManager = new SessionManager(this.currentPage);
  }

  async navigateToUrl(url: string, options?: NavigationOptions): Promise<void> {
    if (!this.pageNavigator) {
      throw new Error('Browser not initialized');
    }
    await this.pageNavigator.goto(url, options);
  }

  async waitForPageLoad(): Promise<boolean> {
    if (!this.pageNavigator) {
      throw new Error('Browser not initialized');
    }
    return await this.pageNavigator.isPageLoaded();
  }

  async getPageTitle(): Promise<string | null> {
    if (!this.currentPage) {
      throw new Error('Browser not initialized');
    }
    return await this.currentPage.title();
  }

  async setCookie(name: string, value: string, domain?: string): Promise<void> {
    if (!this.sessionManager || !this.currentPage) {
      throw new Error('Browser not initialized');
    }
    
    // Ensure we have a URL to set cookies against
    const currentUrl = this.currentPage.url();
    if (!currentUrl || currentUrl === 'about:blank') {
      throw new Error('Cannot set cookies without navigating to a URL first');
    }
    
    const cookies: Cookie[] = [{
      name,
      value,
      domain: domain || new URL(currentUrl).hostname,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax'
    }];
    
    await this.sessionManager.setCookies(cookies);
  }

  async getCookies(): Promise<Cookie[]> {
    if (!this.sessionManager) {
      throw new Error('Browser not initialized');
    }
    return await this.sessionManager.getCookies();
  }

  async newPage(): Promise<PageNavigator> {
    const page = await this.browserManager.newPage();
    return new PageNavigator(page);
  }

  async cleanup(): Promise<void> {
    await this.browserManager.close();
    this.currentPage = null;
    this.pageNavigator = null;
    this.sessionManager = null;
  }

  // Convenience methods
  async getText(selector: string): Promise<string | null> {
    if (!this.pageNavigator) {
      throw new Error('Browser not initialized');
    }
    return await this.pageNavigator.getElementText(selector);
  }

  async click(selector: string): Promise<void> {
    if (!this.pageNavigator) {
      throw new Error('Browser not initialized');
    }
    await this.pageNavigator.click(selector);
  }

  async waitForSelector(selector: string, timeout?: number): Promise<void> {
    if (!this.pageNavigator) {
      throw new Error('Browser not initialized');
    }
    await this.pageNavigator.waitForSelector(selector, timeout);
  }
} 