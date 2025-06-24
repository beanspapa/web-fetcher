import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NewsNavigator } from '../src/news-navigator.js';
import { BrowserIntegration } from '../src/browser-integration.js';
import { ConfigManager } from '../src/config-manager.js';

/**
 * 카테고리 네비게이션 테스트
 * 실제 뉴스 사이트 분석 결과를 바탕으로 한 포괄적 테스트
 * 
 * 테스트 범위:
 * 1. 계층적 카테고리 감지 및 탐색 (15개 테스트)
 * 2. 동적 카테고리 로딩 및 필터링 (12개 테스트)
 * 3. 카테고리 조합 및 검색 (10개 테스트)
 * 4. 모바일 반응형 카테고리 (8개 테스트)
 * 총 45개 테스트
 */
describe('NewsNavigator - 카테고리 네비게이션', () => {
  let navigator: NewsNavigator;
  let mockBrowser: any;
  let mockConfig: any;

  beforeEach(() => {
    // Mock BrowserIntegration
    mockBrowser = {
      // 기본 네비게이션
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue({}),
      click: vi.fn().mockResolvedValue(undefined),
      
      // 카테고리 감지
      findElements: vi.fn().mockResolvedValue([]),
      getElementText: vi.fn().mockResolvedValue(''),
      getElementAttribute: vi.fn().mockResolvedValue(''),
      
      // 동적 로딩
      waitForNewContent: vi.fn().mockResolvedValue(5),
      scrollToBottom: vi.fn().mockResolvedValue(undefined),
      
      // 모바일 지원
      setViewport: vi.fn().mockResolvedValue(undefined),
      isMobile: vi.fn().mockReturnValue(false),
    };

    // Mock ConfigManager
    mockConfig = {
      getNewsConfig: vi.fn().mockReturnValue({
        selectors: {
          // 기본 선택자
          articleList: '.article-list',
          articleItem: '.article-item',
          articleLink: '.article-link',
          
          // 카테고리 선택자
          categoryMenu: '.category-menu',
          categoryItem: '.category-item',
          categoryLink: '.category-link',
          subCategoryMenu: '.sub-category-menu',
          subCategoryItem: '.sub-category-item',
          
          // 계층적 카테고리
          mainCategories: '.main-categories',
          subCategories: '.sub-categories',
          categoryBreadcrumb: '.category-breadcrumb',
          
          // 동적 카테고리
          categoryFilter: '.category-filter',
          categoryDropdown: '.category-dropdown',
          categorySearch: '.category-search',
          
          // 모바일 카테고리
          mobileMenuToggle: '.mobile-menu-toggle',
          mobileCategory: '.mobile-category',
          categorySlider: '.category-slider',
        },
        
        // 카테고리 설정
        categories: {
          // 메인 카테고리 구조
          main: ['정치', '경제', '사회', '국제', '문화', 'IT', '스포츠'],
          
          // 서브 카테고리 매핑
          subCategories: {
            '정치': ['대통령실', '국회/정당', '북한', '행정', '국방/외교', '정치일반'],
            '경제': ['금융', '증권', '부동산', '글로벌경제', '생활경제', '경제일반'],
            '사회': ['사건사고', '교육', '노동', '언론', '환경', '인권', '사회일반'],
            'IT': ['모바일', '인터넷', 'SNS', '컴퓨터', '게임', 'IT일반']
          },
          
          // URL 패턴
          urlPatterns: {
            '정치': '/politics',
            '경제': '/economy', 
            '사회': '/society',
            '국제': '/world',
            '문화': '/culture',
            'IT': '/tech',
            '스포츠': '/sports'
          }
        },
        
        // 네비게이션 설정
        navigation: {
          waitTimeout: 5000,
          retryAttempts: 3,
          loadDelay: 1000
        }
      })
    };

    navigator = new NewsNavigator(
      mockBrowser as BrowserIntegration,
      mockConfig as ConfigManager
    );
  });

  // ==========================================
  // 1. 계층적 카테고리 감지 및 탐색 (15개 테스트)
  // ==========================================
  
  describe('계층적 카테고리 감지', () => {
    it('should detect main categories', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '정치' }, { text: '경제' }, { text: '사회' }
      ]);

      const categories = await navigator.detectCategories();
      
      expect(categories.main).toBeDefined();
      expect(categories.main).toHaveLength(3);
      expect(categories.main[0].name).toBe('정치');
    });

    it('should detect sub-categories for main category', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '대통령실' }, { text: '국회/정당' }, { text: '북한' }
      ]);

      const subCategories = await navigator.detectSubCategories('정치');
      
      expect(subCategories).toHaveLength(3);
      expect(subCategories[0].name).toBe('대통령실');
      expect(subCategories[0].parent).toBe('정치');
    });

    it('should build category hierarchy tree', async () => {
      mockBrowser.findElements
        .mockResolvedValueOnce([{ text: '정치' }, { text: '경제' }])
        .mockResolvedValueOnce([{ text: '대통령실' }, { text: '국회/정당' }])
        .mockResolvedValueOnce([{ text: '금융' }, { text: '증권' }]);

      const hierarchy = await navigator.buildCategoryHierarchy();
      
      expect(hierarchy).toHaveProperty('정치');
      expect(hierarchy['정치'].children).toHaveLength(2);
      expect(hierarchy['정치'].children[0].name).toBe('대통령실');
    });

    it('should detect category breadcrumb path', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '홈' }, { text: '정치' }, { text: '대통령실' }
      ]);

      const breadcrumb = await navigator.detectCategoryBreadcrumb();
      
      expect(breadcrumb).toHaveLength(3);
      expect(breadcrumb[2]).toBe('대통령실');
    });

    it('should validate category structure', async () => {
      const categories = {
        main: [{ name: '정치', url: '/politics' }],
        sub: [{ name: '대통령실', parent: '정치', url: '/politics/president' }]
      };

      const isValid = await navigator.validateCategoryStructure(categories);
      
      expect(isValid).toBe(true);
    });
  });

  describe('카테고리 네비게이션', () => {
    it('should navigate to main category', async () => {
      mockBrowser.click.mockResolvedValue(undefined);
      mockBrowser.waitForSelector.mockResolvedValue({});

      const result = await navigator.navigateToCategory('정치');
      
      expect(result.success).toBe(true);
      expect(result.currentCategory).toBe('정치');
      expect(mockBrowser.click).toHaveBeenCalled();
    });

    it('should navigate to sub-category', async () => {
      mockBrowser.click.mockResolvedValue(undefined);
      mockBrowser.waitForSelector.mockResolvedValue({});

      const result = await navigator.navigateToSubCategory('정치', '대통령실');
      
      expect(result.success).toBe(true);
      expect(result.currentCategory).toBe('정치');
      expect(result.currentSubCategory).toBe('대통령실');
    });

    it('should navigate using category URL pattern', async () => {
      mockBrowser.goto.mockResolvedValue(undefined);

      const result = await navigator.navigateToCategoryByUrl('정치');
      
      expect(result.success).toBe(true);
      expect(mockBrowser.goto).toHaveBeenCalledWith(expect.stringContaining('/politics'));
    });

    it('should handle category navigation with back button', async () => {
      mockBrowser.goBack = vi.fn().mockResolvedValue(undefined);

      const result = await navigator.navigateBackFromCategory();
      
      expect(result.success).toBe(true);
      expect(mockBrowser.goBack).toHaveBeenCalled();
    });

    it('should track category navigation history', async () => {
      await navigator.navigateToCategory('정치');
      await navigator.navigateToSubCategory('정치', '대통령실');

      const history = navigator.getCategoryNavigationHistory();
      
      expect(history).toHaveLength(2);
      expect(history[1].category).toBe('정치');
      expect(history[1].subCategory).toBe('대통령실');
    });
  });

  describe('다중 카테고리 처리', () => {
    it('should collect articles from multiple categories', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '기사1' }, { text: '기사2' }
      ]);

      const categories = ['정치', '경제', '사회'];
      const result = await navigator.collectArticlesFromCategories(categories);
      
      expect(result.totalArticles).toBeGreaterThan(0);
      expect(result.categoriesProcessed).toBe(3);
    });

    it('should handle category processing with progress callback', async () => {
      const progressCallback = vi.fn();
      mockBrowser.findElements.mockResolvedValue([{ text: '기사1' }]);

      await navigator.collectArticlesFromCategories(['정치', '경제'], {
        onProgress: progressCallback
      });
      
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          current: expect.any(Number),
          total: 2
        })
      );
    });

    it('should handle category navigation errors gracefully', async () => {
      mockBrowser.click.mockRejectedValue(new Error('Category not found'));

      const result = await navigator.navigateToCategory('존재하지않는카테고리');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Category not found');
    });

    it('should detect category availability', async () => {
      mockBrowser.findElements.mockResolvedValue([{ text: '정치' }]);

      const isAvailable = await navigator.isCategoryAvailable('정치');
      
      expect(isAvailable).toBe(true);
    });

    it('should get current active category', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '정치', className: 'active' }
      ]);

      const activeCategory = await navigator.getCurrentActiveCategory();
      
      expect(activeCategory).toBe('정치');
    });
  });

  // ==========================================
  // 2. 동적 카테고리 로딩 및 필터링 (12개 테스트)
  // ==========================================
  
  describe('동적 카테고리 로딩', () => {
    it('should handle AJAX category loading', async () => {
      mockBrowser.waitForNewContent.mockResolvedValue(5);

      const result = await navigator.loadCategoryContentDynamically('정치');
      
      expect(result.success).toBe(true);
      expect(result.articlesLoaded).toBe(5);
    });

    it('should filter articles by category dynamically', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '정치 기사1' }, { text: '정치 기사2' }
      ]);

      const result = await navigator.filterArticlesByCategory('정치');
      
      expect(result.filteredArticles).toHaveLength(2);
      expect(result.category).toBe('정치');
    });

    it('should handle category dropdown selection', async () => {
      mockBrowser.click.mockResolvedValue(undefined);
      mockBrowser.waitForSelector.mockResolvedValue({});

      const result = await navigator.selectCategoryFromDropdown('경제');
      
      expect(result.success).toBe(true);
      expect(result.selectedCategory).toBe('경제');
    });

    it('should search within specific category', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '검색 결과1' }, { text: '검색 결과2' }
      ]);

      const result = await navigator.searchWithinCategory('정치', '대통령');
      
      expect(result.searchResults).toHaveLength(2);
      expect(result.category).toBe('정치');
      expect(result.query).toBe('대통령');
    });

    it('should handle infinite scroll within category', async () => {
      mockBrowser.scrollToBottom.mockResolvedValue(undefined);
      mockBrowser.waitForNewContent.mockResolvedValue(3);

      const result = await navigator.loadMoreInCategory('정치');
      
      expect(result.newArticlesLoaded).toBe(3);
      expect(result.category).toBe('정치');
    });

    it('should detect category content loading state', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { className: 'loading' }
      ]);

      const isLoading = await navigator.isCategoryContentLoading();
      
      expect(isLoading).toBe(true);
    });

    it('should handle category content refresh', async () => {
      mockBrowser.reload = vi.fn().mockResolvedValue(undefined);
      mockBrowser.waitForSelector.mockResolvedValue({});

      const result = await navigator.refreshCategoryContent('정치');
      
      expect(result.success).toBe(true);
      expect(mockBrowser.reload).toHaveBeenCalled();
    });

    it('should cache category content', async () => {
      mockBrowser.findElements.mockResolvedValue([{ text: '기사1' }]);

      // 첫 번째 로드
      await navigator.loadCategoryContent('정치', { useCache: true });
      
      // 두 번째 로드 (캐시 사용)
      const result = await navigator.loadCategoryContent('정치', { useCache: true });
      
      expect(result.fromCache).toBe(true);
    });

    it('should clear category cache', async () => {
      await navigator.loadCategoryContent('정치', { useCache: true });
      
      navigator.clearCategoryCache('정치');
      
      const cacheSize = navigator.getCategoryCacheSize();
      expect(cacheSize).toBe(0);
    });

    it('should handle category loading timeout', async () => {
      mockBrowser.waitForNewContent.mockRejectedValue(new Error('Timeout'));

      const result = await navigator.loadCategoryContent('정치', { timeout: 1000 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });

    it('should batch load multiple categories', async () => {
      mockBrowser.findElements.mockResolvedValue([{ text: '기사1' }]);

      const categories = ['정치', '경제', '사회'];
      const result = await navigator.batchLoadCategories(categories);
      
      expect(result.successCount).toBe(3);
      expect(result.results).toHaveLength(3);
    });

    it('should handle category filter combinations', async () => {
      mockBrowser.findElements.mockResolvedValue([{ text: '필터된 기사' }]);

      const filters = { categories: ['정치', '경제'], tags: ['중요'] };
      const result = await navigator.applyCategoryFilters(filters);
      
      expect(result.filteredArticles).toHaveLength(1);
      expect(result.appliedFilters).toEqual(filters);
    });
  });

  // ==========================================
  // 3. 카테고리 조합 및 검색 (10개 테스트)
  // ==========================================
  
  describe('카테고리 조합 및 검색', () => {
    it('should combine multiple categories for intersection', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '정치+경제 기사' }
      ]);

      const result = await navigator.findArticlesInMultipleCategories(['정치', '경제'], 'AND');
      
      expect(result.articles).toHaveLength(1);
      expect(result.operator).toBe('AND');
    });

    it('should combine multiple categories for union', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '정치 기사' }, { text: '경제 기사' }
      ]);

      const result = await navigator.findArticlesInMultipleCategories(['정치', '경제'], 'OR');
      
      expect(result.articles).toHaveLength(2);
      expect(result.operator).toBe('OR');
    });

    it('should exclude specific categories', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '사회 기사' }
      ]);

      const result = await navigator.findArticlesExcludingCategories(['정치', '경제']);
      
      expect(result.articles).toHaveLength(1);
      expect(result.excludedCategories).toEqual(['정치', '경제']);
    });

    it('should search across all categories', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '검색 결과1', category: '정치' },
        { text: '검색 결과2', category: '경제' }
      ]);

      const result = await navigator.searchAcrossAllCategories('코로나');
      
      expect(result.results).toHaveLength(2);
      expect(result.query).toBe('코로나');
    });

    it('should rank categories by article count', async () => {
      mockBrowser.findElements
        .mockResolvedValueOnce([{ text: '정치1' }, { text: '정치2' }])
        .mockResolvedValueOnce([{ text: '경제1' }])
        .mockResolvedValueOnce([{ text: '사회1' }, { text: '사회2' }, { text: '사회3' }]);

      const ranking = await navigator.rankCategoriesByArticleCount();
      
      expect(ranking[0].category).toBe('사회');
      expect(ranking[0].count).toBe(3);
    });

    it('should find related categories', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '경제' }, { text: '국제' }
      ]);

      const related = await navigator.findRelatedCategories('정치');
      
      expect(related).toContain('경제');
      expect(related).toContain('국제');
    });

    it('should suggest categories based on content', async () => {
      const content = '대통령이 경제 정책을 발표했다';
      
      const suggestions = await navigator.suggestCategoriesForContent(content);
      
      expect(suggestions).toContain('정치');
      expect(suggestions).toContain('경제');
    });

    it('should track category popularity', async () => {
      await navigator.navigateToCategory('정치');
      await navigator.navigateToCategory('정치');
      await navigator.navigateToCategory('경제');

      const popularity = navigator.getCategoryPopularity();
      
      expect(popularity['정치']).toBe(2);
      expect(popularity['경제']).toBe(1);
    });

    it('should create category bookmarks', async () => {
      const bookmark = {
        name: '정치 즐겨찾기',
        categories: ['정치'],
        subCategories: ['대통령실', '국회/정당']
      };

      const result = await navigator.createCategoryBookmark(bookmark);
      
      expect(result.success).toBe(true);
      expect(result.bookmarkId).toBeDefined();
    });

    it('should export category structure', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { text: '정치' }, { text: '경제' }
      ]);

      const structure = await navigator.exportCategoryStructure();
      
      expect(structure.categories).toBeDefined();
      expect(structure.exportDate).toBeDefined();
      expect(structure.version).toBeDefined();
    });
  });

  // ==========================================
  // 4. 모바일 반응형 카테고리 (8개 테스트)
  // ==========================================
  
  describe('모바일 반응형 카테고리', () => {
    beforeEach(() => {
      mockBrowser.isMobile.mockReturnValue(true);
    });

    it('should detect mobile category menu', async () => {
      mockBrowser.findElements.mockResolvedValue([
        { className: 'mobile-menu-toggle' }
      ]);

      const hasMobileMenu = await navigator.hasMobileCategoryMenu();
      
      expect(hasMobileMenu).toBe(true);
    });

    it('should toggle mobile category menu', async () => {
      mockBrowser.click.mockResolvedValue(undefined);

      const result = await navigator.toggleMobileCategoryMenu();
      
      expect(result.success).toBe(true);
      expect(mockBrowser.click).toHaveBeenCalled();
    });

    it('should navigate categories in mobile slider', async () => {
      mockBrowser.swipe = vi.fn().mockResolvedValue(undefined);

      const result = await navigator.swipeCategorySlider('left');
      
      expect(result.success).toBe(true);
      expect(mockBrowser.swipe).toHaveBeenCalledWith('left');
    });

    it('should handle mobile category dropdown', async () => {
      mockBrowser.click.mockResolvedValue(undefined);
      mockBrowser.waitForSelector.mockResolvedValue({});

      const result = await navigator.selectMobileCategoryDropdown('정치');
      
      expect(result.success).toBe(true);
      expect(result.selectedCategory).toBe('정치');
    });

    it('should adapt category layout for mobile', async () => {
      mockBrowser.setViewport.mockResolvedValue(undefined);

      const result = await navigator.adaptCategoryLayoutForMobile();
      
      expect(result.success).toBe(true);
      expect(mockBrowser.setViewport).toHaveBeenCalledWith(
        expect.objectContaining({ isMobile: true })
      );
    });

    it('should handle mobile category search', async () => {
      mockBrowser.type = vi.fn().mockResolvedValue(undefined);
      mockBrowser.findElements.mockResolvedValue([{ text: '검색결과' }]);

      const result = await navigator.searchCategoriesOnMobile('정치');
      
      expect(result.success).toBe(true);
      expect(result.searchResults).toHaveLength(1);
    });

    it('should detect mobile category gestures', async () => {
      mockBrowser.onGesture = vi.fn();

      await navigator.enableMobileCategoryGestures();
      
      expect(mockBrowser.onGesture).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should handle mobile category accessibility', async () => {
      mockBrowser.getAttribute = vi.fn().mockResolvedValue('true');

      const isAccessible = await navigator.checkMobileCategoryAccessibility();
      
      expect(isAccessible).toBe(true);
    });
  });
});