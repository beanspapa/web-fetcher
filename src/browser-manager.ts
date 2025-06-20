import { Browser, Page, chromium, firefox, webkit } from 'playwright';

export interface BrowserOptions {
  engine?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  timeout?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
}

export class BrowserError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'BrowserError';
  }
}

export class BrowserManager {
  private browser: Browser | null = null;
  private options: BrowserOptions;

  constructor(options: BrowserOptions = {}) {
    this.options = {
      engine: 'chromium',
      headless: true,
      timeout: 30000,
      viewport: { width: 1280, height: 720 },
      ...options
    };
  }

  async initialize(options?: BrowserOptions): Promise<void> {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    try {
      const browserEngine = this.getBrowserEngine();
      this.browser = await browserEngine.launch({
        headless: this.options.headless,
        timeout: this.options.timeout
      });
    } catch (error) {
      throw new BrowserError(`Failed to initialize browser: ${error}`, 'INIT_FAILED');
    }
  }

  async newPage(): Promise<Page> {
    if (!this.browser) {
      throw new BrowserError('Browser not initialized', 'NOT_INITIALIZED');
    }

    const page = await this.browser.newPage();
    
    if (this.options.viewport) {
      await page.setViewportSize(this.options.viewport);
    }
    
    if (this.options.userAgent) {
      await page.setExtraHTTPHeaders({ 'User-Agent': this.options.userAgent });
    }

    return page;
  }

  isInitialized(): boolean {
    return this.browser !== null;
  }

  getOptions(): BrowserOptions {
    return { ...this.options };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private getBrowserEngine() {
    switch (this.options.engine) {
      case 'firefox': return firefox;
      case 'webkit': return webkit;
      case 'chromium':
      default: return chromium;
    }
  }
} 