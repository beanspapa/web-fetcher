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