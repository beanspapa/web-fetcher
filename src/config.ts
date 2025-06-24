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
  /** 기사 목록 컨테이너 선택자 (동적 로딩용) */
  articleList?: string;
  /** 개별 기사 링크 선택자 (동적 로딩용) */
  articleLink?: string;
  /** 기사 요약/발췌 선택자 (동적 로딩용) */
  excerpt?: string;
  /** "더보기" 버튼 선택자 (동적 로딩용) */
  loadMoreButton?: string;
  /** 무한 스크롤 트리거 선택자 (동적 로딩용) */
  infiniteScrollTrigger?: string;
  /** 페이지네이션 컨테이너 선택자 */
  pagination?: string;
  /** 다음 페이지 버튼 선택자 */
  nextButton?: string;
  /** 이전 페이지 버튼 선택자 */
  prevButton?: string;
  /** 페이지 번호 선택자 */
  pageNumbers?: string;
  /** 현재 페이지 선택자 */
  currentPage?: string;
  /** 전체 페이지 수 선택자 */
  totalPages?: string;
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
  /** 요청 간 지연 시간 (밀리초) */
  requestDelay?: number;
  /** 페이지네이션 설정 */
  pagination?: {
    /** 페이지네이션 타입 */
    type: 'numbered' | 'next-prev' | 'load-more';
    /** 최대 페이지 수 */
    maxPages?: number;
    /** 페이지당 기사 수 */
    pageSize?: number;
    /** URL 패턴 (페이지 번호 기반) */
    urlPattern?: string;
    /** 자동 감지 여부 */
    autoDetect?: boolean;
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
  output: {
    format: 'json',
    directory: './results'
  },
  browser: {
    headless: true,
    timeout: 30000
  }
}; 