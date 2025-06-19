import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigManager } from '../src/config-manager';
import type { NewsConfig, NewsSiteConfig } from '../src/config';

describe('Configuration Merger', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  describe('기본 설정 관리', () => {
    it('should load default configuration', () => {
      const config = configManager.getConfig();
      
      expect(config).toBeDefined();
      expect(config.sites).toBeDefined();
      expect(config.sites['example-news']).toBeDefined();
      expect(config.output.format).toBe('json');
      expect(config.browser.headless).toBe(true);
    });

    it('should merge environment variables with defaults', () => {
      // 환경변수 설정
      process.env.NEWS_OUTPUT_FORMAT = 'csv';
      process.env.NEWS_BROWSER_HEADLESS = 'false';
      
      const config = configManager.loadFromEnvironment().getConfig();
      
      expect(config.output.format).toBe('csv');
      expect(config.browser.headless).toBe(false);
      expect(config.sites['example-news']).toBeDefined(); // 기본값 유지
      
      // 환경변수 정리
      delete process.env.NEWS_OUTPUT_FORMAT;
      delete process.env.NEWS_BROWSER_HEADLESS;
    });
  });

  describe('사이트별 설정 관리', () => {
    it('should add new site configuration', () => {
      const newSiteConfig: NewsSiteConfig = {
        name: 'test-news',
        baseUrl: 'https://test-news.com',
        selectors: {
          title: 'h1.title',
          content: '.article-content',
          author: '.author-name',
          publishDate: '.publish-date'
        },
        urlPatterns: ['/news/', '/article/'],
        requestDelay: 2000
      };

      configManager.addSiteConfig('test-news', newSiteConfig);
      const config = configManager.getConfig();
      
      expect(config.sites['test-news']).toEqual(newSiteConfig);
      expect(Object.keys(config.sites)).toContain('test-news');
    });

    it('should update existing site configuration', () => {
      const updatedConfig: Partial<NewsSiteConfig> = {
        requestDelay: 3000,
        selectors: {
          title: 'h2.new-title',
          content: '.new-content',
          author: '.new-author',
          publishDate: '.new-date'
        }
      };

      configManager.updateSiteConfig('example-news', updatedConfig);
      const config = configManager.getConfig();
      
      expect(config.sites['example-news'].requestDelay).toBe(3000);
      expect(config.sites['example-news'].selectors.title).toBe('h2.new-title');
      expect(config.sites['example-news'].name).toBe('Example News'); // 기존값 유지
    });

    it('should remove site configuration', () => {
      configManager.removeSiteConfig('example-news');
      const config = configManager.getConfig();
      
      expect(config.sites['example-news']).toBeUndefined();
      expect(Object.keys(config.sites)).not.toContain('example-news');
    });
  });

  describe('설정 파일 로딩', () => {
    it('should load configuration from JSON file', async () => {
      const testConfig = {
        sites: {
          'json-news': {
            name: 'JSON News',
            baseUrl: 'https://json-news.com',
            selectors: {
              title: '.json-title',
              content: '.json-content',
              author: '.json-author',
              publishDate: '.json-date'
            },
            urlPatterns: ['/json/'],
            requestDelay: 1500
          }
        },
        output: {
          format: 'csv' as const,
          directory: './json-results'
        }
      };

      await configManager.loadFromFile('./test-config.json', testConfig);
      const config = configManager.getConfig();
      
      expect(config.sites['json-news']).toBeDefined();
      expect(config.output.format).toBe('csv');
      expect(config.output.directory).toBe('./json-results');
    });

    it('should handle missing configuration file gracefully', async () => {
      await expect(
        configManager.loadFromFile('./non-existent-config.json')
      ).rejects.toThrow('Configuration file not found');
    });

    it('should validate configuration file format', async () => {
      const invalidConfig = {
        sites: {
          'invalid-site': {
            name: 'Invalid Site'
            // 필수 필드 누락
          }
        }
      };

      await expect(
        configManager.loadFromFile('./invalid-config.json', invalidConfig)
      ).rejects.toThrow('Invalid configuration format');
    });
  });

  describe('설정 검증', () => {
    it('should validate site configuration completeness', () => {
      const incompleteConfig = {
        name: 'Incomplete Site',
        baseUrl: 'https://incomplete.com'
        // selectors, urlPatterns 누락
      };

      expect(() => {
        configManager.addSiteConfig('incomplete', incompleteConfig as NewsSiteConfig);
      }).toThrow('Invalid site configuration');
    });

    it('should validate selector format', () => {
      const invalidSelectorConfig: NewsSiteConfig = {
        name: 'Invalid Selector Site',
        baseUrl: 'https://invalid.com',
        selectors: {
          title: '', // 빈 선택자
          content: '.content',
          author: '.author',
          publishDate: '.date'
        },
        urlPatterns: ['/news/'],
        requestDelay: 1000
      };

      expect(() => {
        configManager.addSiteConfig('invalid-selector', invalidSelectorConfig);
      }).toThrow('Invalid selector configuration');
    });
  });

  describe('설정 내보내기', () => {
    it('should export current configuration to JSON', () => {
      const exported = configManager.exportConfig();
      
      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported)).not.toThrow();
      
      const parsed = JSON.parse(exported);
      expect(parsed.sites).toBeDefined();
      expect(parsed.output).toBeDefined();
      expect(parsed.browser).toBeDefined();
    });

    it('should export only site configurations', () => {
      const exported = configManager.exportSiteConfigs();
      
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed.sites).toBeDefined();
      expect(parsed.output).toBeUndefined();
      expect(parsed.browser).toBeUndefined();
    });
  });
}); 