# Task Phase 3: 뉴스 설정 관리 모듈 (TDD)

이 문서는 AI Agent가 자동으로 실행할 수 있도록 상세하게 작성된 Phase 3 개발 태스크입니다.

**Phase 3 목표**: 뉴스 사이트별 설정 관리 시스템 구축 (TDD 방식)

**실행 원칙**:
- 각 태스크는 순차적으로 실행
- TDD 사이클 (RED → GREEN → REFACTOR) 준수
- 실패 시 명시된 복구 전략 적용
- 모든 검증 기준 통과 후 다음 단계 진행

---

## Phase 3: 뉴스 설정 관리 모듈 (TDD)

### Task 3.1: 뉴스 사이트 설정 타입 정의 테스트
**목표**: 뉴스 사이트별 설정을 위한 TypeScript 타입 시스템 구축

**실행 단계**:
1. **dotenv 패키지 설치**
   ```bash
   npm install dotenv
   npm install --save-dev @types/node
   ```
   - **성공 기준**: package.json dependencies에 dotenv 추가
   - **실패 시**: npm 캐시 클리어 후 재시도

2. **RED: 설정 타입 테스트 작성**
   - **파일**: `test/config.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { NewsConfig, NewsSiteConfig, validateConfig } from '../src/config';
   
   describe('News Configuration Types', () => {
     it('should define NewsConfig interface correctly', () => {
       const config: NewsConfig = {
         sites: {},
         output: { format: 'json', directory: './results' },
         browser: { headless: true, timeout: 30000 }
       };
       expect(config).toBeDefined();
     });

     it('should validate complete configuration', () => {
       const validConfig: NewsConfig = {
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
       };
       
       expect(() => validateConfig(validConfig)).not.toThrow();
     });

     it('should throw error for invalid configuration', () => {
       const invalidConfig = { sites: {} } as NewsConfig;
       expect(() => validateConfig(invalidConfig)).toThrow();
     });
   });
   ```

3. **GREEN: 기본 설정 인터페이스 구현**
   - **파일**: `src/config.ts`
   - **내용**:
   ```typescript
   export interface NewsSiteSelectors {
     title: string;
     content: string;
     author: string;
     publishDate: string;
     category?: string;
   }

   export interface NewsSiteConfig {
     name: string;
     baseUrl: string;
     selectors: NewsSiteSelectors;
     urlPatterns: string[];
     waitOptions: {
       timeout: number;
       waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
     };
     requestDelay?: number;
   }

   export interface NewsConfig {
     sites: Record<string, NewsSiteConfig>;
     output: {
       format: 'json' | 'csv';
       directory: string;
     };
     browser: {
       headless: boolean;
       timeout: number;
     };
   }

   export function validateConfig(config: NewsConfig): void {
     if (!config.sites || Object.keys(config.sites).length === 0) {
       throw new Error('At least one news site must be configured');
     }
     // 추가 검증 로직...
   }

   export const defaultConfig: NewsConfig = {
     sites: {
       'example-news': {
         name: 'Example News',
         baseUrl: 'https://example.com',
         selectors: {
           title: 'h1',
           content: '.content',
           author: '.author',
           publishDate: '.date'
         },
         urlPatterns: ['https://example.com/news/*'],
         waitOptions: { timeout: 30000 },
         requestDelay: 1000
       }
     },
     output: { format: 'json', directory: './results' },
     browser: { headless: true, timeout: 30000 }
   };
   ```

4. **REFACTOR: 설정 구조 최적화**
   - JSDoc 문서화 추가
   - 타입 안전성 강화
   - 기본값 개선

**완료 조건**: 모든 타입 테스트 통과, 설정 인터페이스 구현 완료
**다음 단계**: Task 3.2
**실패 시 복구**: src/config.ts 재생성 후 테스트 재실행

---

### Task 3.2: 환경변수 로딩 테스트
**목표**: 환경변수에서 설정을 로드하고 기본값과 병합하는 시스템 구축

**실행 단계**:
1. **RED: 환경변수 로딩 테스트 작성**
   - **파일**: `test/env-loader.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from 'vitest';
   import { loadEnvironmentConfig, mergeWithDefaults } from '../src/env-loader';

   describe('Environment Configuration', () => {
     beforeEach(() => {
       process.env.NEWS_OUTPUT_FORMAT = 'csv';
       process.env.NEWS_OUTPUT_DIR = './test-results';
       process.env.NEWS_BROWSER_HEADLESS = 'false';
       process.env.NEWS_TIMEOUT = '45000';
     });

     afterEach(() => {
       delete process.env.NEWS_OUTPUT_FORMAT;
       delete process.env.NEWS_OUTPUT_DIR;
       delete process.env.NEWS_BROWSER_HEADLESS;
       delete process.env.NEWS_TIMEOUT;
     });

     it('should load configuration from environment variables', () => {
       const envConfig = loadEnvironmentConfig();
       expect(envConfig.output.format).toBe('csv');
       expect(envConfig.browser.headless).toBe(false);
     });

     it('should merge environment config with defaults', () => {
       const envConfig = loadEnvironmentConfig();
       const finalConfig = mergeWithDefaults(envConfig);
       expect(finalConfig.output.format).toBe('csv');
       expect(finalConfig.sites).toBeDefined();
     });
   });
   ```

2. **GREEN: 환경변수 로딩 구현**
   - **파일**: `src/env-loader.ts`
   - **내용**:
   ```typescript
   import { config as dotenvConfig } from 'dotenv';
   import { NewsConfig, defaultConfig } from './config.js';

   dotenvConfig();

   export interface EnvironmentConfig {
     output: {
       format?: 'json' | 'csv';
       directory?: string;
     };
     browser: {
       headless?: boolean;
       timeout?: number;
     };
   }

   export function loadEnvironmentConfig(): EnvironmentConfig {
     return {
       output: {
         format: parseOutputFormat(process.env.NEWS_OUTPUT_FORMAT),
         directory: process.env.NEWS_OUTPUT_DIR || undefined
       },
       browser: {
         headless: parseBoolean(process.env.NEWS_BROWSER_HEADLESS),
         timeout: parseNumber(process.env.NEWS_TIMEOUT)
       }
     };
   }

   export function mergeWithDefaults(envConfig: EnvironmentConfig): NewsConfig {
     const merged = JSON.parse(JSON.stringify(defaultConfig));
     
     if (envConfig.output.format !== undefined) {
       merged.output.format = envConfig.output.format;
     }
     if (envConfig.output.directory !== undefined) {
       merged.output.directory = envConfig.output.directory;
     }
     if (envConfig.browser.headless !== undefined) {
       merged.browser.headless = envConfig.browser.headless;
     }
     if (envConfig.browser.timeout !== undefined) {
       merged.browser.timeout = envConfig.browser.timeout;
     }
     
     return merged;
   }

   function parseBoolean(value: string | undefined): boolean | undefined {
     if (value === undefined) return undefined;
     return value.toLowerCase() === 'true';
   }

   function parseNumber(value: string | undefined): number | undefined {
     if (value === undefined) return undefined;
     const parsed = parseInt(value, 10);
     return isNaN(parsed) ? undefined : parsed;
   }

   function parseOutputFormat(value: string | undefined): 'json' | 'csv' | undefined {
     if (value === undefined) return undefined;
     return (value === 'json' || value === 'csv') ? value : undefined;
   }
   ```

3. **REFACTOR: 안전한 파싱 함수 및 상세 문서화**
   - 타입 안전성 개선
   - 에러 처리 강화
   - JSDoc 문서화

**완료 조건**: 환경변수 로딩 테스트 통과, 병합 로직 구현 완료
**다음 단계**: Task 3.3
**실패 시 복구**: 환경변수 설정 확인 후 재실행

---

### Task 3.3: 뉴스 사이트 설정 병합 로직 테스트
**목표**: 설정 관리자 클래스로 모든 설정 소스를 통합 관리

**실행 단계**:
1. **RED: 설정 병합 테스트 작성**
   - **파일**: `test/config-merger.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect, beforeEach } from 'vitest';
   import { ConfigManager } from '../src/config-manager';

   describe('Configuration Merger', () => {
     let configManager: ConfigManager;

     beforeEach(() => {
       configManager = new ConfigManager();
     });

     it('should load default configuration', () => {
       const config = configManager.getConfig();
       expect(config.sites['example-news']).toBeDefined();
     });

     it('should add new site configuration', () => {
       const newSite = {
         name: 'test-news',
         baseUrl: 'https://test.com',
         selectors: { title: 'h1', content: '.content', author: '.author', publishDate: '.date' },
         urlPatterns: ['/news/'],
         waitOptions: { timeout: 30000 }
       };
       
       configManager.addSiteConfig('test-news', newSite);
       const config = configManager.getConfig();
       expect(config.sites['test-news']).toEqual(newSite);
     });

     it('should merge environment variables with defaults', () => {
       process.env.NEWS_OUTPUT_FORMAT = 'csv';
       const config = configManager.loadFromEnvironment().getConfig();
       expect(config.output.format).toBe('csv');
       delete process.env.NEWS_OUTPUT_FORMAT;
     });
   });
   ```

2. **GREEN: 설정 관리자 구현**
   - **파일**: `src/config-manager.ts`
   - **내용**:
   ```typescript
   import { NewsConfig, NewsSiteConfig, defaultConfig } from './config.js';
   import { loadEnvironmentConfig, mergeWithDefaults } from './env-loader.js';

   export class ConfigurationError extends Error {
     constructor(message: string, public readonly code: string) {
       super(message);
       this.name = 'ConfigurationError';
     }
   }

   export class ConfigManager {
     private config: NewsConfig;

     constructor(initialConfig?: NewsConfig) {
       this.config = initialConfig ? this.deepClone(initialConfig) : this.deepClone(defaultConfig);
     }

     getConfig(): NewsConfig {
       return this.deepClone(this.config);
     }

     loadFromEnvironment(): ConfigManager {
       const envConfig = loadEnvironmentConfig();
       this.config = mergeWithDefaults(envConfig);
       return this;
     }

     addSiteConfig(siteId: string, siteConfig: NewsSiteConfig): void {
       this.validateSiteConfig(siteConfig);
       this.config.sites[siteId] = this.deepClone(siteConfig);
     }

     updateSiteConfig(siteId: string, updates: Partial<NewsSiteConfig>): void {
       if (!this.config.sites[siteId]) {
         throw new ConfigurationError(`Site configuration '${siteId}' not found`, 'SITE_NOT_FOUND');
       }
       
       const updatedConfig = { ...this.config.sites[siteId], ...updates };
       if (updates.selectors) {
         updatedConfig.selectors = { ...this.config.sites[siteId].selectors, ...updates.selectors };
       }
       
       this.validateSiteConfig(updatedConfig);
       this.config.sites[siteId] = updatedConfig;
     }

     private deepClone<T>(obj: T): T {
       return JSON.parse(JSON.stringify(obj));
     }

     private validateSiteConfig(siteConfig: NewsSiteConfig): void {
       if (!siteConfig.name || !siteConfig.baseUrl || !siteConfig.selectors) {
         throw new ConfigurationError('Invalid site configuration', 'INVALID_CONFIG');
       }
     }
   }
   ```

3. **REFACTOR: ConfigurationError 클래스 및 고급 기능 추가**
   - 커스텀 에러 클래스
   - 설정 파일 로딩
   - 설정 내보내기
   - 깊은 복사 및 데이터 무결성

**완료 조건**: 모든 설정 병합 테스트 통과, ConfigManager 클래스 구현 완료
**다음 단계**: Phase 4
**실패 시 복구**: 설정 관리 로직 재검토 후 재구현

---

## 에러 처리 및 복구 전략

### 일반적인 에러 상황
1. **패키지 설치 실패**
   - npm 캐시 클리어: `npm cache clean --force`
   - 레지스트리 변경: `npm config set registry https://registry.npmjs.org/`
   - 재시도 3회 후 수동 개입 요청

2. **테스트 실패**
   - 에러 로그 분석 및 출력
   - 관련 파일 재생성
   - 의존성 재설치

3. **파일 시스템 에러**
   - 권한 확인
   - 디스크 공간 확인
   - 경로 유효성 검증

### 복구 체크포인트
- 각 Phase 완료 시 Git 커밋
- 설정 파일 백업
- 테스트 통과 상태 저장

---

## Phase 3 완료 체크리스트

- [ ] Task 3.1: 뉴스 사이트 설정 타입 정의 테스트 완료
- [ ] Task 3.2: 환경변수 로딩 테스트 완료
- [ ] Task 3.3: 뉴스 사이트 설정 병합 로직 테스트 완료
- [ ] 모든 TDD 사이클 (RED-GREEN-REFACTOR) 완료
- [ ] 모든 테스트 통과
- [ ] Git 커밋 완료
- [ ] 다음 Phase 준비 완료 