import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../src/browser-manager';
import { SessionManager } from '../src/session-manager';

describe('Session Manager', () => {
  let browserManager: BrowserManager;
  let sessionManager: SessionManager;

  beforeEach(async () => {
    browserManager = new BrowserManager();
    await browserManager.initialize();
    const page = await browserManager.newPage();
    sessionManager = new SessionManager(page);
  });

  afterEach(async () => {
    await browserManager.close();
  });

  it('should save and restore cookies', async () => {
    const cookies = [{ name: 'test', value: 'value', domain: 'example.com', path: '/' }];
    await sessionManager.setCookies(cookies);
    const savedCookies = await sessionManager.getCookies();
    expect(savedCookies).toContainEqual(expect.objectContaining({ name: 'test', value: 'value' }));
  });

  it('should manage local storage', async () => {
    await sessionManager.goto('https://example.com');
    await sessionManager.setLocalStorage('key', 'value');
    const value = await sessionManager.getLocalStorage('key');
    expect(value).toBe('value');
  });

  it('should save session state', async () => {
    await sessionManager.goto('https://example.com');
    const state = await sessionManager.saveState();
    expect(state.url).toBe('https://example.com/');
    expect(state.cookies).toBeDefined();
  });

  it('should restore session state', async () => {
    const state = {
      url: 'https://example.com',
      cookies: [{ name: 'test', value: 'restored', domain: 'example.com', path: '/' }],
      localStorage: { key: 'value' },
      sessionStorage: {},
      timestamp: Date.now()
    };
    
    await sessionManager.restoreState(state);
    expect(sessionManager.getCurrentUrl()).toBe('https://example.com/');
  });
}); 