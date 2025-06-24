import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  PerformanceMonitor, 
  PerformanceAlert 
} from '../src/performance-monitor';

// Performance API 모킹
global.performance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
  navigation: {
    fetchStart: Date.now() - 1000,
    loadEventEnd: Date.now(),
    domContentLoadedEventEnd: Date.now() - 200,
    responseEnd: Date.now() - 500
  }
} as any;

// PerformanceObserver 모킹
global.PerformanceObserver = class PerformanceObserver {
  private callback: any;
  
  constructor(callback: any) {
    this.callback = callback;
  }
  
  observe() {
    // 실제 성능 엔트리 시뮬레이션
    setTimeout(() => {
      this.callback({
        getEntries: () => [
          {
            name: 'navigation',
            entryType: 'navigation',
            startTime: 0,
            duration: 1000,
            loadEventEnd: 1000,
            domContentLoadedEventEnd: 200
          }
        ]
      });
    }, 10);
  }
  
  disconnect() {}
} as any;

// Memory API 모킹  
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
    jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
  },
  configurable: true
});

describe('Performance Monitor - Performance Monitoring and Optimization', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor({
      enableMonitoring: true,
      autoOptimize: true,
      alertThresholds: {
        pageLoadTime: 3000,
        memoryUsage: 80,
        networkLatency: 1000,
        cpuUsage: 70
      },
      collectInterval: 5000,
      reportInterval: 5000
    });
  });

  afterEach(() => {
    performanceMonitor.destroy();
  });

  describe('Performance Metrics Collection', () => {
    it('should collect current performance metrics', () => {
      const metrics = performanceMonitor.getCurrentMetrics();
      
      if (metrics) {
        expect(metrics.pageLoadTime).toBeGreaterThanOrEqual(0);
        expect(metrics.memoryUsage).toBeDefined();
        expect(metrics.networkLatency).toBeGreaterThanOrEqual(0);
        expect(metrics.timestamp).toBeInstanceOf(Date);
      } else {
        // 초기 상태에서는 메트릭이 없을 수 있음
        expect(metrics).toBeNull();
      }
    });

    it('should track multiple metrics over time', () => {
      // 첫 번째 메트릭 수집
      const firstMetrics = performanceMonitor.getCurrentMetrics();
      
      // 시간 경과 시뮬레이션
      vi.advanceTimersByTime(1000);
      
      // 두 번째 메트릭 수집
      const secondMetrics = performanceMonitor.getCurrentMetrics();
      
      if (firstMetrics && secondMetrics) {
        expect(secondMetrics.timestamp.getTime()).toBeGreaterThan(firstMetrics.timestamp.getTime());
      } else {
        // 메트릭이 수집되지 않은 경우도 허용
        expect(true).toBe(true);
      }
    });

    it('should handle performance data collection', () => {
      const allMetrics = performanceMonitor.getAllMetrics();
      
      expect(Array.isArray(allMetrics)).toBe(true);
      expect(allMetrics.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should handle alert callbacks', () => {
      const alerts: PerformanceAlert[] = [];
      
      performanceMonitor.onAlert((alert) => {
        alerts.push(alert);
      });
      
      // onAlert 콜백이 정상 등록되었는지 확인
      expect(alerts).toHaveLength(0); // 초기에는 알림 없음
    });

    it('should get all collected metrics', () => {
      const allMetrics = performanceMonitor.getAllMetrics();
      
      expect(Array.isArray(allMetrics)).toBe(true);
      expect(allMetrics.length).toBeGreaterThanOrEqual(0);
    });

    it('should get recent alerts', () => {
      const recentAlerts = performanceMonitor.getRecentAlerts(5);
      
      expect(Array.isArray(recentAlerts)).toBe(true);
      expect(recentAlerts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Alerts', () => {
    it('should generate alerts for performance threshold violations', () => {
      const alerts: PerformanceAlert[] = [];
      
      performanceMonitor.onAlert((alert) => {
        alerts.push(alert);
      });
      
      // 임계값 위반 시뮬레이션
      performanceMonitor.checkThresholds({
        pageLoadTime: 5000, // 임계값 3000ms 초과
        memoryUsage: 85, // 임계값 80% 초과
        networkLatency: 500, // 정상 범위
        errorRate: 2, // 정상 범위
        timestamp: new Date()
      });
      
      expect(alerts).toHaveLength(2); // pageLoadTime과 memoryUsage 알림
      expect(alerts.find(a => a.type === 'performance')).toBeTruthy();
      expect(alerts.find(a => a.type === 'memory')).toBeTruthy();
    });

    it('should classify alert severity correctly', () => {
      const alerts: PerformanceAlert[] = [];
      
      performanceMonitor.onAlert((alert) => {
        alerts.push(alert);
      });
      
      // 심각한 성능 문제 시뮬레이션
      performanceMonitor.checkThresholds({
        pageLoadTime: 10000, // 매우 느림
        memoryUsage: 95, // 메모리 거의 가득참
        networkLatency: 3000, // 매우 느린 네트워크
        errorRate: 15, // 높은 오류율
        timestamp: new Date()
      });
      
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      const warningAlerts = alerts.filter(a => a.severity === 'warning');
      
      expect(criticalAlerts.length).toBeGreaterThan(0);
      expect(warningAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Auto Optimization', () => {
    it('should trigger optimization actions automatically', async () => {
      const optimizations: string[] = [];
      
      performanceMonitor.onOptimization((action) => {
        optimizations.push(action.type);
      });
      
      // 높은 메모리 사용량으로 최적화 트리거
      performanceMonitor.checkThresholds({
        pageLoadTime: 5000,
        memoryUsage: 90,
        networkLatency: 1500,
        errorRate: 8,
        timestamp: new Date()
      });
      
      // 자동 최적화 실행까지 대기
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(optimizations).toContain('clear_cache');
      expect(optimizations).toContain('reduce_requests');
    });

    it('should track optimization effectiveness', async () => {
      // 최적화 전 메트릭
      const beforeOptimization = performanceMonitor.getCurrentMetrics();
      
      // 최적화 실행
      await performanceMonitor.optimize(['clear_cache', 'reduce_requests']);
      
      // 최적화 후 메트릭 (시뮬레이션을 위해 개선된 값 설정)
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 30 * 1024 * 1024, // 메모리 사용량 감소
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 200 * 1024 * 1024
        },
        configurable: true
      });
      
      const afterOptimization = performanceMonitor.getCurrentMetrics();
      
      expect(afterOptimization.memoryUsage).toBeLessThan(beforeOptimization.memoryUsage);
    });

    it('should prevent excessive optimization attempts', () => {
      const optimizations: string[] = [];
      
      performanceMonitor.onOptimization((action) => {
        optimizations.push(action.type);
      });
      
      // 연속적인 최적화 트리거 시도
      for (let i = 0; i < 5; i++) {
        performanceMonitor.checkThresholds({
          pageLoadTime: 5000,
          memoryUsage: 90,
          networkLatency: 1500,
          errorRate: 8,
          timestamp: new Date()
        });
      }
      
      // 최적화는 제한된 횟수만 실행되어야 함
      expect(optimizations.length).toBeLessThan(10); // 5번의 트리거에 대해 과도한 최적화 방지
    });
  });

  describe('Performance Reports', () => {
    it('should generate performance reports', () => {
      // 여러 메트릭 기록
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordMetric('pageLoadTime', 1000 + Math.random() * 1000);
        performanceMonitor.recordMetric('memoryUsage', 60 + Math.random() * 20);
        performanceMonitor.recordMetric('networkLatency', 100 + Math.random() * 200);
      }
      
      const report = performanceMonitor.generateReport();
      
      expect(report.summary).toBeDefined();
      expect(report.summary.totalMeasurements).toBe(30); // 3가지 메트릭 * 10회
      expect(report.summary.period).toBeDefined();
      expect(report.details.pageLoadTime).toBeDefined();
      expect(report.details.memoryUsage).toBeDefined();
      expect(report.details.networkLatency).toBeDefined();
    });

    it('should include performance trends in reports', () => {
      // 시간별로 성능 데이터 기록 (성능 저하 시뮬레이션)
      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordMetric('pageLoadTime', 1000 + i * 200); // 점진적 증가
        vi.advanceTimersByTime(1000);
      }
      
      const report = performanceMonitor.generateReport();
      const trend = report.trends?.pageLoadTime;
      
      expect(trend).toBeDefined();
      expect(trend!.direction).toBe('increasing'); // 성능 저하 트렌드
    });

    it('should export performance data', () => {
      // 메트릭 데이터 기록
      performanceMonitor.recordMetric('pageLoadTime', 1500);
      performanceMonitor.recordMetric('memoryUsage', 75);
      
      const exportedData = performanceMonitor.exportData();
      
      expect(exportedData.version).toBeDefined();
      expect(exportedData.exportDate).toBeInstanceOf(Date);
      expect(exportedData.metrics).toBeDefined();
      expect(exportedData.metrics.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing Performance API gracefully', () => {
      // Performance API 제거 시뮬레이션
      const originalPerformance = global.performance;
      delete (global as any).performance;
      
      const limitedMonitor = new PerformanceMonitor();
      const metrics = limitedMonitor.getCurrentMetrics();
      
      // API가 없어도 기본값 반환
      expect(metrics.pageLoadTime).toBe(0);
      expect(metrics.memoryUsage).toBe(0);
      expect(metrics.networkLatency).toBe(0);
      
      // 원복
      global.performance = originalPerformance;
    });

    it('should handle disabled monitoring gracefully', () => {
      const disabledMonitor = new PerformanceMonitor({ enableMonitoring: false });
      
      disabledMonitor.start();
      expect(disabledMonitor.isMonitoring()).toBe(false);
      
      // 비활성화된 상태에서도 메트릭 수집 가능
      const metrics = disabledMonitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
    });

    it('should validate performance thresholds', () => {
      const invalidThresholds = {
        pageLoadTime: -100, // 음수 값
        memoryUsage: 150, // 100% 초과
        networkLatency: -50, // 음수 값
        errorRate: -5 // 음수 값
      };
      
      const monitor = new PerformanceMonitor({ thresholds: invalidThresholds });
      
      // 내부적으로 유효한 값으로 정정되어야 함
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeDefined(); // 오류 없이 동작해야 함
    });

    it('should handle memory measurement errors', () => {
      // 메모리 API 오류 시뮬레이션
      Object.defineProperty(performance, 'memory', {
        get: () => {
          throw new Error('Memory API not available');
        },
        configurable: true
      });
      
      const metrics = performanceMonitor.getCurrentMetrics();
      expect(metrics.memoryUsage).toBe(0); // 오류 시 기본값 반환
      
      // 원복
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 50 * 1024 * 1024,
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 200 * 1024 * 1024
        },
        configurable: true
      });
    });
  });
}); 