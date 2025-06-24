import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NewsNavigator, ArticlePreview, NavigationResult } from '../src/news-navigator';
import { BrowserIntegration } from '../src/browser-integration';
import { ConfigManager } from '../src/config-manager';

describe('NewsNavigator', () => {
  let newsNavigator: NewsNavigator;
  let mockBrowser: BrowserIntegration;
  let mockConfigManager: ConfigManager;

  beforeEach(() => {
    mockBrowser = {
      navigateToUrl: vi.fn(),
      waitForSelector: vi.fn(),
      getText: vi.fn(),
      click: vi.fn(),
      getPageTitle: vi.fn(),
      initialize: vi.fn(),
      cleanup: vi.fn()
    } as any;

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        sites: {
          'test-site': {
            name: 'Test Site',
            baseUrl: 'https://test.com',
            selectors: {
              title: 'h1',
              content: '.content',
              author: '.author',
              publishDate: '.date'
            },
            urlPatterns: ['/news/*'],
            waitOptions: { timeout: 30000 }
          }
        },
        output: { format: 'json', directory: './results' },
        browser: { headless: true, timeout: 30000 }
      })
    } as any;

    newsNavigator = new NewsNavigator(mockBrowser, mockConfigManager);
  });

  describe('Basic Navigation', () => {
    it('should navigate to news site main page', async () => {
      mockBrowser.navigateToUrl = vi.fn().mockResolvedValue(undefined);
      
      const result = await newsNavigator.navigateToSite('test-site');
      
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://test.com');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(mockBrowser.navigateToUrl).toHaveBeenCalledWith('https://test.com');
    });

    it('should handle invalid site configuration', async () => {
      const result = await newsNavigator.navigateToSite('invalid-site');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Site configuration not found');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle navigation errors gracefully', async () => {
      mockBrowser.navigateToUrl = vi.fn().mockRejectedValue(new Error('Navigation failed'));
      
      const result = await newsNavigator.navigateToSite('test-site');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigation failed');
    });
  });

  describe('Article Navigation', () => {
    it('should navigate to specific article page', async () => {
      const articleUrl = 'https://test.com/article1';
      mockBrowser.navigateToUrl = vi.fn().mockResolvedValue(undefined);
      
      const result = await newsNavigator.navigateToArticle(articleUrl);
      
      expect(result.success).toBe(true);
      expect(result.url).toBe(articleUrl);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(mockBrowser.navigateToUrl).toHaveBeenCalledWith(articleUrl);
    });

    it('should handle article navigation errors', async () => {
      const articleUrl = 'https://test.com/article1';
      mockBrowser.navigateToUrl = vi.fn().mockRejectedValue(new Error('Page not found'));
      
      const result = await newsNavigator.navigateToArticle(articleUrl);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Page not found');
    });
  });

  describe('Article Preview Extraction', () => {
    it('should extract basic article information', async () => {
      mockBrowser.waitForSelector = vi.fn().mockResolvedValue(undefined);
      mockBrowser.getText = vi.fn()
        .mockResolvedValueOnce('Test Article Title')
        .mockResolvedValueOnce('Test excerpt')
        .mockResolvedValueOnce('2024-01-01');
      
      const preview = await newsNavigator.extractArticleInfo('test-site');
      
      expect(preview.title).toBe('Test Article Title');
      expect(preview.excerpt).toBe('Test excerpt'); 
      expect(preview.publishDate).toBe('2024-01-01');
      expect(mockBrowser.waitForSelector).toHaveBeenCalledWith('h1');
    });

    it('should handle extraction errors gracefully', async () => {
      mockBrowser.waitForSelector = vi.fn().mockResolvedValue(undefined);
      mockBrowser.getText = vi.fn().mockRejectedValue(new Error('Selector not found'));
      
      const preview = await newsNavigator.extractArticleInfo('test-site');
      
      expect(preview.title).toBeUndefined();
      expect(preview.excerpt).toBeUndefined();
      expect(preview.publishDate).toBeUndefined();
    });
  });
}); 