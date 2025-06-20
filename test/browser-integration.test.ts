import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserIntegration } from '../src/browser-integration';

describe('Browser Integration', () => {
  let browserIntegration: BrowserIntegration;

  beforeEach(async () => {
    browserIntegration = new BrowserIntegration();
    await browserIntegration.initialize();
  });

  afterEach(async () => {
    await browserIntegration.cleanup();
  });

  it('should integrate all browser modules', async () => {
    await browserIntegration.navigateToUrl('https://example.com');
    await browserIntegration.waitForPageLoad();
    
    const title = await browserIntegration.getPageTitle();
    expect(title).toBeDefined();
  });

  it('should manage session across navigation', async () => {
    await browserIntegration.navigateToUrl('https://example.com');
    await browserIntegration.setCookie('test', 'value');
    
    const cookies = await browserIntegration.getCookies();
    expect(cookies.some(c => c.name === 'test')).toBe(true);
  });

  it('should handle multiple pages', async () => {
    const page1 = await browserIntegration.newPage();
    const page2 = await browserIntegration.newPage();
    
    await page1.goto('https://example.com');
    await page2.goto('https://google.com');
    
    expect(page1.getCurrentUrl()).toContain('example.com');
    expect(page2.getCurrentUrl()).toContain('google.com');
  });

  it('should provide convenience methods', async () => {
    await browserIntegration.navigateToUrl('https://example.com');
    await browserIntegration.waitForSelector('h1');
    
    const text = await browserIntegration.getText('h1');
    expect(text).toBeDefined();
  });
}); 