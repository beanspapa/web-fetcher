/**
 * 환경변수 로딩 및 설정 병합 모듈
 * 
 * 이 모듈은 .env 파일과 환경변수에서 뉴스 크롤러 설정을 로드하고,
 * 기본 설정과 병합하여 최종 설정을 생성합니다.
 * 
 * 지원하는 환경변수:
 * - NEWS_OUTPUT_FORMAT: 출력 형식 (json | csv | xml)
 * - NEWS_OUTPUT_DIR: 출력 디렉터리 경로
 * - NEWS_BROWSER_HEADLESS: 헤드리스 모드 (true | false)
 * - NEWS_TIMEOUT: 브라우저 타임아웃 (밀리초)
 */

import { config as dotenvConfig } from 'dotenv';
import { NewsConfig, defaultConfig } from './config.js';

// .env 파일 로드
dotenvConfig();

/**
 * 환경변수에서 로드할 수 있는 설정 구조
 * 모든 필드는 선택사항이며, 설정되지 않은 경우 기본값을 사용합니다.
 */
export interface EnvironmentConfig {
  output: {
    /** 출력 형식 (json | csv) */
    format?: 'json' | 'csv';
    /** 출력 디렉터리 경로 */
    directory?: string;
  };
  browser: {
    /** 헤드리스 모드 활성화 여부 */
    headless?: boolean;
    /** 브라우저 타임아웃 (밀리초) */
    timeout?: number;
  };
}

/**
 * 환경변수 값을 boolean으로 안전하게 변환합니다
 * @param value - 환경변수 값
 * @returns boolean 값 또는 undefined
 */
function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value.toLowerCase() === 'true';
}

/**
 * 환경변수 값을 number로 안전하게 변환합니다
 * @param value - 환경변수 값
 * @returns number 값 또는 undefined (변환 실패시)
 */
function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * 출력 형식 환경변수를 안전하게 검증합니다
 * @param value - 환경변수 값
 * @returns 유효한 형식 또는 undefined
 */
function parseOutputFormat(value: string | undefined): 'json' | 'csv' | 'xml' | undefined {
  if (value === undefined) return undefined;
  return (value === 'json' || value === 'csv' || value === 'xml') ? value : undefined;
}

/**
 * 환경변수에서 뉴스 크롤러 설정을 로드합니다
 * 
 * 이 함수는 다음 환경변수들을 읽어서 설정 객체를 생성합니다:
 * - NEWS_OUTPUT_FORMAT: 출력 형식
 * - NEWS_OUTPUT_DIR: 출력 디렉터리
 * - NEWS_BROWSER_HEADLESS: 헤드리스 모드
 * - NEWS_TIMEOUT: 브라우저 타임아웃
 * 
 * @returns 환경변수에서 로드된 설정 (설정되지 않은 값은 undefined)
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  return {
    output: {
      format: (process.env.NEWS_OUTPUT_FORMAT as 'json' | 'csv') || undefined,
      directory: process.env.NEWS_OUTPUT_DIR || undefined,
    },
    browser: {
      headless: process.env.NEWS_BROWSER_HEADLESS ? process.env.NEWS_BROWSER_HEADLESS === 'true' : undefined,
      timeout: process.env.NEWS_TIMEOUT ? parseInt(process.env.NEWS_TIMEOUT, 10) : undefined,
    },
  };
}

/**
 * 환경변수 설정을 기본값과 병합합니다
 * 
 * 환경변수에서 설정된 값이 있으면 해당 값을 사용하고,
 * 없으면 기본값을 사용합니다.
 * 
 * @param envConfig - 환경변수에서 로드된 설정
 * @returns 기본값과 병합된 최종 설정
 */
export function mergeWithDefaults(envConfig: EnvironmentConfig): NewsConfig {
  return {
    ...defaultConfig,
    output: {
      ...defaultConfig.output,
      ...(envConfig.output.format && { format: envConfig.output.format }),
      ...(envConfig.output.directory && { directory: envConfig.output.directory }),
    },
    browser: {
      ...defaultConfig.browser,
      ...(envConfig.browser.headless !== undefined && { headless: envConfig.browser.headless }),
      ...(envConfig.browser.timeout && { timeout: envConfig.browser.timeout }),
    },
  };
}

/**
 * 환경변수와 기본값을 병합한 최종 설정을 로드합니다
 * 
 * 이 함수는 loadEnvironmentConfig()와 mergeWithDefaults()를 
 * 조합한 편의 함수입니다.
 * 
 * @returns 최종 뉴스 크롤러 설정
 */
export function loadConfig(): NewsConfig {
  const envConfig = loadEnvironmentConfig();
  return mergeWithDefaults(envConfig);
} 