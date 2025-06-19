# Phase 4: 브라우저 관리 모듈 (playwright-ghost) - 상세 작업 리스트

**목표**: playwright-ghost를 활용한 헤드리스 브라우저 자동화 시스템 구축
**예상 소요 시간**: 3-4시간

---

## Task 4.1: playwright-ghost 설치 및 기본 설정
**목표**: playwright-ghost 패키지 설치 및 BrowserManager 클래스 구현

### 실행 단계:

#### 1. playwright-ghost 패키지 설치
```bash
npm install playwright-ghost
npm install --save-dev @types/playwright
```
- **성공 기준**: package.json dependencies에 playwright-ghost 추가
- **실패 시**: npm 캐시 클리어 후 재시도

#### 2. RED: 브라우저 초기화 테스트 작성
- **파일**: `test/browser-manager.test.ts`
- **내용**:
```typescript
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
```

#### 3. GREEN: BrowserManager 클래스 구현
- **파일**: `src/browser-manager.ts`
- **내용**:
```typescript
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

  async initialize(): Promise<void> {
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
```

#### 4. REFACTOR: 브라우저 옵션 및 에러 처리 개선
- JSDoc 문서화 추가
- 브라우저 엔진별 최적화
- 리소스 정리 강화

**완료 조건**: 브라우저 초기화 테스트 통과, BrowserManager 클래스 구현 완료
**다음 단계**: Task 4.2
**실패 시 복구**: playwright-ghost 재설치 후 테스트 재실행

---

## Task 4.2: 페이지 네비게이션 기능 테스트
**목표**: PageNavigator 클래스로 페이지 로딩 및 네비게이션 제어

### 실행 단계:

#### 1. RED: 페이지 로딩 테스트 작성
- **파일**: `test/page-navigator.test.ts`
- **내용**:
```typescript
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
```

#### 2. GREEN: PageNavigator 클래스 구현
- **파일**: `src/page-navigator.ts`
- **내용**:
```typescript
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
```

#### 3. REFACTOR: 네비게이션 옵션 및 대기 조건 최적화
- 스마트 대기 로직
- 에러 복구 메커니즘
- 성능 최적화

**완료 조건**: 페이지 네비게이션 테스트 통과, PageNavigator 클래스 구현 완료
**다음 단계**: Task 4.3
**실패 시 복구**: 네비게이션 로직 재검토 후 재구현

---

## Task 4.3: 브라우저 세션 관리 테스트
**목표**: SessionManager 클래스로 쿠키, 스토리지, 세션 상태 관리

### 실행 단계:

#### 1. RED: 세션 관리 테스트 작성
- **파일**: `test/session-manager.test.ts`
- **내용**:
```typescript
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
    const cookies = [{ name: 'test', value: 'value', domain: 'example.com' }];
    await sessionManager.setCookies(cookies);
    const savedCookies = await sessionManager.getCookies();
    expect(savedCookies).toContainEqual(expect.objectContaining({ name: 'test', value: 'value' }));
  });

  it('should manage local storage', async () => {
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
      cookies: [{ name: 'test', value: 'restored', domain: 'example.com' }],
      localStorage: { key: 'value' }
    };
    
    await sessionManager.restoreState(state);
    expect(sessionManager.getCurrentUrl()).toBe('https://example.com/');
  });
});
```

#### 2. GREEN: SessionManager 클래스 구현
- **파일**: `src/session-manager.ts`
- **내용**:
```typescript
import { Page, Cookie } from 'playwright';

export interface SessionState {
  url: string;
  cookies: Cookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  timestamp: number;
}

export class SessionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export class SessionManager {
  constructor(private page: Page) {}

  async setCookies(cookies: Cookie[]): Promise<void> {
    try {
      await this.page.context().addCookies(cookies);
    } catch (error) {
      throw new SessionError(`Failed to set cookies: ${error}`, 'COOKIE_SET_FAILED');
    }
  }

  async getCookies(): Promise<Cookie[]> {
    try {
      return await this.page.context().cookies();
    } catch (error) {
      throw new SessionError(`Failed to get cookies: ${error}`, 'COOKIE_GET_FAILED');
    }
  }

  async clearCookies(): Promise<void> {
    try {
      await this.page.context().clearCookies();
    } catch (error) {
      throw new SessionError(`Failed to clear cookies: ${error}`, 'COOKIE_CLEAR_FAILED');
    }
  }

  async setLocalStorage(key: string, value: string): Promise<void> {
    try {
      await this.page.evaluate(({ key, value }) => {
        localStorage.setItem(key, value);
      }, { key, value });
    } catch (error) {
      throw new SessionError(`Failed to set localStorage: ${error}`, 'LOCALSTORAGE_SET_FAILED');
    }
  }

  async getLocalStorage(key: string): Promise<string | null> {
    try {
      return await this.page.evaluate((key) => {
        return localStorage.getItem(key);
      }, key);
    } catch (error) {
      throw new SessionError(`Failed to get localStorage: ${error}`, 'LOCALSTORAGE_GET_FAILED');
    }
  }

  async saveState(): Promise<SessionState> {
    try {
      const [url, cookies, localStorage, sessionStorage] = await Promise.all([
        this.page.url(),
        this.getCookies(),
        this.getAllLocalStorage(),
        this.getAllSessionStorage()
      ]);

      return {
        url,
        cookies,
        localStorage,
        sessionStorage,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new SessionError(`Failed to save state: ${error}`, 'STATE_SAVE_FAILED');
    }
  }

  async restoreState(state: SessionState): Promise<void> {
    try {
      // Restore cookies
      await this.setCookies(state.cookies);
      
      // Navigate to URL
      await this.page.goto(state.url);
      
      // Restore localStorage
      for (const [key, value] of Object.entries(state.localStorage)) {
        await this.setLocalStorage(key, value);
      }
      
      // Restore sessionStorage
      for (const [key, value] of Object.entries(state.sessionStorage)) {
        await this.setSessionStorage(key, value);
      }
    } catch (error) {
      throw new SessionError(`Failed to restore state: ${error}`, 'STATE_RESTORE_FAILED');
    }
  }

  getCurrentUrl(): string {
    return this.page.url();
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  private async getAllLocalStorage(): Promise<Record<string, string>> {
    return await this.page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          storage[key] = localStorage.getItem(key) || '';
        }
      }
      return storage;
    });
  }

  private async getAllSessionStorage(): Promise<Record<string, string>> {
    return await this.page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          storage[key] = sessionStorage.getItem(key) || '';
        }
      }
      return storage;
    });
  }

  private async setSessionStorage(key: string, value: string): Promise<void> {
    await this.page.evaluate(({ key, value }) => {
      sessionStorage.setItem(key, value);
    }, { key, value });
  }
}
```

#### 3. REFACTOR: 리소스 정리 및 메모리 관리 개선
- 메모리 누수 방지
- 세션 만료 처리
- 상태 압축 및 최적화

**완료 조건**: 세션 관리 테스트 통과, SessionManager 클래스 구현 완료
**다음 단계**: Task 4.4
**실패 시 복구**: 세션 관리 로직 재검토 후 재구현

---

## Task 4.4: 브라우저 통합 모듈 테스트
**목표**: 모든 브라우저 모듈을 통합하고 인터페이스 표준화

### 실행 단계:

#### 1. RED: 통합 테스트 작성
- **파일**: `test/browser-integration.test.ts`
- **내용**:
```typescript
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
    await browserIntegration.setCookie('test', 'value');
    await browserIntegration.navigateToUrl('https://example.com');
    
    const cookies = await browserIntegration.getCookies();
    expect(cookies.some(c => c.name === 'test')).toBe(true);
  });

  it('should handle multiple pages', async () => {
    const page1 = await browserIntegration.newPage();
    const page2 = await browserIntegration.newPage();
    
    await page1.goto('https://example.com');
    await page2.goto('https://google.com');
    
    expect(page1.url()).toContain('example.com');
    expect(page2.url()).toContain('google.com');
  });
});
```

#### 2. GREEN: 브라우저 통합 모듈 구현
- **파일**: `src/browser-integration.ts`
- **내용**:
```typescript
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
    if (!this.sessionManager) {
      throw new Error('Browser not initialized');
    }
    
    const cookies: Cookie[] = [{
      name,
      value,
      domain: domain || new URL(this.currentPage!.url()).hostname,
      path: '/'
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
```

#### 3. REFACTOR: 인터페이스 표준화 및 문서화
- 통합 API 문서화
- 에러 처리 표준화
- 성능 최적화

**완료 조건**: 모든 브라우저 통합 테스트 통과, 표준화된 API 완성
**다음 단계**: Phase 5
**실패 시 복구**: 모듈 통합 로직 재검토 후 재구현

---

## 에러 처리 및 복구 전략

### 일반적인 에러 상황
1. **브라우저 초기화 실패**
   - playwright 의존성 재설치
   - 시스템 브라우저 확인
   - 권한 문제 해결

2. **페이지 로딩 실패**
   - 네트워크 연결 확인
   - 타임아웃 설정 조정
   - 프록시 설정 확인

3. **메모리 부족**
   - 브라우저 인스턴스 정리
   - 페이지 수 제한
   - 가비지 컬렉션 강제 실행

### 복구 체크포인트
- 각 Task 완료 시 Git 커밋
- 브라우저 리소스 정리 확인
- 테스트 격리 상태 유지

---

**Phase 4 완료 조건**:
- ✅ playwright-ghost 설치 및 설정 완료
- ✅ 모든 브라우저 관련 테스트 통과
- ✅ BrowserManager, PageNavigator, SessionManager 클래스 구현
- ✅ 브라우저 모듈 통합 및 인터페이스 표준화

**다음 단계**: Phase 5 - 뉴스 페이지 네비게이션 모듈 