// 오프라인 처리 관련 인터페이스
export interface OfflineQueue {
  id: string;
  action: string;
  params: any;
  timestamp: Date;
  retryCount: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  maxRetries: number;
}

export interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'wifi' | '4g' | '3g' | 'slow-2g' | 'unknown';
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
}

export interface OfflineOptions {
  enableOfflineMode: boolean;
  maxQueueSize: number;
  syncRetries: number;
  syncInterval: number; // ms
  cacheExpiry: number; // ms
  prioritySync: boolean;
}

export interface CacheItem {
  key: string;
  data: any;
  timestamp: Date;
  expiry: Date;
  size: number; // bytes
}

export interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Error[];
}

// 오프라인 관리자
export class OfflineManager {
  private queue: OfflineQueue[] = [];
  private cache: Map<string, CacheItem> = new Map();
  private options: OfflineOptions;
  private syncTimer: NodeJS.Timeout | null = null;
  private isCurrentlyOnline: boolean = true;
  private networkChangeListeners: ((status: NetworkStatus) => void)[] = [];
  private onSyncCallback?: (result: SyncResult) => void;
  private onlineHandler = (event: Event) => this.handleNetworkChange(true);
  private offlineHandler = (event: Event) => this.handleNetworkChange(false);

  constructor(options: Partial<OfflineOptions> = {}) {
    this.options = {
      enableOfflineMode: true,
      maxQueueSize: 1000,
      syncRetries: 3,
      syncInterval: 30000, // 30초
      cacheExpiry: 24 * 60 * 60 * 1000, // 24시간
      prioritySync: true,
      ...options
    };

    this.initializeNetworkMonitoring();
    if (this.options.enableOfflineMode) {
      this.startPeriodicSync();
    }
  }

  // 네트워크 모니터링 초기화
  private initializeNetworkMonitoring(): void {
    if (typeof window !== 'undefined') {
      // Online/Offline 이벤트 감지
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);

      // Navigator Connection API (실험적)
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        connection.addEventListener('change', () => {
          this.handleConnectionChange();
        });
      }

      // 초기 네트워크 상태 설정
      this.isCurrentlyOnline = navigator.onLine;
    }
  }

  // 네트워크 상태 변화 처리
  private handleNetworkChange(isOnline: boolean): void {
    const wasOffline = !this.isCurrentlyOnline;
    this.isCurrentlyOnline = isOnline;

    const status = this.getNetworkStatus();
    this.notifyNetworkChange(status);

    if (isOnline && wasOffline) {
      // 온라인 복구 시 자동 동기화
      this.syncWhenOnline();
    }
  }

  // 연결 타입 변화 처리
  private handleConnectionChange(): void {
    const status = this.getNetworkStatus();
    this.notifyNetworkChange(status);
  }

  // 현재 네트워크 상태 조회
  getNetworkStatus(): NetworkStatus {
    const defaultStatus: NetworkStatus = {
      isOnline: this.isCurrentlyOnline,
      connectionType: 'unknown',
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
      saveData: false
    };

    if (typeof window === 'undefined' || !('connection' in navigator)) {
      return defaultStatus;
    }

    const connection = (navigator as any).connection;
    return {
      isOnline: this.isCurrentlyOnline,
      connectionType: connection.type || 'unknown',
      effectiveType: connection.effectiveType || '4g',
      downlink: connection.downlink || 10,
      rtt: connection.rtt || 100,
      saveData: connection.saveData || false
    };
  }

  // 온라인 상태 확인
  isOnline(): boolean {
    return this.isCurrentlyOnline;
  }

  // 느린 연결 감지
  isSlowConnection(): boolean {
    const status = this.getNetworkStatus();
    return status.effectiveType === 'slow-2g' || status.effectiveType === '2g' || 
           status.downlink < 1.5; // 1.5 Mbps 미만
  }

  // 오프라인 작업 큐에 추가
  queueOfflineAction(action: string, params: any, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    if (!this.options.enableOfflineMode) {
      return;
    }

    // 큐 크기 제한 확인
    if (this.queue.length >= this.options.maxQueueSize) {
      // 우선순위가 낮은 작업부터 제거
      this.queue.sort((a, b) => this.getPriorityValue(a.priority) - this.getPriorityValue(b.priority));
      this.queue.shift();
    }

    const queueItem: OfflineQueue = {
      id: this.generateQueueId(),
      action,
      params,
      timestamp: new Date(),
      retryCount: 0,
      priority,
      maxRetries: this.options.syncRetries
    };

    this.queue.push(queueItem);

    // 온라인 상태이고 우선순위가 높은 경우 즉시 동기화
    if (this.isOnline() && priority === 'critical') {
      this.syncWhenOnline();
    }
  }

  // 캐시에 데이터 저장
  setCacheItem(key: string, data: any, customExpiry?: number): void {
    const expiry = new Date(Date.now() + (customExpiry || this.options.cacheExpiry));
    const dataString = JSON.stringify(data);
    
    const cacheItem: CacheItem = {
      key,
      data,
      timestamp: new Date(),
      expiry,
      size: new Blob([dataString]).size
    };

    this.cache.set(key, cacheItem);
    this.cleanExpiredCache();
  }

  // 캐시에서 데이터 조회
  getCacheItem(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // 만료 확인
    if (new Date() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  // 캐시 삭제
  removeCacheItem(key: string): boolean {
    return this.cache.delete(key);
  }

  // 전체 캐시 정리
  clearCache(): void {
    this.cache.clear();
  }

  // 만료된 캐시 정리
  private cleanExpiredCache(): void {
    const now = new Date();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  // 온라인 복구 시 동기화
  async syncWhenOnline(): Promise<SyncResult> {
    if (!this.isOnline() || !this.options.enableOfflineMode) {
      return { success: false, processed: 0, failed: 0, errors: [new Error('Offline or disabled')] };
    }

    const result: SyncResult = {
      success: true,
      processed: 0,
      failed: 0,
      errors: []
    };

    // 우선순위 정렬
    if (this.options.prioritySync) {
      this.queue.sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority));
    }

    const itemsToProcess = [...this.queue];
    this.queue = [];

    for (const item of itemsToProcess) {
      try {
        await this.processQueueItem(item);
        result.processed++;
      } catch (error) {
        result.failed++;
        result.errors.push(error as Error);

        // 재시도 로직
        if (item.retryCount < item.maxRetries) {
          item.retryCount++;
          this.queue.push(item);
        }
      }
    }

    result.success = result.failed === 0;

    // 동기화 완료 콜백
    if (this.onSyncCallback) {
      this.onSyncCallback(result);
    }

    return result;
  }

  // 큐 아이템 처리 (실제 구현에서는 각 액션에 맞는 처리 로직 필요)
  private async processQueueItem(item: OfflineQueue): Promise<void> {
    // 액션 타입에 따른 처리
    switch (item.action) {
      case 'save_article':
        await this.saveArticle(item.params);
        break;
      case 'update_preferences':
        await this.updatePreferences(item.params);
        break;
      case 'log_analytics':
        await this.logAnalytics(item.params);
        break;
      default:
        throw new Error(`Unknown action: ${item.action}`);
    }
  }

  // 예제 액션 메소드들
  private async saveArticle(params: any): Promise<void> {
    // 실제 구현에서는 서버 API 호출
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Article saved:', params);
  }

  private async updatePreferences(params: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log('Preferences updated:', params);
  }

  private async logAnalytics(params: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 25));
    console.log('Analytics logged:', params);
  }

  // 정기 동기화 시작
  private startPeriodicSync(): void {
    this.syncTimer = setInterval(() => {
      if (this.isOnline() && this.queue.length > 0) {
        this.syncWhenOnline();
      }
    }, this.options.syncInterval);
  }

  // 정기 동기화 중지
  private stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // 네트워크 변화 알림
  private notifyNetworkChange(status: NetworkStatus): void {
    for (const listener of this.networkChangeListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in network change listener:', error);
      }
    }
  }

  // 네트워크 변화 리스너 등록
  onNetworkChange(listener: (status: NetworkStatus) => void): void {
    this.networkChangeListeners.push(listener);
  }

  // 동기화 콜백 등록
  onSync(callback: (result: SyncResult) => void): void {
    this.onSyncCallback = callback;
  }

  // 우선순위 값 변환
  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 4;
      default: return 2;
    }
  }

  // 큐 ID 생성
  private generateQueueId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 큐 상태 조회
  getQueueStatus(): {
    length: number;
    byPriority: Record<string, number>;
    oldestItem?: Date;
  } {
    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    let oldestItem: Date | undefined;

    for (const item of this.queue) {
      byPriority[item.priority]++;
      if (!oldestItem || item.timestamp < oldestItem) {
        oldestItem = item.timestamp;
      }
    }

    return {
      length: this.queue.length,
      byPriority,
      oldestItem
    };
  }

  // 캐시 상태 조회
  getCacheStatus(): {
    size: number;
    totalBytes: number;
    oldestItem?: Date;
  } {
    let totalBytes = 0;
    let oldestItem: Date | undefined;

    for (const item of this.cache.values()) {
      totalBytes += item.size;
      if (!oldestItem || item.timestamp < oldestItem) {
        oldestItem = item.timestamp;
      }
    }

    return {
      size: this.cache.size,
      totalBytes,
      oldestItem
    };
  }

  // 리소스 정리
  destroy(): void {
    this.stopPeriodicSync();
    this.clearCache();
    this.queue = [];
    this.networkChangeListeners = [];
    this.onSyncCallback = undefined;

    // 이벤트 리스너 제거
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }
  }
} 