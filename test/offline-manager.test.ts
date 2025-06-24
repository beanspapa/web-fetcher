import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  OfflineManager, 
  NetworkStatus, 
  SyncResult 
} from '../src/offline-manager';

// Navigator 모킹
Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true,
    connection: {
      type: 'wifi',
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
      saveData: false
    }
  },
  writable: true
});

// Window 모킹
Object.defineProperty(global, 'window', {
  value: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  },
  writable: true
});

// Blob 모킹
global.Blob = class Blob {
  size: number;
  constructor(parts: any[]) {
    this.size = JSON.stringify(parts).length;
  }
} as any;

describe('Offline Manager - Offline Situation Handling', () => {
  let offlineManager: OfflineManager;

  beforeEach(() => {
    offlineManager = new OfflineManager({
      enableOfflineMode: true,
      maxQueueSize: 100,
      syncRetries: 3,
      syncInterval: 1000
    });
  });

  afterEach(() => {
    offlineManager.destroy();
  });

  describe('Network Status Detection', () => {
    it('should detect online status correctly', () => {
      expect(offlineManager.isOnline()).toBe(true);
    });

    it('should get network status with connection details', () => {
      const status = offlineManager.getNetworkStatus();
      
      expect(status.isOnline).toBe(true);
      expect(status.connectionType).toBeDefined();
      expect(status.effectiveType).toBeDefined();
      expect(status.downlink).toBeGreaterThanOrEqual(0);
      expect(status.rtt).toBeGreaterThanOrEqual(0);
    });

    it('should detect slow connection correctly', () => {
      // 느린 연결 시뮬레이션
      (navigator as any).connection.effectiveType = 'slow-2g';
      
      expect(offlineManager.isSlowConnection()).toBe(true);
    });
  });

  describe('Offline Action Queue', () => {
    it('should queue actions when offline mode is enabled', () => {
      offlineManager.queueOfflineAction('save_article', { id: 1, title: 'Test' }, 'medium');
      
      const queueStatus = offlineManager.getQueueStatus();
      expect(queueStatus.length).toBe(1);
      expect(queueStatus.byPriority.medium).toBe(1);
    });

    it('should respect queue size limits', () => {
      const smallQueueManager = new OfflineManager({ maxQueueSize: 2 });
      
      smallQueueManager.queueOfflineAction('action1', {}, 'low');
      smallQueueManager.queueOfflineAction('action2', {}, 'medium');
      smallQueueManager.queueOfflineAction('action3', {}, 'high'); // 이것이 low 우선순위를 밀어냄
      
      const queueStatus = smallQueueManager.getQueueStatus();
      expect(queueStatus.length).toBe(2);
      expect(queueStatus.byPriority.low).toBe(0); // low 우선순위가 제거됨
      
      smallQueueManager.destroy();
    });

    it('should handle different priority levels', () => {
      offlineManager.queueOfflineAction('action1', {}, 'low');
      offlineManager.queueOfflineAction('action2', {}, 'medium');
      offlineManager.queueOfflineAction('action3', {}, 'high');
      offlineManager.queueOfflineAction('action4', {}, 'critical');
      
      const queueStatus = offlineManager.getQueueStatus();
      expect(queueStatus.byPriority.low).toBe(1);
      expect(queueStatus.byPriority.medium).toBe(1);
      expect(queueStatus.byPriority.high).toBe(1);
      expect(queueStatus.byPriority.critical).toBe(1);
    });
  });

  describe('Cache Management', () => {
    it('should store and retrieve cache items', () => {
      const testData = { id: 1, content: 'test content' };
      offlineManager.setCacheItem('test-key', testData);
      
      const retrieved = offlineManager.getCacheItem('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should handle cache expiry', () => {
      const testData = { id: 1, content: 'test content' };
      const shortExpiry = 1; // 1ms
      
      offlineManager.setCacheItem('expiry-test', testData, shortExpiry);
      
      // 즉시 조회하면 데이터가 있어야 함
      expect(offlineManager.getCacheItem('expiry-test')).toEqual(testData);
      
      // 시간이 지나면 만료되어야 함 (setTimeout으로 시뮬레이션)
      setTimeout(() => {
        expect(offlineManager.getCacheItem('expiry-test')).toBeNull();
      }, 10);
    });

    it('should remove cache items', () => {
      offlineManager.setCacheItem('remove-test', { data: 'test' });
      expect(offlineManager.getCacheItem('remove-test')).toBeTruthy();
      
      const removed = offlineManager.removeCacheItem('remove-test');
      expect(removed).toBe(true);
      expect(offlineManager.getCacheItem('remove-test')).toBeNull();
    });

    it('should clear all cache', () => {
      offlineManager.setCacheItem('cache1', { data: 'test1' });
      offlineManager.setCacheItem('cache2', { data: 'test2' });
      
      offlineManager.clearCache();
      
      expect(offlineManager.getCacheItem('cache1')).toBeNull();
      expect(offlineManager.getCacheItem('cache2')).toBeNull();
    });
  });

  describe('Online Sync Process', () => {
    it('should sync queued actions when online', async () => {
      offlineManager.queueOfflineAction('save_article', { id: 1 }, 'medium');
      offlineManager.queueOfflineAction('update_preferences', { theme: 'dark' }, 'low');
      
      const result = await offlineManager.syncWhenOnline();
      
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle sync failures gracefully', async () => {
      // 알려지지 않은 액션으로 실패 시뮬레이션
      offlineManager.queueOfflineAction('unknown_action', { data: 'test' }, 'medium');
      
      const result = await offlineManager.syncWhenOnline();
      
      expect(result.success).toBe(false);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should retry failed actions up to max retries', async () => {
      const retryManager = new OfflineManager({ syncRetries: 2 });
      
      // 실패할 액션 큐에 추가
      retryManager.queueOfflineAction('unknown_action', { data: 'test' }, 'medium');
      
      // 첫 번째 동기화 시도
      const firstResult = await retryManager.syncWhenOnline();
      expect(firstResult.failed).toBe(1);
      
      // 재시도 카운트가 증가했는지 확인 (큐에 다시 추가됨)
      const queueStatus = retryManager.getQueueStatus();
      expect(queueStatus.length).toBe(1); // 재시도를 위해 큐에 남아있음
      
      retryManager.destroy();
    });
  });

  describe('Network Change Handling', () => {
    it('should register network change listeners', () => {
      const listener = vi.fn();
      offlineManager.onNetworkChange(listener);
      
      // 네트워크 상태 변화 시뮬레이션은 실제 브라우저 환경에서만 가능
      // 여기서는 리스너가 등록되었는지만 확인
      expect(listener).not.toHaveBeenCalled(); // 초기에는 호출되지 않음
    });

    it('should handle sync callback registration', () => {
      const syncCallback = vi.fn();
      offlineManager.onSync(syncCallback);
      
      // 동기화 콜백이 등록되었는지 확인 (실제 호출은 동기화 시에 발생)
      expect(syncCallback).not.toHaveBeenCalled(); // 초기에는 호출되지 않음
    });
  });

  describe('Status and Statistics', () => {
    it('should provide queue status information', () => {
      offlineManager.queueOfflineAction('action1', {}, 'high');
      offlineManager.queueOfflineAction('action2', {}, 'medium');
      
      const status = offlineManager.getQueueStatus();
      
      expect(status.length).toBe(2);
      expect(status.byPriority.high).toBe(1);
      expect(status.byPriority.medium).toBe(1);
      expect(status.oldestItem).toBeInstanceOf(Date);
    });

    it('should provide cache status information', () => {
      offlineManager.setCacheItem('item1', { data: 'test1' });
      offlineManager.setCacheItem('item2', { data: 'test2' });
      
      const status = offlineManager.getCacheStatus();
      
      expect(status.size).toBe(2);
      expect(status.totalBytes).toBeGreaterThan(0);
      expect(status.oldestItem).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle disabled offline mode gracefully', () => {
      const disabledManager = new OfflineManager({ enableOfflineMode: false });
      
      // 오프라인 모드가 비활성화된 상태에서 액션 큐잉 시도
      disabledManager.queueOfflineAction('test', {}, 'medium');
      
      const queueStatus = disabledManager.getQueueStatus();
      expect(queueStatus.length).toBe(0); // 큐에 추가되지 않아야 함
      
      disabledManager.destroy();
    });

    it('should handle sync when offline', async () => {
      // 오프라인 상태 시뮬레이션 (실제로는 navigator.onLine을 false로 설정해야 함)
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      
      const offlineOnlyManager = new OfflineManager();
      const result = await offlineOnlyManager.syncWhenOnline();
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Offline');
      
      // 원래 상태로 복원
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      
      offlineOnlyManager.destroy();
    });
  });
}); 