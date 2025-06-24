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
  
  // 카테고리 네비게이션 관련 선택자
  /** 카테고리 메뉴 컨테이너 선택자 */
  categoryMenu?: string;
  /** 개별 카테고리 아이템 선택자 */
  categoryItem?: string;
  /** 카테고리 링크 선택자 */
  categoryLink?: string;
  /** 서브 카테고리 메뉴 선택자 */
  subCategoryMenu?: string;
  /** 서브 카테고리 아이템 선택자 */
  subCategoryItem?: string;
  /** 메인 카테고리 컨테이너 선택자 */
  mainCategories?: string;
  /** 서브 카테고리 컨테이너 선택자 */
  subCategories?: string;
  /** 카테고리 브레드크럼 선택자 */
  categoryBreadcrumb?: string;
  /** 카테고리 필터 선택자 */
  categoryFilter?: string;
  /** 카테고리 드롭다운 선택자 */
  categoryDropdown?: string;
  /** 카테고리 검색 선택자 */
  categorySearch?: string;
  /** 모바일 메뉴 토글 선택자 */
  mobileMenuToggle?: string;
  /** 모바일 카테고리 선택자 */
  mobileCategory?: string;
  /** 카테고리 슬라이더 선택자 */
  categorySlider?: string;
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
  
  /** 카테고리 네비게이션 설정 */
  categories?: {
    /** 메인 카테고리 목록 */
    main: string[];
    /** 서브 카테고리 매핑 */
    subCategories: Record<string, string[]>;
    /** 카테고리별 URL 패턴 */
    urlPatterns: Record<string, string>;
    /** 카테고리 캐시 설정 */
    cache?: {
      /** 캐시 활성화 여부 */
      enabled: boolean;
      /** 캐시 만료 시간 (밀리초) */
      ttl: number;
      /** 최대 캐시 크기 */
      maxSize: number;
    };
    /** 동적 로딩 설정 */
    dynamicLoading?: {
      /** AJAX 로딩 지원 여부 */
      ajax: boolean;
      /** 무한 스크롤 지원 여부 */
      infiniteScroll: boolean;
      /** 필터링 지원 여부 */
      filtering: boolean;
    };
    /** 모바일 지원 설정 */
    mobile?: {
      /** 반응형 메뉴 지원 여부 */
      responsive: boolean;
      /** 터치 제스처 지원 여부 */
      gestures: boolean;
      /** 슬라이더 네비게이션 여부 */
      slider: boolean;
    };
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
        publishDate: '.date',
        // 카테고리 네비게이션 선택자
        categoryMenu: '.category-menu',
        categoryItem: '.category-item',
        categoryLink: '.category-link',
        subCategoryMenu: '.sub-category-menu',
        subCategoryItem: '.sub-category-item',
        mainCategories: '.main-categories',
        subCategories: '.sub-categories',
        categoryBreadcrumb: '.category-breadcrumb',
        categoryFilter: '.category-filter',
        categoryDropdown: '.category-dropdown',
        categorySearch: '.category-search',
        mobileMenuToggle: '.mobile-menu-toggle',
        mobileCategory: '.mobile-category',
        categorySlider: '.category-slider'
      },
      urlPatterns: ['https://example.com/news/*'],
      waitOptions: { timeout: 30000 },
      requestDelay: 1000,
      // 카테고리 네비게이션 설정
      categories: {
        main: ['정치', '경제', '사회', '국제', '문화', 'IT', '스포츠'],
        subCategories: {
          '정치': ['대통령실', '국회/정당', '북한', '행정', '국방/외교', '정치일반'],
          '경제': ['금융', '증권', '부동산', '글로벌경제', '생활경제', '경제일반'],
          '사회': ['사건사고', '교육', '노동', '언론', '환경', '인권', '사회일반'],
          '국제': ['미국/중국', '일본', '유럽', '러시아', '중동', '아시아', '국제일반'],
          '문화': ['연예', '방송', '음악', '영화', '미술', '문학', '문화일반'],
          'IT': ['모바일', '인터넷', 'SNS', '컴퓨터', '게임', 'AI', 'IT일반'],
          '스포츠': ['야구', '축구', '농구', '배구', '골프', '테니스', '스포츠일반']
        },
        urlPatterns: {
          '정치': '/politics',
          '경제': '/economy',
          '사회': '/society',
          '국제': '/world',
          '문화': '/culture',
          'IT': '/tech',
          '스포츠': '/sports'
        },
        cache: {
          enabled: true,
          ttl: 300000, // 5분
          maxSize: 100
        },
        dynamicLoading: {
          ajax: true,
          infiniteScroll: true,
          filtering: true
        },
        mobile: {
          responsive: true,
          gestures: true,
          slider: true
        }
      }
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