/**
 * 뉴스 사이트 설정 관리 모듈
 * 다양한 뉴스 사이트별 설정을 관리하고 검증하는 기능을 제공합니다.
 */

/**
 * 뉴스 사이트의 DOM 선택자 설정
 */
export interface NewsSiteSelectors {
  /** 기사 제목 선택자 (필수) */
  title: string;
  /** 기사 본문 선택자 (필수) */
  content: string;
  /** 작성자 선택자 (필수) */
  author: string;
  /** 발행일 선택자 (필수) */
  publishDate: string;
  /** 카테고리 선택자 (선택사항) */
  category?: string;
}

/**
 * 개별 뉴스 사이트 설정
 */
export interface NewsSiteConfig {
  /** 뉴스 사이트 식별자 */
  name: string;
  /** 뉴스 사이트 기본 URL */
  baseUrl: string;
  /** DOM 선택자 설정 */
  selectors: NewsSiteSelectors;
  /** 크롤링 대상 URL 패턴 목록 */
  urlPatterns: string[];
  /** 페이지 로딩 대기 옵션 */
  waitOptions: {
    /** 타임아웃 (밀리초) */
    timeout: number;
    /** 페이지 로딩 완료 조건 */
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  };
}

/**
 * 전체 뉴스 크롤러 설정
 */
export interface NewsConfig {
  /** 뉴스 사이트별 설정 맵 */
  sites: Record<string, NewsSiteConfig>;
  /** 결과 출력 설정 */
  output: {
    /** 출력 파일 형식 */
    format: 'json' | 'csv';
    /** 출력 디렉터리 경로 */
    directory: string;
  };
  /** 브라우저 설정 */
  browser: {
    /** 헤드리스 모드 여부 */
    headless: boolean;
    /** 브라우저 타임아웃 (밀리초) */
    timeout: number;
  };
}

/**
 * 뉴스 설정 유효성 검증 함수
 */
export function validateConfig(config: NewsConfig): void {
  if (!config.sites || Object.keys(config.sites).length === 0) {
    throw new Error('At least one news site must be configured');
  }

  if (!['json', 'csv'].includes(config.output.format)) {
    throw new Error('Output format must be json or csv');
  }

  for (const [siteName, siteConfig] of Object.entries(config.sites)) {
    if (!siteConfig.selectors.title || !siteConfig.selectors.content) {
      throw new Error(`Site ${siteName} must have title and content selectors`);
    }
  }
}

/**
 * 기본 뉴스 설정
 */
export const defaultConfig: NewsConfig = {
  sites: {
    'example-news': {
      name: 'example-news',
      baseUrl: 'https://example.com',
      selectors: {
        title: 'h1',
        content: '.content',
        author: '.author',
        publishDate: '.date'
      },
      urlPatterns: ['https://example.com/news/*'],
      waitOptions: { timeout: 30000 }
    }
  },
  output: {
    format: 'json',
    directory: './results'
  },
  browser: {
    headless: true,
    timeout: 30000
  }
}; 