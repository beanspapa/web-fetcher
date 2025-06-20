import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../src/browser-manager';
import { PageNavigator } from '../src/page-navigator';

describe('Page Navigator', () => {
  let browserManager: BrowserManager;
  let pageNavigator: PageNavigator;

  beforeEach(async () => {
    browserManager = new BrowserManager();
    await browserManager.initialize();
    const page = await browserManager.newPage();
    pageNavigator = new PageNavigator(page);
  });

  afterEach(async () => {
    await browserManager.close();
  });

  it('should navigate to URL', async () => {
    await pageNavigator.goto('https://example.com');
    expect(pageNavigator.getCurrentUrl()).toBe('https://example.com/');
  });

  it('should wait for page load', async () => {
    await pageNavigator.goto('https://example.com', { waitUntil: 'load' });
    expect(await pageNavigator.isPageLoaded()).toBe(true);
  });

  it('should handle navigation timeout', async () => {
    await expect(
      pageNavigator.goto('https://invalid-url-that-does-not-exist.com', { timeout: 1000 })
    ).rejects.toThrow('Navigation timeout');
  });

  it('should wait for specific elements', async () => {
    await pageNavigator.goto('https://example.com');
    await pageNavigator.waitForSelector('h1');
    const title = await pageNavigator.getElementText('h1');
    expect(title).toBeDefined();
  });
}); 