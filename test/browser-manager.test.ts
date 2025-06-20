import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../src/browser-manager';

describe('Browser Manager', () => {
  let browserManager: BrowserManager;

  beforeEach(() => {
    browserManager = new BrowserManager();
  });

  afterEach(async () => {
    await browserManager.close();
  });

  it('should initialize browser instance', async () => {
    await browserManager.initialize();
    expect(browserManager.isInitialized()).toBe(true);
  });

  it('should support headless and headful modes', async () => {
    await browserManager.initialize({ headless: false });
    expect(browserManager.getOptions().headless).toBe(false);
  });

  it('should create new page', async () => {
    await browserManager.initialize();
    const page = await browserManager.newPage();
    expect(page).toBeDefined();
  });

  it('should handle browser errors gracefully', async () => {
    await expect(browserManager.newPage()).rejects.toThrow('Browser not initialized');
  });
}); 