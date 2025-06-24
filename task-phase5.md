# Task Phase 5: 뉴스 페이지 네비게이션 모듈 (TDD)

이 문서는 AI Agent가 자동으로 실행할 수 있도록 상세하게 작성된 Phase 5 개발 태스크입니다.

**Phase 5 목표**: 뉴스 사이트에서 기사 목록 탐색 및 개별 기사 페이지 네비게이션 시스템 구축 (TDD 방식)

**실행 원칙**:
- 각 태스크는 순차적으로 실행
- TDD 사이클 (RED → GREEN → REFACTOR) 준수
- 실패 시 명시된 복구 전략 적용
- 모든 검증 기준 통과 후 다음 단계 진행

---

## 📊 Phase 5 진행 상황
- **진행률**: 80% (4/5 tasks 완료)
- **예상 완료일**: 2024년 1월 중순
- **전체 테스트**: 114개 중 114개 통과 (100%)

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

### Task 5.4: 카테고리 네비게이션 테스트 ✅ **완료**
**목표**: 실제 뉴스 사이트의 복잡한 카테고리 구조와 다양한 네비게이션 패턴 지원

**실제 분석 결과 기반 요구사항**:
1. **계층적 카테고리 구조**: 정치 > 대통령실, 국회/정당, 북한, 행정, 국방/외교, 정치일반
2. **다중 카테고리 시스템**: 메인 카테고리 + 서브 카테고리 + 태그 시스템
3. **동적 카테고리 로딩**: AJAX 기반 카테고리 전환 및 필터링
4. **카테고리별 페이지네이션**: 각 카테고리마다 독립적인 페이지 구조
5. **카테고리 기반 검색**: 특정 카테고리 내 키워드 검색
6. **카테고리 조합 필터**: 여러 카테고리 동시 선택 및 교집합 결과
7. **카테고리 네비게이션 히스토리**: 브라우저 뒤로가기/앞으로가기 지원
8. **모바일 반응형 카테고리**: 드롭다운, 햄버거 메뉴, 슬라이드 방식

**실행 단계**:
1. **RED: 카테고리 네비게이션 테스트 작성**
   - 계층적 카테고리 감지 및 탐색 테스트 (15개)
   - 동적 카테고리 로딩 및 필터링 테스트 (12개)  
   - 카테고리 조합 및 검색 테스트 (10개)
   - 모바일 반응형 카테고리 테스트 (8개)
   - **총 45개 테스트** 예상

2. **GREEN: 카테고리 네비게이션 구현**
   - `CategoryNavigator` 클래스 구현
   - 계층적 카테고리 파싱 및 탐색 메소드
   - 동적 필터링 및 조합 검색 기능
   - 카테고리 상태 관리 및 히스토리 지원

3. **REFACTOR: 코드 품질 개선 및 문서화**
   - 성능 최적화 (카테고리 캐싱, 지연 로딩)
   - 에러 처리 강화 (카테고리 없음, 로딩 실패)
   - JSDoc 문서화 및 사용 예제 추가

**완료 조건**: 
- 모든 카테고리 네비게이션 테스트 통과
- 실제 뉴스 사이트 5개 이상에서 동작 검증
- 성능 기준: 카테고리 전환 3초 이내, 필터링 1초 이내

**다음 단계**: Task 5.5 - 네비게이션 상태 관리

---

### Task 5.5: 네비게이션 상태 관리 테스트 ⏳ **진행 예정**
**목표**: 복잡한 뉴스 사이트 탐색 과정에서의 포괄적 상태 추적 및 세션 관리

**고급 상태 관리 요구사항**:
1. **네비게이션 세션 추적**: 방문 경로, 체류 시간, 스크롤 위치 기록
2. **다중 탭/창 동기화**: 같은 사이트의 여러 탭 간 상태 공유
3. **오프라인 상태 처리**: 네트워크 끊김 시 상태 보존 및 복구
4. **상태 기반 재개**: 중단된 지점부터 탐색 재시작
5. **진행률 추적**: 전체 사이트 대비 탐색 완료율 계산
6. **에러 상태 관리**: 실패한 요청 재시도 및 대안 경로 제시
7. **성능 모니터링**: 응답 시간, 메모리 사용량, CPU 사용률 추적
8. **사용자 행동 분석**: 클릭 패턴, 관심 카테고리, 선호 컨텐츠 학습

**실행 단계**:
1. **RED: 고급 상태 관리 테스트 작성**
   - 세션 생명주기 관리 테스트 (12개)
   - 다중 탭 동기화 테스트 (10개)
   - 오프라인/온라인 전환 테스트 (8개)
   - 상태 복구 및 재개 테스트 (15개)
   - 성능 모니터링 테스트 (10개)
   - **총 55개 테스트** 예상

2. **GREEN: 종합적 상태 관리 시스템 구현**
   - `NavigationStateManager` 클래스 구현
   - 세션 스토리지 및 로컬 스토리지 활용
   - 실시간 상태 동기화 메커니즘
   - 상태 기반 스마트 재개 기능
   - 성능 메트릭 수집 및 분석

3. **REFACTOR: 엔터프라이즈급 최적화**
   - 메모리 누수 방지 및 가비지 컬렉션 최적화
   - 대용량 상태 데이터 압축 및 청크 분할
   - 비동기 상태 업데이트 배치 처리
   - 상태 변경 이벤트 디바운싱 및 스로틀링

**완료 조건**: 
- 모든 상태 관리 테스트 통과
- 24시간 연속 실행 안정성 검증
- 메모리 사용량 100MB 이하 유지
- 상태 동기화 지연 시간 500ms 이하

**다음 단계**: Phase 5 통합 테스트 및 성능 벤치마킹

---

### Phase 5 통합 테스트 및 성능 벤치마킹 ⏳ **최종 단계**
**목표**: 엔터프라이즈급 뉴스 네비게이션 시스템의 종합 검증 및 최적화

**고급 통합 테스트 시나리오**:
1. **복합 네비게이션 워크플로우 테스트**
   - 사이트 접근 → 카테고리 탐색 → 동적 로딩 → 페이지네이션 → 개별 기사 접근
   - 다중 카테고리 필터링 + 무한 스크롤 + 상태 추적 혼합 시나리오
   - 동시 다중 사이트 처리 (5개 이상 뉴스 사이트 병렬 탐색)
   - 모바일/데스크톱 반응형 네비게이션 전환 테스트

2. **엔터프라이즈급 성능 및 안정성 테스트**
   - 24시간 연속 실행 스트레스 테스트
   - 메모리 누수 및 가비지 컬렉션 최적화 검증
   - 네트워크 지연/중단/복구 시나리오 대응
   - 대용량 데이터 처리 (10,000개 기사 이상)
   - CPU 및 메모리 사용량 프로파일링

3. **실제 뉴스 생태계 테스트**
   - 주요 뉴스 사이트 5개 이상 실제 테스트 (네이버, 다음, 조선일보, 중앙일보, 한겨레 등)
   - 각기 다른 기술 스택 (React, Vue, jQuery, 바닐라 JS) 대응
   - 다양한 카테고리 구조 및 UI 패턴 호환성 검증
   - 실시간 뉴스 업데이트 추적 정확도 측정

4. **사용자 경험 및 접근성 테스트**
   - 시각 장애인 스크린 리더 호환성
   - 키보드 전용 네비게이션 지원
   - 저사양 디바이스에서의 성능 최적화
   - 느린 네트워크 환경 대응 (3G, 2G)

**성능 벤치마킹 기준**:
- **응답 시간**: 페이지 로딩 3초 이내, 카테고리 전환 1초 이내
- **메모리 효율성**: 상주 메모리 100MB 이하, 메모리 누수 0%
- **동시 처리**: 5개 사이트 병렬 처리 시 성능 저하 20% 이내
- **안정성**: 24시간 연속 실행 시 에러율 0.1% 이하
- **정확도**: 기사 추출 정확도 95% 이상, 카테고리 분류 정확도 90% 이상

**완료 조건**: 
- 모든 통합 테스트 통과 (200개 이상 테스트 케이스)
- 성능 벤치마킹 기준 만족
- 실제 뉴스 사이트 5개 이상에서 정상 동작 확인
- 코드 커버리지 95% 이상 달성
- 문서화 완료 (API 문서, 사용 가이드, 트러블슈팅 가이드)

**성공 시**: Phase 6 (뉴스 컨텐츠 추출 모듈) 진행
**실패 시**: 해당 Task로 돌아가서 문제 해결 및 최적화

---

## Phase 5 완료 기준

### 기능적 요구사항
- [x] 뉴스 사이트 메인 페이지 접근 ✅ (Task 5.1)
- [x] 기사 목록에서 미리보기 정보 추출 ✅ (Task 5.1)
- [x] 개별 기사 페이지 네비게이션 ✅ (Task 5.1)
- [x] 동적 컨텐츠 로딩 처리 (무한 스크롤, AJAX) ✅ (Task 5.2)
- [x] 페이지네이션 처리 ✅ (Task 5.3)
- [x] 카테고리별 네비게이션 ✅ (Task 5.4)
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

**예상 소요 시간**: 15-20시간 (고급 기능 포함)
**예상 총 테스트 수**: 169개 (현재 69개 + Task 5.4: 45개 + Task 5.5: 55개)
**주요 의존성**: BrowserIntegration, ConfigManager, SessionManager
**다음 Phase**: Phase 6 - 엔터프라이즈급 뉴스 컨텐츠 추출 모듈 