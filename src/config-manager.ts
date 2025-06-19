/**
 * 뉴스 크롤러 설정 관리자
 * 
 * 이 클래스는 뉴스 크롤러의 모든 설정을 중앙에서 관리합니다.
 * 
 * ## 주요 기능
 * - **기본 설정 관리**: 기본값 로드 및 환경변수 병합
 * - **사이트별 설정**: 뉴스 사이트별 크롤링 설정 관리
 * - **설정 파일 처리**: JSON 파일에서 설정 로드 및 저장
 * - **유효성 검증**: 설정 데이터의 완전성 및 형식 검증
 * 
 * ## 사용 예시
 * ```typescript
 * const configManager = new ConfigManager();
 * 
 * // 환경변수 로드
 * configManager.loadFromEnvironment();
 * 
 * // 사이트 설정 추가
 * configManager.addSiteConfig('my-news', {
 *   name: 'My News Site',
 *   baseUrl: 'https://mynews.com',
 *   selectors: { ... },
 *   urlPatterns: ['/news/'],
 *   waitOptions: { timeout: 30000 }
 * });
 * 
 * // 최종 설정 가져오기
 * const config = configManager.getConfig();
 * ```
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { NewsConfig, NewsSiteConfig, defaultConfig, validateConfig } from './config.js';
import { loadEnvironmentConfig, mergeWithDefaults } from './env-loader.js';

/**
 * 설정 관리 에러 타입
 */
export class ConfigurationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * 설정 관리자 클래스
 * 
 * 뉴스 크롤러의 모든 설정을 중앙에서 관리하고,
 * 다양한 소스(기본값, 환경변수, 파일)에서 설정을 로드하여 병합합니다.
 */
export class ConfigManager {
  private config: NewsConfig;

  /**
   * ConfigManager 인스턴스를 생성합니다
   * 
   * @param initialConfig - 초기 설정 (선택사항)
   *                       제공되지 않으면 기본 설정을 사용합니다
   */
  constructor(initialConfig?: NewsConfig) {
    this.config = initialConfig ? this.deepClone(initialConfig) : this.deepClone(defaultConfig);
  }

  /**
   * 현재 설정의 복사본을 반환합니다
   * 
   * @returns 현재 뉴스 크롤러 설정 (깊은 복사본)
   */
  getConfig(): NewsConfig {
    return this.deepClone(this.config);
  }

  /**
   * 환경변수에서 설정을 로드하고 현재 설정과 병합합니다
   * 
   * 이 메서드는 다음 환경변수들을 읽어서 설정에 반영합니다:
   * - NEWS_OUTPUT_FORMAT: 출력 형식 (json | csv)
   * - NEWS_OUTPUT_DIR: 출력 디렉터리
   * - NEWS_BROWSER_HEADLESS: 헤드리스 모드 (true | false)
   * - NEWS_TIMEOUT: 브라우저 타임아웃 (밀리초)
   * 
   * @returns ConfigManager 인스턴스 (메서드 체이닝용)
   */
  loadFromEnvironment(): ConfigManager {
    try {
      const envConfig = loadEnvironmentConfig();
      this.config = mergeWithDefaults(envConfig);
      return this;
    } catch (error) {
      throw new ConfigurationError(
        `Failed to load environment configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ENV_LOAD_ERROR'
      );
    }
  }

  /**
   * 새로운 사이트 설정을 추가합니다
   * 
   * @param siteId - 사이트 식별자 (고유해야 함)
   * @param siteConfig - 추가할 사이트 설정
   * @throws {ConfigurationError} 설정이 유효하지 않거나 siteId가 이미 존재하는 경우
   */
  addSiteConfig(siteId: string, siteConfig: NewsSiteConfig): void {
    if (!siteId || !siteId.trim()) {
      throw new ConfigurationError('Site ID cannot be empty', 'INVALID_SITE_ID');
    }

    if (this.config.sites[siteId]) {
      throw new ConfigurationError(`Site configuration '${siteId}' already exists`, 'DUPLICATE_SITE_ID');
    }

    this.validateSiteConfig(siteConfig);
    this.config.sites[siteId] = this.deepClone(siteConfig);
  }

  /**
   * 기존 사이트 설정을 업데이트합니다
   * 
   * 부분 업데이트를 지원하며, 제공되지 않은 필드는 기존 값을 유지합니다.
   * 선택자(selectors) 객체도 부분 업데이트가 가능합니다.
   * 
   * @param siteId - 업데이트할 사이트 식별자
   * @param updates - 업데이트할 설정 (부분 업데이트 지원)
   * @throws {ConfigurationError} 사이트가 존재하지 않거나 업데이트된 설정이 유효하지 않은 경우
   */
  updateSiteConfig(siteId: string, updates: Partial<NewsSiteConfig>): void {
    if (!this.config.sites[siteId]) {
      throw new ConfigurationError(`Site configuration '${siteId}' not found`, 'SITE_NOT_FOUND');
    }

    // 기존 설정과 업데이트 병합
    const updatedConfig: NewsSiteConfig = {
      ...this.config.sites[siteId],
      ...updates
    };

    // 선택자가 부분 업데이트되는 경우 병합
    if (updates.selectors) {
      updatedConfig.selectors = {
        ...this.config.sites[siteId].selectors,
        ...updates.selectors
      };
    }

    this.validateSiteConfig(updatedConfig);
    this.config.sites[siteId] = updatedConfig;
  }

  /**
   * 사이트 설정을 제거합니다
   * 
   * @param siteId - 제거할 사이트 식별자
   * @throws {ConfigurationError} 사이트가 존재하지 않는 경우
   */
  removeSiteConfig(siteId: string): void {
    if (!this.config.sites[siteId]) {
      throw new ConfigurationError(`Site configuration '${siteId}' not found`, 'SITE_NOT_FOUND');
    }

    delete this.config.sites[siteId];
  }

  /**
   * 설정 파일에서 설정을 로드합니다
   * 
   * JSON 형식의 설정 파일을 읽어서 현재 설정과 병합합니다.
   * 기존 설정은 유지되고, 파일의 설정으로 덮어씁니다.
   * 
   * @param filePath - 설정 파일 경로
   * @param mockData - 테스트용 모의 데이터 (테스트 환경에서만 사용)
   * @throws {ConfigurationError} 파일을 찾을 수 없거나 형식이 잘못된 경우
   */
  async loadFromFile(filePath: string, mockData?: any): Promise<void> {
    try {
      let configData: any;

      if (mockData) {
        // 테스트용 모의 데이터 사용
        configData = mockData;
      } else {
        // 실제 파일에서 로드
        if (!existsSync(filePath)) {
          throw new ConfigurationError('Configuration file not found', 'FILE_NOT_FOUND');
        }
        
        const fileContent = readFileSync(filePath, 'utf8');
        configData = JSON.parse(fileContent);
      }

      // 설정 유효성 검증
      this.validateConfigData(configData);

      // 기존 설정과 병합
      this.mergeConfigData(configData);

    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      
      if (error instanceof SyntaxError) {
        throw new ConfigurationError('Invalid configuration file format: Invalid JSON', 'INVALID_JSON');
      }
      
      throw new ConfigurationError(
        `Failed to load configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FILE_LOAD_ERROR'
      );
    }
  }

  /**
   * 현재 설정을 JSON 문자열로 내보냅니다
   * 
   * @param pretty - 포맷팅 여부 (기본값: true)
   * @returns JSON 형식의 설정 문자열
   */
  exportConfig(pretty: boolean = true): string {
    return JSON.stringify(this.config, null, pretty ? 2 : 0);
  }

  /**
   * 사이트 설정만 JSON 문자열로 내보냅니다
   * 
   * @param pretty - 포맷팅 여부 (기본값: true)
   * @returns JSON 형식의 사이트 설정 문자열
   */
  exportSiteConfigs(pretty: boolean = true): string {
    return JSON.stringify({ sites: this.config.sites }, null, pretty ? 2 : 0);
  }

  /**
   * 등록된 사이트 목록을 반환합니다
   * 
   * @returns 사이트 ID 배열
   */
  getSiteIds(): string[] {
    return Object.keys(this.config.sites);
  }

  /**
   * 특정 사이트의 설정을 반환합니다
   * 
   * @param siteId - 사이트 식별자
   * @returns 사이트 설정 (깊은 복사본)
   * @throws {ConfigurationError} 사이트가 존재하지 않는 경우
   */
  getSiteConfig(siteId: string): NewsSiteConfig {
    if (!this.config.sites[siteId]) {
      throw new ConfigurationError(`Site configuration '${siteId}' not found`, 'SITE_NOT_FOUND');
    }
    
    return this.deepClone(this.config.sites[siteId]);
  }

  /**
   * 객체의 깊은 복사본을 생성합니다
   * 
   * @param obj - 복사할 객체
   * @returns 깊은 복사본
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 설정 데이터를 현재 설정과 병합합니다
   * 
   * @param configData - 병합할 설정 데이터
   */
  private mergeConfigData(configData: any): void {
    if (configData.sites) {
      this.config.sites = { ...this.config.sites, ...configData.sites };
    }

    if (configData.output) {
      this.config.output = { ...this.config.output, ...configData.output };
    }

    if (configData.browser) {
      this.config.browser = { ...this.config.browser, ...configData.browser };
    }
  }

  /**
   * 사이트 설정의 유효성을 검증합니다
   * 
   * @param siteConfig - 검증할 사이트 설정
   * @throws {ConfigurationError} 설정이 유효하지 않은 경우
   */
  private validateSiteConfig(siteConfig: NewsSiteConfig): void {
    if (!siteConfig.name || !siteConfig.baseUrl || !siteConfig.selectors || !siteConfig.urlPatterns) {
      throw new ConfigurationError('Invalid site configuration: missing required fields', 'MISSING_REQUIRED_FIELDS');
    }

    // 선택자 필드 존재 여부 및 빈 값 검증
    const selectors = siteConfig.selectors;
    
    // 빈 선택자 먼저 검증
    if ((selectors.title !== undefined && selectors.title === '') ||
        (selectors.content !== undefined && selectors.content === '') ||
        (selectors.author !== undefined && selectors.author === '') ||
        (selectors.publishDate !== undefined && selectors.publishDate === '')) {
      throw new ConfigurationError('Invalid selector configuration: selectors cannot be empty', 'EMPTY_SELECTORS');
    }

    // 필수 선택자 존재 여부 검증
    if (!selectors.title || !selectors.content || 
        !selectors.author || !selectors.publishDate) {
      throw new ConfigurationError('Invalid site configuration: missing required selectors', 'MISSING_SELECTORS');
    }

    if (!Array.isArray(siteConfig.urlPatterns) || siteConfig.urlPatterns.length === 0) {
      throw new ConfigurationError('Invalid site configuration: urlPatterns must be a non-empty array', 'INVALID_URL_PATTERNS');
    }

    // URL 형식 검증
    try {
      new URL(siteConfig.baseUrl);
    } catch {
      throw new ConfigurationError('Invalid site configuration: baseUrl must be a valid URL', 'INVALID_BASE_URL');
    }
  }

  /**
   * 설정 데이터의 유효성을 검증합니다
   * 
   * @param configData - 검증할 설정 데이터
   * @throws {ConfigurationError} 설정 형식이 유효하지 않은 경우
   */
  private validateConfigData(configData: any): void {
    if (configData.sites) {
      for (const [siteId, siteConfig] of Object.entries(configData.sites)) {
        if (!siteConfig || typeof siteConfig !== 'object') {
          throw new ConfigurationError(
            `Invalid configuration format: site '${siteId}' is not a valid object`,
            'INVALID_SITE_OBJECT'
          );
        }

        const config = siteConfig as any;
        if (!config.name || !config.baseUrl || !config.selectors) {
          throw new ConfigurationError(
            'Invalid configuration format: missing required fields in site configuration',
            'MISSING_SITE_FIELDS'
          );
        }
      }
    }
  }
} 