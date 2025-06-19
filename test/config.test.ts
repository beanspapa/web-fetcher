import { describe, it, expect } from 'vitest';
import { NewsConfig, NewsSiteConfig, validateConfig } from '../src/config.js';

describe('News Configuration Types', () => {
  it('should define valid news site configuration', () => {
    const siteConfig: NewsSiteConfig = {
      name: 'example-news',
      baseUrl: 'https://example-news.com',
      selectors: {
        title: 'h1.article-title',
        content: '.article-content',
        author: '.author-name',
        publishDate: '.publish-date',
        category: '.category'
      },
      urlPatterns: [
        'https://example-news.com/article/*',
        'https://example-news.com/news/*'
      ],
      waitOptions: {
        timeout: 30000,
        waitUntil: 'networkidle'
      }
    };

    expect(siteConfig.name).toBe('example-news');
    expect(siteConfig.selectors.title).toBe('h1.article-title');
    expect(siteConfig.urlPatterns).toHaveLength(2);
  });

  it('should validate complete news configuration', () => {
    const config: NewsConfig = {
      sites: {
        'example-news': {
          name: 'example-news',
          baseUrl: 'https://example-news.com',
          selectors: {
            title: 'h1',
            content: '.content',
            author: '.author',
            publishDate: '.date'
          },
          urlPatterns: ['https://example-news.com/*'],
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

    expect(() => validateConfig(config)).not.toThrow();
    expect(config.sites['example-news']).toBeDefined();
  });

  it('should reject invalid configuration', () => {
    const invalidConfig = {
      sites: {},
      output: { format: 'xml' } // invalid format
    };

    expect(() => validateConfig(invalidConfig as any)).toThrow();
  });
}); 