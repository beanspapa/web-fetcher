// 성능 모니터링 관련 인터페이스
export interface PerformanceMetrics {
  pageLoadTime: number; // ms
  domContentLoaded: number; // ms
  firstContentfulPaint: number; // ms
  memoryUsage: MemoryInfo;
  networkLatency: number; // ms
  timestamp: Date;
}

export interface MemoryInfo {
  usedJSHeapSize: number; // bytes
  totalJSHeapSize: number; // bytes
  jsHeapSizeLimit: number; // bytes
}

export interface PerformanceThresholds {
  pageLoadTime: number; // ms
  memoryUsage: number; // percentage
  networkLatency: number; // ms
  cpuUsage: number; // percentage
}

export interface PerformanceAlert {
  type: 'slow_page' | 'high_memory' | 'high_latency' | 'poor_connection';
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  recommendations: string[];
}

export interface OptimizationAction {
  type: 'clear_cache' | 'reduce_requests' | 'compress_images' | 'defer_scripts';
  priority: 'low' | 'medium' | 'high';
  expectedImprovement: number; // percentage
  description: string;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  averageMetrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  optimizations: OptimizationAction[];
  trends: {
    improvement: number; // percentage
    degradation: number; // percentage
  };
}

export interface PerformanceOptions {
  enableMonitoring: boolean;
  collectInterval: number; // ms
  alertThresholds: PerformanceThresholds;
  maxHistorySize: number;
  autoOptimize: boolean;
  reportInterval: number; // ms
}

// 성능 모니터링 관리자
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private options: PerformanceOptions;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private reportTimer: NodeJS.Timeout | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private onAlertCallbacks: ((alert: PerformanceAlert) => void)[] = [];
  private onReportCallbacks: ((report: PerformanceReport) => void)[] = [];

  constructor(options: Partial<PerformanceOptions> = {}) {
    this.options = {
      enableMonitoring: true,
      collectInterval: 10000, // 10초
      alertThresholds: {
        pageLoadTime: 3000, // 3초
        memoryUsage: 80, // 80%
        networkLatency: 1000, // 1초
        cpuUsage: 70 // 70%
      },
      maxHistorySize: 1000,
      autoOptimize: false,
      reportInterval: 300000, // 5분
      ...options
    };

    if (this.options.enableMonitoring) {
      this.startMonitoring();
    }
  }

  // 모니터링 시작
  private startMonitoring(): void {
    this.initializePerformanceObserver();
    this.startPeriodicCollection();
    this.startPeriodicReporting();
  }

  // Performance Observer 초기화
  private initializePerformanceObserver(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          this.processPerformanceEntries(entries);
        });

        // 여러 타입의 성능 항목 관찰
        this.performanceObserver.observe({ 
          entryTypes: ['navigation', 'paint', 'measure', 'mark'] 
        });
      } catch (error) {
        console.warn('Performance Observer not fully supported:', error);
      }
    }
  }

  // 성능 항목 처리
  private processPerformanceEntries(entries: PerformanceEntry[]): void {
    for (const entry of entries) {
      if (entry.entryType === 'navigation') {
        this.processNavigationEntry(entry as PerformanceNavigationTiming);
      } else if (entry.entryType === 'paint') {
        this.processPaintEntry(entry as PerformancePaintTiming);
      }
    }
  }

  // 네비게이션 타이밍 처리
  private processNavigationEntry(entry: PerformanceNavigationTiming): void {
    const pageLoadTime = entry.loadEventEnd - entry.fetchStart;
    const domContentLoaded = entry.domContentLoadedEventEnd - entry.fetchStart;
    
    if (pageLoadTime > this.options.alertThresholds.pageLoadTime) {
      this.createAlert('slow_page', 'pageLoadTime', pageLoadTime, 
        this.options.alertThresholds.pageLoadTime, [
          '이미지 압축 및 최적화',
          'CSS/JS 파일 압축',
          'CDN 사용 고려',
          '불필요한 HTTP 요청 제거'
        ]);
    }
  }

  // Paint 타이밍 처리
  private processPaintEntry(entry: PerformancePaintTiming): void {
    if (entry.name === 'first-contentful-paint') {
      const fcp = entry.startTime;
      if (fcp > 2000) { // 2초 임계값
        this.createAlert('slow_page', 'firstContentfulPaint', fcp, 2000, [
          '중요 리소스 우선 로딩',
          '렌더링 블록킹 리소스 최적화',
          '폰트 로딩 최적화'
        ]);
      }
    }
  }

  // 정기적 메트릭 수집
  private startPeriodicCollection(): void {
    this.monitoringTimer = setInterval(() => {
      this.collectCurrentMetrics();
    }, this.options.collectInterval);
  }

  // 현재 메트릭 수집
  private collectCurrentMetrics(): void {
    try {
      const metrics: PerformanceMetrics = {
        pageLoadTime: this.getPageLoadTime(),
        domContentLoaded: this.getDOMContentLoadedTime(),
        firstContentfulPaint: this.getFirstContentfulPaint(),
        memoryUsage: this.getMemoryUsage(),
        networkLatency: this.getNetworkLatency(),
        timestamp: new Date()
      };

      this.addMetrics(metrics);
      this.analyzeMetrics(metrics);
    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }

  // 메트릭 추가
  private addMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);

    // 히스토리 크기 제한
    if (this.metrics.length > this.options.maxHistorySize) {
      this.metrics.shift();
    }
  }

  // 메트릭 분석 및 알림 생성
  private analyzeMetrics(metrics: PerformanceMetrics): void {
    // 페이지 로딩 시간 확인
    if (metrics.pageLoadTime > this.options.alertThresholds.pageLoadTime) {
      this.createAlert('slow_page', 'pageLoadTime', metrics.pageLoadTime,
        this.options.alertThresholds.pageLoadTime, [
          '브라우저 캐시 최적화',
          '리소스 압축 활성화',
          '이미지 lazy loading 적용'
        ]);
    }

    // 메모리 사용량 확인
    const memoryUsagePercent = (metrics.memoryUsage.usedJSHeapSize / 
      metrics.memoryUsage.jsHeapSizeLimit) * 100;
    
    if (memoryUsagePercent > this.options.alertThresholds.memoryUsage) {
      this.createAlert('high_memory', 'memoryUsage', memoryUsagePercent,
        this.options.alertThresholds.memoryUsage, [
          '사용하지 않는 객체 정리',
          '메모리 누수 확인',
          '캐시 크기 조정'
        ]);
    }

    // 네트워크 지연 시간 확인
    if (metrics.networkLatency > this.options.alertThresholds.networkLatency) {
      this.createAlert('high_latency', 'networkLatency', metrics.networkLatency,
        this.options.alertThresholds.networkLatency, [
          '요청 수 최소화',
          'HTTP/2 또는 HTTP/3 사용',
          '지역 CDN 활용'
        ]);
    }
  }

  // 알림 생성
  private createAlert(
    type: PerformanceAlert['type'],
    metric: string,
    value: number,
    threshold: number,
    recommendations: string[]
  ): void {
    const alert: PerformanceAlert = {
      type,
      metric,
      value,
      threshold,
      timestamp: new Date(),
      recommendations
    };

    this.alerts.push(alert);
    this.notifyAlert(alert);

    if (this.options.autoOptimize) {
      this.performAutoOptimization(alert);
    }
  }

  // 자동 최적화 수행
  private performAutoOptimization(alert: PerformanceAlert): void {
    const actions: OptimizationAction[] = [];

    switch (alert.type) {
      case 'slow_page':
        actions.push({
          type: 'clear_cache',
          priority: 'medium',
          expectedImprovement: 15,
          description: '브라우저 캐시 정리로 로딩 속도 개선'
        });
        break;

      case 'high_memory':
        actions.push({
          type: 'clear_cache',
          priority: 'high',
          expectedImprovement: 25,
          description: '메모리 캐시 정리로 메모리 사용량 감소'
        });
        break;

      case 'high_latency':
        actions.push({
          type: 'reduce_requests',
          priority: 'high',
          expectedImprovement: 20,
          description: '불필요한 네트워크 요청 제거'
        });
        break;
    }

    for (const action of actions) {
      this.executeOptimization(action);
    }
  }

  // 최적화 실행
  private executeOptimization(action: OptimizationAction): void {
    try {
      switch (action.type) {
        case 'clear_cache':
          this.clearPerformanceCache();
          break;
        case 'reduce_requests':
          this.optimizeNetworkRequests();
          break;
        case 'compress_images':
          this.optimizeImages();
          break;
        case 'defer_scripts':
          this.deferNonCriticalScripts();
          break;
      }
      console.log(`Optimization executed: ${action.description}`);
    } catch (error) {
      console.error(`Failed to execute optimization ${action.type}:`, error);
    }
  }

  // 성능 캐시 정리
  private clearPerformanceCache(): void {
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100); // 최근 100개만 유지
    }
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50); // 최근 50개만 유지
    }
  }

  // 네트워크 요청 최적화
  private optimizeNetworkRequests(): void {
    // 실제 구현에서는 진행 중인 요청 취소, 배치 처리 등
    console.log('Optimizing network requests...');
  }

  // 이미지 최적화
  private optimizeImages(): void {
    // 실제 구현에서는 이미지 압축, 포맷 변경 등
    console.log('Optimizing images...');
  }

  // 비중요 스크립트 지연 로딩
  private deferNonCriticalScripts(): void {
    // 실제 구현에서는 스크립트 태그 속성 변경
    console.log('Deferring non-critical scripts...');
  }

  // 정기 보고서 생성
  private startPeriodicReporting(): void {
    this.reportTimer = setInterval(() => {
      const report = this.generateReport();
      this.notifyReport(report);
    }, this.options.reportInterval);
  }

  // 성능 보고서 생성
  generateReport(startDate?: Date, endDate?: Date): PerformanceReport {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 24 * 60 * 60 * 1000); // 24시간 전

    const periodMetrics = this.metrics.filter(m => 
      m.timestamp >= start && m.timestamp <= end
    );

    const periodAlerts = this.alerts.filter(a => 
      a.timestamp >= start && a.timestamp <= end
    );

    const averageMetrics = this.calculateAverageMetrics(periodMetrics);
    const optimizations = this.generateOptimizationRecommendations(periodAlerts);
    const trends = this.calculateTrends(periodMetrics);

    return {
      period: { start, end },
      averageMetrics,
      alerts: periodAlerts,
      optimizations,
      trends
    };
  }

  // 평균 메트릭 계산
  private calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    if (metrics.length === 0) {
      return {
        pageLoadTime: 0,
        domContentLoaded: 0,
        firstContentfulPaint: 0,
        memoryUsage: { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 },
        networkLatency: 0,
        timestamp: new Date()
      };
    }

    const sum = metrics.reduce((acc, metric) => ({
      pageLoadTime: acc.pageLoadTime + metric.pageLoadTime,
      domContentLoaded: acc.domContentLoaded + metric.domContentLoaded,
      firstContentfulPaint: acc.firstContentfulPaint + metric.firstContentfulPaint,
      memoryUsage: {
        usedJSHeapSize: acc.memoryUsage.usedJSHeapSize + metric.memoryUsage.usedJSHeapSize,
        totalJSHeapSize: acc.memoryUsage.totalJSHeapSize + metric.memoryUsage.totalJSHeapSize,
        jsHeapSizeLimit: acc.memoryUsage.jsHeapSizeLimit + metric.memoryUsage.jsHeapSizeLimit
      },
      networkLatency: acc.networkLatency + metric.networkLatency,
      timestamp: new Date()
    }));

    const count = metrics.length;
    return {
      pageLoadTime: sum.pageLoadTime / count,
      domContentLoaded: sum.domContentLoaded / count,
      firstContentfulPaint: sum.firstContentfulPaint / count,
      memoryUsage: {
        usedJSHeapSize: sum.memoryUsage.usedJSHeapSize / count,
        totalJSHeapSize: sum.memoryUsage.totalJSHeapSize / count,
        jsHeapSizeLimit: sum.memoryUsage.jsHeapSizeLimit / count
      },
      networkLatency: sum.networkLatency / count,
      timestamp: new Date()
    };
  }

  // 최적화 권장사항 생성
  private generateOptimizationRecommendations(alerts: PerformanceAlert[]): OptimizationAction[] {
    const recommendations: OptimizationAction[] = [];
    const alertTypes = new Set(alerts.map(a => a.type));

    if (alertTypes.has('slow_page')) {
      recommendations.push({
        type: 'compress_images',
        priority: 'high',
        expectedImprovement: 30,
        description: '이미지 압축으로 페이지 로딩 속도 30% 개선 예상'
      });
    }

    if (alertTypes.has('high_memory')) {
      recommendations.push({
        type: 'clear_cache',
        priority: 'medium',
        expectedImprovement: 25,
        description: '캐시 정리로 메모리 사용량 25% 감소 예상'
      });
    }

    return recommendations;
  }

  // 성능 트렌드 계산
  private calculateTrends(metrics: PerformanceMetrics[]): { improvement: number; degradation: number } {
    if (metrics.length < 2) {
      return { improvement: 0, degradation: 0 };
    }

    const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2));
    const secondHalf = metrics.slice(Math.floor(metrics.length / 2));

    const firstAvg = this.calculateAverageMetrics(firstHalf);
    const secondAvg = this.calculateAverageMetrics(secondHalf);

    const loadTimeChange = ((firstAvg.pageLoadTime - secondAvg.pageLoadTime) / firstAvg.pageLoadTime) * 100;

    return {
      improvement: Math.max(0, loadTimeChange),
      degradation: Math.max(0, -loadTimeChange)
    };
  }

  // 메트릭 수집 메소드들
  private getPageLoadTime(): number {
    const timing = performance.timing;
    return timing.loadEventEnd - timing.navigationStart;
  }

  private getDOMContentLoadedTime(): number {
    const timing = performance.timing;
    return timing.domContentLoadedEventEnd - timing.navigationStart;
  }

  private getFirstContentfulPaint(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : 0;
  }

  private getMemoryUsage(): MemoryInfo {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize || 0,
        totalJSHeapSize: memory.totalJSHeapSize || 0,
        jsHeapSizeLimit: memory.jsHeapSizeLimit || 0
      };
    }
    return { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
  }

  private getNetworkLatency(): number {
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entries.length > 0) {
      return entries[0].responseStart - entries[0].requestStart;
    }
    return 0;
  }

  // 콜백 등록
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.onAlertCallbacks.push(callback);
  }

  onReport(callback: (report: PerformanceReport) => void): void {
    this.onReportCallbacks.push(callback);
  }

  // 알림 콜백 호출
  private notifyAlert(alert: PerformanceAlert): void {
    for (const callback of this.onAlertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    }
  }

  // 보고서 콜백 호출
  private notifyReport(report: PerformanceReport): void {
    for (const callback of this.onReportCallbacks) {
      try {
        callback(report);
      } catch (error) {
        console.error('Error in report callback:', error);
      }
    }
  }

  // 현재 메트릭 조회
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  // 모든 메트릭 조회
  getAllMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  // 최근 알림 조회
  getRecentAlerts(count: number = 10): PerformanceAlert[] {
    return this.alerts.slice(-count);
  }

  // 임계값 업데이트
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.options.alertThresholds = { ...this.options.alertThresholds, ...thresholds };
  }

  // 모니터링 일시 중지/재개
  pauseMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  resumeMonitoring(): void {
    if (!this.monitoringTimer && this.options.enableMonitoring) {
      this.startPeriodicCollection();
    }
  }

  // 리소스 정리
  destroy(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    this.metrics = [];
    this.alerts = [];
    this.onAlertCallbacks = [];
    this.onReportCallbacks = [];
  }
} 