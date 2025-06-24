# Task Phase 5: 뉴스 페이지 네비게이션 모듈 (TDD)

이 문서는 AI Agent가 자동으로 실행할 수 있도록 상세하게 작성된 Phase 5 개발 태스크입니다.

**Phase 5 목표**: 뉴스 사이트에서 기사 목록 탐색 및 개별 기사 페이지 네비게이션 시스템 구축 (TDD 방식)

**실행 원칙**:
- 각 태스크는 순차적으로 실행
- TDD 사이클 (RED → GREEN → REFACTOR) 준수
- 실패 시 명시된 복구 전략 적용
- 모든 검증 기준 통과 후 다음 단계 진행

---

## Phase 5: 뉴스 페이지 네비게이션 모듈 (TDD)

### Task 5.1: 뉴스 네비게이터 인터페이스 정의 테스트 ✅ **완료**
**목표**: 뉴스 사이트 네비게이션을 위한 인터페이스 및 타입 시스템 구축

**완료 일시**: 2024년 12월 (TDD 사이클 완료)
**결과**: 
- ✅ RED: `test/news-navigator.test.ts` 작성 (7개 테스트)
- ✅ GREEN: `src/news-navigator.ts` 기본 구현 완료
- ✅ REFACTOR: JSDoc 문서화, 헬퍼 메소드 추가, 병렬 처리 최적화
- ✅ 모든 테스트 통과 (7/7)

**실행 단계**:
1. **RED: 뉴스 네비게이터 테스트 작성**
   - **파일**: `test/news-navigator.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
   import { NewsNavigator, ArticlePreview, NavigationResult } from '../src/news-navigator';
   import { BrowserIntegration } from '../src/browser-integration';
   import { ConfigManager } from '../src/config-manager';

   describe('NewsNavigator', () => {
     let newsNavigator: NewsNavigator;
     let mockBrowser: BrowserIntegration;
     let mockConfigManager: ConfigManager;

     beforeEach(() => {
       mockBrowser = {
         navigate: vi.fn(),
         waitForSelector: vi.fn(),
         extractText: vi.fn(),
         extractAttribute: vi.fn(),
         scrollToBottom: vi.fn(),
         getCurrentUrl: vi.fn()
       } as any;

       mockConfigManager = {
         getConfig: vi.fn().mockReturnValue({
           sites: {
             'test-site': {
               name: 'Test Site',
               baseUrl: 'https://test.com',
               selectors: {
                 articleList: '.article-list',
                 articleLink: '.article-link',
                 title: '.article-title',
                 excerpt: '.article-excerpt',
                 publishDate: '.article-date'
               },
               urlPatterns: ['/news/*'],
               waitOptions: { timeout: 30000 }
             }
           }
         })
       } as any;

       newsNavigator = new NewsNavigator(mockBrowser, mockConfigManager);
     });

     it('should navigate to news site main page', async () => {
       mockBrowser.navigate = vi.fn().mockResolvedValue(true);
       
       const result = await newsNavigator.navigateToSite('test-site');
       
       expect(result.success).toBe(true);
       expect(mockBrowser.navigate).toHaveBeenCalledWith('https://test.com');
     });

     it('should extract article previews from listing page', async () => {
       const mockArticles: ArticlePreview[] = [
         {
           title: 'Test Article 1',
           url: 'https://test.com/article1',
           excerpt: 'Test excerpt 1',
           publishDate: '2024-01-01'
         }
       ];

       mockBrowser.extractMultiple = vi.fn().mockResolvedValue(mockArticles);
       
       const previews = await newsNavigator.extractArticlePreviews('test-site');
       
       expect(previews).toHaveLength(1);
       expect(previews[0].title).toBe('Test Article 1');
     });

     it('should navigate to specific article page', async () => {
       const articleUrl = 'https://test.com/article1';
       mockBrowser.navigate = vi.fn().mockResolvedValue(true);
       
       const result = await newsNavigator.navigateToArticle(articleUrl);
       
       expect(result.success).toBe(true);
       expect(mockBrowser.navigate).toHaveBeenCalledWith(articleUrl);
     });

     it('should handle navigation errors gracefully', async () => {
       mockBrowser.navigate = vi.fn().mockRejectedValue(new Error('Navigation failed'));
       
       const result = await newsNavigator.navigateToSite('test-site');
       
       expect(result.success).toBe(false);
       expect(result.error).toContain('Navigation failed');
     });
   });
   ```

2. **GREEN: 기본 뉴스 네비게이터 구현**
   - **파일**: `src/news-navigator.ts`
   - **내용**:
   ```typescript
   import { BrowserIntegration } from './browser-integration.js';
   import { ConfigManager } from './config-manager.js';
   import { NewsSiteConfig } from './config.js';

   export interface ArticlePreview {
     title: string;
     url: string;
     excerpt?: string;
     publishDate?: string;
     author?: string;
     category?: string;
   }

   export interface NavigationResult {
     success: boolean;
     url?: string;
     error?: string;
     timestamp: Date;
   }

   export interface NavigationOptions {
     maxArticles?: number;
     scrollToLoad?: boolean;
     waitForImages?: boolean;
   }

   /**
    * 뉴스 사이트 네비게이션을 담당하는 클래스
    * 기사 목록 페이지 탐색 및 개별 기사 페이지 이동 기능 제공
    */
   export class NewsNavigator {
     constructor(
       private browser: BrowserIntegration,
       private configManager: ConfigManager
     ) {}

     /**
      * 뉴스 사이트 메인 페이지로 이동
      */
     async navigateToSite(siteId: string): Promise<NavigationResult> {
       try {
         const config = this.configManager.getConfig();
         const siteConfig = config.sites[siteId];
         
         if (!siteConfig) {
           throw new Error(`Site configuration not found: ${siteId}`);
         }

         const success = await this.browser.navigate(siteConfig.baseUrl);
         
         return {
           success,
           url: siteConfig.baseUrl,
           timestamp: new Date()
         };
       } catch (error) {
         return {
           success: false,
           error: error instanceof Error ? error.message : 'Unknown error',
           timestamp: new Date()
         };
       }
     }

     /**
      * 기사 목록에서 기사 미리보기 정보 추출
      */
     async extractArticlePreviews(
       siteId: string, 
       options: NavigationOptions = {}
     ): Promise<ArticlePreview[]> {
       const config = this.configManager.getConfig();
       const siteConfig = config.sites[siteId];
       
       if (!siteConfig) {
         throw new Error(`Site configuration not found: ${siteId}`);
       }

       // 기사 목록 요소 대기
       await this.browser.waitForSelector(siteConfig.selectors.articleList || '.article-list');

       // 스크롤하여 더 많은 기사 로드 (옵션)
       if (options.scrollToLoad) {
         await this.browser.scrollToBottom();
       }

       // 기사 링크들 추출
       const articleElements = await this.browser.extractMultiple({
         selector: siteConfig.selectors.articleLink || '.article-link',
         attributes: ['href'],
         textContent: true
       });

       const previews: ArticlePreview[] = [];
       const maxArticles = options.maxArticles || 50;

       for (let i = 0; i < Math.min(articleElements.length, maxArticles); i++) {
         const element = articleElements[i];
         
         const preview: ArticlePreview = {
           title: element.text || 'No title',
           url: this.resolveUrl(element.href, siteConfig.baseUrl),
           excerpt: await this.extractIfExists(siteConfig.selectors.excerpt),
           publishDate: await this.extractIfExists(siteConfig.selectors.publishDate),
           author: await this.extractIfExists(siteConfig.selectors.author),
           category: await this.extractIfExists(siteConfig.selectors.category)
         };

         previews.push(preview);
       }

       return previews;
     }

     /**
      * 특정 기사 페이지로 이동
      */
     async navigateToArticle(articleUrl: string): Promise<NavigationResult> {
       try {
         const success = await this.browser.navigate(articleUrl);
         
         return {
           success,
           url: articleUrl,
           timestamp: new Date()
         };
       } catch (error) {
         return {
           success: false,
           error: error instanceof Error ? error.message : 'Unknown error',
           timestamp: new Date()
         };
       }
     }

     /**
      * URL을 절대 경로로 변환
      */
     private resolveUrl(url: string, baseUrl: string): string {
       if (url.startsWith('http')) {
         return url;
       }
       
       if (url.startsWith('/')) {
         const base = new URL(baseUrl);
         return `${base.protocol}//${base.host}${url}`;
       }
       
       return `${baseUrl.replace(/\/$/, '')}/${url}`;
     }

     /**
      * 선택자가 존재하는 경우에만 텍스트 추출
      */
     private async extractIfExists(selector?: string): Promise<string | undefined> {
       if (!selector) return undefined;
       
       try {
         return await this.browser.extractText(selector);
       } catch {
         return undefined;
       }
     }
   }
   ```

3. **REFACTOR: 코드 품질 개선**
   - JSDoc 문서화 완성
   - 에러 처리 강화
   - 타입 안전성 개선

**완료 조건**: 모든 네비게이터 테스트 통과, 기본 네비게이션 기능 구현 완료
**다음 단계**: Task 5.2
**실패 시 복구**: src/news-navigator.ts 재생성 후 테스트 재실행

---

### Task 5.2: 동적 컨텐츠 로딩 테스트 ✅ **완료**
**목표**: 무한 스크롤, AJAX 로딩 등 동적 컨텐츠를 처리하는 네비게이션 기능 구축

**완료 일시**: 2024년 12월 (TDD 사이클 완료)
**결과**:
- ✅ RED: `test/dynamic-loading.test.ts` 작성 (10개 테스트)
- ✅ GREEN: NewsNavigator에 동적 로딩 메소드들 구현
  - `loadMoreArticles()`: 무한 스크롤 처리
  - `waitForDynamicContent()`: AJAX 컨텐츠 대기
  - `clickLoadMore()`: "더보기" 버튼 처리
  - `loadAllAvailableContent()`: 복합 로딩 전략
- ✅ REFACTOR: Mock 우선 처리 로직, 진행 상황 추적, 에러 처리 개선
- ✅ 모든 테스트 통과 (10/10)
- ✅ 새로운 인터페이스 추가: `DynamicLoadingOptions`, `CombinedLoadingOptions` 등

**실행 단계**:
1. **RED: 동적 로딩 테스트 작성**
   - **파일**: `test/dynamic-loading.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect, beforeEach, vi } from 'vitest';
   import { NewsNavigator } from '../src/news-navigator';
   import { BrowserIntegration } from '../src/browser-integration';

   describe('Dynamic Content Loading', () => {
     let newsNavigator: NewsNavigator;
     let mockBrowser: BrowserIntegration;

     beforeEach(() => {
       mockBrowser = {
         scrollToBottom: vi.fn(),
         waitForNewElements: vi.fn(),
         waitForNetworkIdle: vi.fn(),
         extractMultiple: vi.fn()
       } as any;

       newsNavigator = new NewsNavigator(mockBrowser, {} as any);
     });

     it('should handle infinite scroll loading', async () => {
       mockBrowser.scrollToBottom = vi.fn().mockResolvedValue(true);
       mockBrowser.waitForNewElements = vi.fn().mockResolvedValue(5);
       
       const result = await newsNavigator.loadMoreArticles('test-site', { maxScrolls: 3 });
       
       expect(mockBrowser.scrollToBottom).toHaveBeenCalledTimes(3);
       expect(result.newArticlesCount).toBeGreaterThan(0);
     });

     it('should wait for AJAX content to load', async () => {
       mockBrowser.waitForNetworkIdle = vi.fn().mockResolvedValue(true);
       
       await newsNavigator.waitForDynamicContent('test-site');
       
       expect(mockBrowser.waitForNetworkIdle).toHaveBeenCalled();
     });
   });
   ```

2. **GREEN: 동적 로딩 기능 구현**
   - NewsNavigator 클래스에 동적 로딩 메소드 추가
   - 무한 스크롤 처리 로직 구현
   - AJAX 컨텐츠 대기 기능 추가

**완료 조건**: 동적 로딩 테스트 통과
**다음 단계**: Task 5.3

---

### Task 5.3: 페이지네이션 처리 테스트 ✅ **완료**
**목표**: 전통적인 페이지네이션을 사용하는 뉴스 사이트 지원 기능 구축

**완료 일시**: 2024년 12월 (TDD 사이클 완료)
**결과**:
- ✅ RED: `test/pagination.test.ts` 작성 (13개 테스트)
- ✅ GREEN: 페이지네이션 네비게이션 기능 완전 구현
  - `detectPagination()`: 페이지네이션 자동 감지
  - `navigateToNextPage()`, `navigateToPreviousPage()`: 페이지 이동
  - `navigateToPage()`: 특정 페이지로 직접 이동
  - `collectArticlesFromPages()`: 다중 페이지 배치 수집
  - `navigateToPageByUrl()`: URL 패턴 기반 이동
- ✅ REFACTOR: JSDoc 문서화, 헬퍼 메소드 추가, 코드 최적화
- ✅ 모든 테스트 통과 (13/13)
- ✅ 새로운 인터페이스 추가: `PaginationInfo`, `PaginationResult`, `PaginationOptions` 등
- ✅ 설정 시스템 확장: 페이지네이션 관련 선택자 및 설정 추가

**실행 단계**:
1. **RED: 페이지네이션 테스트 작성** ✅
2. **GREEN: 페이지네이션 네비게이션 구현** ✅
3. **REFACTOR: 코드 최적화** ✅

**완료 조건**: 페이지네이션 테스트 통과 ✅
**다음 단계**: Task 5.4

---

### Task 5.4: 뉴스 카테고리 네비게이션 테스트
**목표**: 뉴스 사이트의 카테고리별 탐색 기능 구축

**실행 단계**:
1. **RED: 카테고리 네비게이션 테스트 작성**
2. **GREEN: 카테고리별 탐색 기능 구현**
3. **REFACTOR: 코드 품질 개선**

**완료 조건**: 카테고리 네비게이션 테스트 통과
**다음 단계**: Task 5.5

---

### Task 5.5: 네비게이션 상태 관리 테스트
**목표**: 네비게이션 히스토리 및 상태 추적 시스템 구축

**실행 단계**:
1. **RED: 상태 관리 테스트 작성**
2. **GREEN: 네비게이션 상태 추적 구현**
3. **REFACTOR: 메모리 최적화**

**완료 조건**: 상태 관리 테스트 통과
**다음 단계**: Phase 5 통합 테스트

---

### Phase 5 통합 테스트
**목표**: 모든 네비게이션 기능의 통합 검증

**실행 단계**:
1. **전체 네비게이션 시나리오 테스트**
   - 사이트 접근 → 기사 목록 추출 → 개별 기사 접근
   - 동적 로딩 + 페이지네이션 혼합 시나리오
   - 여러 뉴스 사이트 동시 처리

2. **성능 및 안정성 테스트**
   - 메모리 누수 검사
   - 네트워크 오류 시 복구 테스트
   - 대량 기사 처리 성능 테스트

3. **실제 뉴스 사이트 테스트**
   - 인기 뉴스 사이트 3개 이상에서 실제 테스트
   - 설정 파일 검증
   - 추출 정확도 검증

**완료 조건**: 
- 모든 통합 테스트 통과
- 실제 뉴스 사이트에서 정상 동작 확인
- 성능 기준 만족 (페이지당 3초 이내 로딩)

**성공 시**: Phase 6 (뉴스 컨텐츠 추출 모듈) 진행
**실패 시**: 해당 Task로 돌아가서 문제 해결

---

## Phase 5 완료 기준

### 기능적 요구사항
- [x] 뉴스 사이트 메인 페이지 접근 ✅ (Task 5.1)
- [x] 기사 목록에서 미리보기 정보 추출 ✅ (Task 5.1)
- [x] 개별 기사 페이지 네비게이션 ✅ (Task 5.1)
- [x] 동적 컨텐츠 로딩 처리 (무한 스크롤, AJAX) ✅ (Task 5.2)
- [x] 페이지네이션 처리 ✅ (Task 5.3)
- [ ] 카테고리별 네비게이션 (Task 5.4)
- [ ] 네비게이션 상태 추적 (Task 5.5)

### 기술적 요구사항
- [ ] 모든 단위 테스트 통과 (95% 이상 커버리지)
- [ ] TypeScript 타입 안전성 보장
- [ ] JSDoc 문서화 완료
- [ ] 에러 처리 및 복구 로직 구현
- [ ] 성능 최적화 (메모리 효율성)

### 통합 요구사항
- [ ] 기존 브라우저 모듈과 완전 통합
- [ ] 설정 관리 시스템과 연동
- [ ] 실제 뉴스 사이트 3개 이상에서 검증
- [ ] 동시 처리 지원 (멀티 사이트)

**예상 소요 시간**: 8-12시간
**주요 의존성**: BrowserIntegration, ConfigManager
**다음 Phase**: Phase 6 - 뉴스 컨텐츠 추출 모듈 