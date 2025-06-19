import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnvironmentConfig, mergeWithDefaults } from '../src/env-loader';

describe('Environment Configuration', () => {
  beforeEach(() => {
    // 테스트용 환경변수 설정
    process.env.NEWS_OUTPUT_FORMAT = 'csv';
    process.env.NEWS_OUTPUT_DIR = './test-results';
    process.env.NEWS_BROWSER_HEADLESS = 'false';
    process.env.NEWS_TIMEOUT = '45000';
  });

  afterEach(() => {
    // 환경변수 정리
    delete process.env.NEWS_OUTPUT_FORMAT;
    delete process.env.NEWS_OUTPUT_DIR;
    delete process.env.NEWS_BROWSER_HEADLESS;
    delete process.env.NEWS_TIMEOUT;
  });

  it('should load configuration from environment variables', () => {
    const envConfig = loadEnvironmentConfig();
    
    expect(envConfig.output.format).toBe('csv');
    expect(envConfig.output.directory).toBe('./test-results');
    expect(envConfig.browser.headless).toBe(false);
    expect(envConfig.browser.timeout).toBe(45000);
  });

  it('should merge environment config with defaults', () => {
    const envConfig = loadEnvironmentConfig();
    const finalConfig = mergeWithDefaults(envConfig);
    
    expect(finalConfig.output.format).toBe('csv'); // from env
    expect(finalConfig.sites).toBeDefined(); // from defaults
    expect(finalConfig.sites['example-news']).toBeDefined();
  });

  it('should handle missing environment variables gracefully', () => {
    // 모든 환경변수 제거
    delete process.env.NEWS_OUTPUT_FORMAT;
    delete process.env.NEWS_OUTPUT_DIR;
    delete process.env.NEWS_BROWSER_HEADLESS;
    delete process.env.NEWS_TIMEOUT;
    
    const envConfig = loadEnvironmentConfig();
    const finalConfig = mergeWithDefaults(envConfig);
    
    expect(finalConfig.output.format).toBe('json'); // default value
    expect(finalConfig.output.directory).toBe('./results'); // default value
  });

  it('should validate boolean environment variables', () => {
    process.env.NEWS_BROWSER_HEADLESS = 'true';
    
    const envConfig = loadEnvironmentConfig();
    expect(envConfig.browser.headless).toBe(true);
    
    process.env.NEWS_BROWSER_HEADLESS = 'false';
    const envConfig2 = loadEnvironmentConfig();
    expect(envConfig2.browser.headless).toBe(false);
  });

  it('should validate numeric environment variables', () => {
    process.env.NEWS_TIMEOUT = '60000';
    
    const envConfig = loadEnvironmentConfig();
    expect(envConfig.browser.timeout).toBe(60000);
    expect(typeof envConfig.browser.timeout).toBe('number');
  });
}); 