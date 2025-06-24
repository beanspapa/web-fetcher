import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NewsNavigator, PaginationResult, PaginationOptions, PaginationInfo, MultiPageCollectionResult } from '../src/news-navigator';
import { BrowserIntegration } from '../src/browser-integration';
import { ConfigManager } from '../src/config-manager';

describe('Pagination Navigation', () => {
  let newsNavigator: NewsNavigator;
  let mockBrowser: any;
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
      waitForPageLoad: vi.fn(),
      // 페이지네이션 관련 Mock 메소드들
      findPaginationControls: vi.fn(),
      getCurrentPageNumber: vi.fn(),
      getTotalPages: vi.fn(),
      clickNextPage: vi.fn(),
      clickPreviousPage: vi.fn(),
      clickPageNumber: vi.fn()
    } as any;

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        sites: {
          'paginated-site': {
            name: 'Paginated News Site',
            baseUrl: 'https://paginated-news.com',
            selectors: {
              title: 'h1',
              content: '.content',
              author: '.author',
              publishDate: '.date',
              articleList: '.articles',
              // 페이지네이션 선택자들
              pagination: '.pagination',
              nextButton: '.pagination .next',
              prevButton: '.pagination .prev',
              pageNumbers: '.pagination .page-number',
              currentPage: '.pagination .current',
              totalPages: '.pagination .total-pages'
            },
            urlPatterns: ['/news/*'],
            waitOptions: { timeout: 30000 },
            pagination: {
              type: 'numbered',
              maxPages: 10,
              pageSize: 15,
              urlPattern: '/news/page/{page}',
              autoDetect: true
            }
          }
        },
        output: { format: 'json', directory: './results' },
        browser: { headless: true, timeout: 30000 }
      })
    } as any;

    newsNavigator = new NewsNavigator(mockBrowser, mockConfigManager);
  });

  describe('Pagination Detection', () => {
    it('should detect pagination controls on page', async () => {
      mockBrowser.findPaginationControls = vi.fn().mockResolvedValue({
        hasPagination: true,
        type: 'numbered',
        currentPage: 1,
        totalPages: 5,
        hasNext: true,
        hasPrevious: false
      });

      const paginationInfo = await newsNavigator.detectPagination('paginated-site');

      expect(paginationInfo.hasPagination).toBe(true);
      expect(paginationInfo.type).toBe('numbered');
      expect(paginationInfo.currentPage).toBe(1);
      expect(paginationInfo.totalPages).toBe(5);
      expect(mockBrowser.findPaginationControls).toHaveBeenCalled();
    });

    it('should handle sites without pagination', async () => {
      mockBrowser.findPaginationControls = vi.fn().mockResolvedValue({
        hasPagination: false,
        type: 'none'
      });

      const paginationInfo = await newsNavigator.detectPagination('paginated-site');

      expect(paginationInfo.hasPagination).toBe(false);
      expect(paginationInfo.type).toBe('none');
    });

    it('should auto-detect different pagination types', async () => {
      const testCases = [
        { type: 'numbered', expected: 'numbered' },
        { type: 'next-prev', expected: 'next-prev' },
        { type: 'load-more', expected: 'load-more' }
      ];

      for (const testCase of testCases) {
        mockBrowser.findPaginationControls = vi.fn().mockResolvedValue({
          hasPagination: true,
          type: testCase.type
        });

        const result = await newsNavigator.detectPagination('paginated-site');
        expect(result.type).toBe(testCase.expected);
      }
    });
  });

  describe('Page Navigation', () => {
    it('should navigate to next page', async () => {
      mockBrowser.clickNextPage = vi.fn().mockResolvedValue(true);
      mockBrowser.waitForPageLoad = vi.fn().mockResolvedValue(true);
      mockBrowser.getCurrentPageNumber = vi.fn()
        .mockResolvedValueOnce(1) // 클릭 전
        .mockResolvedValueOnce(2); // 클릭 후

      const result = await newsNavigator.navigateToNextPage('paginated-site');

      expect(result.success).toBe(true);
      expect(result.currentPage).toBe(2);
      expect(result.previousPage).toBe(1);
      expect(mockBrowser.clickNextPage).toHaveBeenCalled();
      expect(mockBrowser.waitForPageLoad).toHaveBeenCalled();
    });

    it('should navigate to previous page', async () => {
      mockBrowser.clickPreviousPage = vi.fn().mockResolvedValue(true);
      mockBrowser.waitForPageLoad = vi.fn().mockResolvedValue(true);
      mockBrowser.getCurrentPageNumber = vi.fn()
        .mockResolvedValueOnce(3) // 클릭 전
        .mockResolvedValueOnce(2); // 클릭 후

      const result = await newsNavigator.navigateToPreviousPage('paginated-site');

      expect(result.success).toBe(true);
      expect(result.currentPage).toBe(2);
      expect(result.previousPage).toBe(3);
      expect(mockBrowser.clickPreviousPage).toHaveBeenCalled();
    });

    it('should navigate to specific page number', async () => {
      const targetPage = 5;
      mockBrowser.clickPageNumber = vi.fn().mockResolvedValue(true);
      mockBrowser.waitForPageLoad = vi.fn().mockResolvedValue(true);
      mockBrowser.getCurrentPageNumber = vi.fn()
        .mockResolvedValueOnce(1) // 현재 페이지
        .mockResolvedValueOnce(targetPage); // 이동 후

      const result = await newsNavigator.navigateToPage('paginated-site', targetPage);

      expect(result.success).toBe(true);
      expect(result.currentPage).toBe(targetPage);
      expect(mockBrowser.clickPageNumber).toHaveBeenCalledWith(targetPage);
    });

    it('should handle navigation to invalid page numbers', async () => {
      mockBrowser.getTotalPages = vi.fn().mockResolvedValue(5);
      
      const result = await newsNavigator.navigateToPage('paginated-site', 10); // 존재하지 않는 페이지

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid page number');
    });
  });

  describe('Multi-Page Collection', () => {
    it('should collect articles from multiple pages', async () => {
      // 3페이지에 걸쳐 기사 수집 시뮬레이션
      mockBrowser.findPaginationControls = vi.fn().mockResolvedValue({
        hasPagination: true,
        totalPages: 3,
        currentPage: 1
      });

      mockBrowser.clickNextPage = vi.fn().mockResolvedValue(true);
      mockBrowser.waitForPageLoad = vi.fn().mockResolvedValue(true);
      mockBrowser.getCurrentPageNumber = vi.fn()
        .mockResolvedValueOnce(1) // 시작
        .mockResolvedValueOnce(2) // 첫 번째 다음 페이지
        .mockResolvedValueOnce(3); // 두 번째 다음 페이지

      // 각 페이지별 기사 수 Mock
      const extractArticlesSpy = vi.spyOn(newsNavigator, 'extractArticleInfo')
        .mockResolvedValueOnce({ title: 'Article 1', url: 'url1' }) // 페이지 1
        .mockResolvedValueOnce({ title: 'Article 2', url: 'url2' }) // 페이지 2  
        .mockResolvedValueOnce({ title: 'Article 3', url: 'url3' }); // 페이지 3

      const result = await newsNavigator.collectArticlesFromPages('paginated-site', {
        maxPages: 3,
        startPage: 1
      });

      expect(result.success).toBe(true);
      expect(result.totalPages).toBe(3);
      expect(result.articlesCollected).toBe(3);
      expect(mockBrowser.clickNextPage).toHaveBeenCalledTimes(2); // 2번 다음 페이지 클릭
    });

    it('should stop collection when reaching max pages limit', async () => {
      mockBrowser.findPaginationControls = vi.fn().mockResolvedValue({
        hasPagination: true,
        totalPages: 10,
        currentPage: 1
      });

      const result = await newsNavigator.collectArticlesFromPages('paginated-site', {
        maxPages: 3 // 최대 3페이지만 수집
      });

      expect(result.totalPages).toBeLessThanOrEqual(3);
    });

    it('should handle pagination errors gracefully', async () => {
      mockBrowser.clickNextPage = vi.fn().mockRejectedValue(new Error('Next page not found'));

      const result = await newsNavigator.navigateToNextPage('paginated-site');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Next page not found');
    });
  });

  describe('Progress Tracking', () => {
    it('should track pagination progress with callback', async () => {
      const progressCallback = vi.fn();

      mockBrowser.findPaginationControls = vi.fn().mockResolvedValue({
        hasPagination: true,
        totalPages: 3,
        currentPage: 1
      });

      await newsNavigator.collectArticlesFromPages('paginated-site', {
        maxPages: 3,
        onProgress: progressCallback
      });

      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        currentPage: 1,
        totalPages: 3,
        articlesOnPage: expect.any(Number),
        totalArticles: expect.any(Number)
      });
    });
  });

  describe('URL-based Pagination', () => {
    it('should handle URL pattern-based pagination', async () => {
      const result = await newsNavigator.navigateToPageByUrl('paginated-site', 3);

      expect(result.success).toBe(true);
      expect(mockBrowser.navigateToUrl).toHaveBeenCalledWith('https://paginated-news.com/news/page/3');
    });

    it('should validate URL patterns', async () => {
      // 잘못된 페이지 번호로 URL 생성 시도
      const result = await newsNavigator.navigateToPageByUrl('paginated-site', -1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid page number');
    });
  });
}); 