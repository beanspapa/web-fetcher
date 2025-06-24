import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NewsNavigator, ArticlePreview } from '../src/news-navigator';
import { BrowserIntegration } from '../src/browser-integration';
import { ConfigManager } from '../src/config-manager';

describe('Dynamic Content Loading', () => {
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
      cleanup: vi.fn(),
      // 추가로 필요한 mock 메소드들 (가상)
      scrollToElement: vi.fn(),
      waitForNewContent: vi.fn(),
      waitForNetworkIdle: vi.fn(),
      countElements: vi.fn()
    } as any;

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        sites: {
          'dynamic-site': {
            name: 'Dynamic Site',
            baseUrl: 'https://dynamic.com',
            selectors: {
              title: 'h1',
              content: '.content',
              author: '.author',
              publishDate: '.date',
              loadMoreButton: '.load-more',
              articleList: '.articles',
              infiniteScrollTrigger: '.scroll-trigger'
            },
            urlPatterns: ['/news/*'],
            waitOptions: { timeout: 30000 },
            dynamicLoading: {
              type: 'infinite-scroll',
              maxScrolls: 5,
              scrollDelay: 1000,
              newContentSelector: '.new-articles'
            }
          }
        },
        output: { format: 'json', directory: './results' },
        browser: { headless: true, timeout: 30000 }
      })
    } as any;

    newsNavigator = new NewsNavigator(mockBrowser, mockConfigManager);
  });

  describe('Infinite Scroll Loading', () => {
    it('should handle infinite scroll loading', async () => {
      // Mock scroll behavior
      mockBrowser.scrollToElement = vi.fn().mockResolvedValue(true);
      mockBrowser.waitForNewContent = vi.fn()
        .mockResolvedValueOnce(3) // 첫 번째 스크롤로 3개 추가
        .mockResolvedValueOnce(2) // 두 번째 스크롤로 2개 추가
        .mockResolvedValueOnce(0); // 더 이상 없음
      
      const result = await newsNavigator.loadMoreArticles('dynamic-site', { 
        maxScrolls: 3,
        scrollDelay: 500
      });
      
      expect(result.success).toBe(true);
      expect(result.newArticlesCount).toBe(5);
      expect(result.totalScrolls).toBe(3); // 3번째 스크롤에서 0개 확인 후 중단
      expect(mockBrowser.scrollToElement).toHaveBeenCalledTimes(3);
    });

    it('should stop scrolling when no new content is found', async () => {
      mockBrowser.scrollToElement = vi.fn().mockResolvedValue(true);
      mockBrowser.waitForNewContent = vi.fn().mockResolvedValue(0);
      
      const result = await newsNavigator.loadMoreArticles('dynamic-site', { maxScrolls: 5 });
      
      expect(result.success).toBe(true);
      expect(result.newArticlesCount).toBe(0);
      expect(result.totalScrolls).toBe(1);
      expect(mockBrowser.scrollToElement).toHaveBeenCalledTimes(1);
    });

    it('should handle scroll errors gracefully', async () => {
      mockBrowser.scrollToElement = vi.fn().mockRejectedValue(new Error('Scroll failed'));
      
      const result = await newsNavigator.loadMoreArticles('dynamic-site');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Scroll failed');
    });
  });

  describe('AJAX Content Loading', () => {
    it('should wait for AJAX content to load', async () => {
      mockBrowser.waitForNetworkIdle = vi.fn().mockResolvedValue(true);
      mockBrowser.waitForSelector = vi.fn().mockResolvedValue(undefined);
      
      const result = await newsNavigator.waitForDynamicContent('dynamic-site', {
        waitForNetwork: true,
        timeout: 10000
      });
      
      expect(result.success).toBe(true);
      expect(mockBrowser.waitForNetworkIdle).toHaveBeenCalledWith(10000);
    });

    it('should handle AJAX loading timeout', async () => {
      mockBrowser.waitForNetworkIdle = vi.fn().mockRejectedValue(new Error('Network timeout'));
      
      const result = await newsNavigator.waitForDynamicContent('dynamic-site', {
        waitForNetwork: true,
        timeout: 5000
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });

  describe('Load More Button', () => {
    it('should click load more button and wait for new content', async () => {
      mockBrowser.click = vi.fn().mockResolvedValue(undefined);
      mockBrowser.waitForSelector = vi.fn().mockResolvedValue(undefined);
      mockBrowser.countElements = vi.fn()
        .mockResolvedValueOnce(10) // 클릭 전
        .mockResolvedValueOnce(15); // 클릭 후
      
      const result = await newsNavigator.clickLoadMore('dynamic-site');
      
      expect(result.success).toBe(true);
      expect(result.newArticlesCount).toBe(5);
      expect(mockBrowser.click).toHaveBeenCalledWith('.load-more');
    });

    it('should handle missing load more button', async () => {
      mockBrowser.click = vi.fn().mockRejectedValue(new Error('Element not found'));
      
      const result = await newsNavigator.clickLoadMore('dynamic-site');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
    });
  });

  describe('Mixed Dynamic Loading', () => {
    it('should combine multiple loading strategies', async () => {
      // Setup mocks for combined approach
      mockBrowser.click = vi.fn().mockResolvedValue(undefined);
      mockBrowser.scrollToElement = vi.fn().mockResolvedValue(true);
      mockBrowser.waitForNewContent = vi.fn().mockResolvedValue(3);
      mockBrowser.countElements = vi.fn()
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(13);
      
      const result = await newsNavigator.loadAllAvailableContent('dynamic-site', {
        useLoadMoreButton: true,
        useInfiniteScroll: true,
        maxOperations: 10
      });
      
      expect(result.success).toBe(true);
      expect(result.totalArticlesLoaded).toBeGreaterThan(0);
      expect(result.operationsPerformed).toBeGreaterThan(0);
    });

    it('should respect max operations limit', async () => {
      mockBrowser.click = vi.fn().mockResolvedValue(undefined);
      mockBrowser.countElements = vi.fn()
        .mockResolvedValue(10); // 항상 같은 수 (무한 루프 방지 테스트)
      
      const result = await newsNavigator.loadAllAvailableContent('dynamic-site', {
        useLoadMoreButton: true,
        maxOperations: 3
      });
      
      expect(result.success).toBe(true);
      expect(result.operationsPerformed).toBeLessThanOrEqual(3);
    });
  });

  describe('Progress Tracking', () => {
    it('should track loading progress with callback', async () => {
      const progressCallback = vi.fn();
      
      mockBrowser.scrollToElement = vi.fn().mockResolvedValue(true);
      mockBrowser.waitForNewContent = vi.fn()
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(0);
      
      await newsNavigator.loadMoreArticles('dynamic-site', {
        maxScrolls: 3,
        onProgress: progressCallback
      });
      
      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        currentScroll: 1,
        totalScrolls: 3,
        newArticles: 5,
        totalNewArticles: 5
      });
    });
  });
}); 