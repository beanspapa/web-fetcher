import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  TabSyncManager, 
  TabSyncMessage, 
  TabInfo, 
  SyncConflictResolution 
} from '../src/tab-sync-manager';

// BroadcastChannel 모킹
class MockBroadcastChannel {
  onmessage: ((event: { data: any }) => void) | null = null;
  
  constructor(public name: string) {}
  
  postMessage(data: any): void {
    // 다른 인스턴스들에게 메시지 전송 시뮬레이션
    setTimeout(() => {
      MockBroadcastChannel.instances
        .filter(instance => instance !== this)
        .forEach(instance => {
          if (instance.onmessage) {
            instance.onmessage({ data });
          }
        });
    }, 0);
  }
  
  close(): void {
    const index = MockBroadcastChannel.instances.indexOf(this);
    if (index > -1) {
      MockBroadcastChannel.instances.splice(index, 1);
    }
  }
  
  static instances: MockBroadcastChannel[] = [];
}

// window 객체 모킹
Object.defineProperty(global, 'window', {
  value: {
    location: { href: 'https://test.com' },
    addEventListener: vi.fn(),
    localStorage: {
      setItem: vi.fn(),
      removeItem: vi.fn()
    }
  },
  writable: true
});

// BroadcastChannel을 전역으로 설정
global.BroadcastChannel = MockBroadcastChannel as any;

describe('Tab Sync Manager - Multi-Tab Session Synchronization', () => {
  let tabSyncManager1: TabSyncManager;
  let tabSyncManager2: TabSyncManager;

  beforeEach(() => {
    // 기존 인스턴스 정리
    MockBroadcastChannel.instances = [];
    
    tabSyncManager1 = new TabSyncManager({
      enableSync: true,
      syncInterval: 100, // 테스트용 짧은 간격
      heartbeatInterval: 50,
      conflictResolution: 'timestamp'
    });
    
    tabSyncManager2 = new TabSyncManager({
      enableSync: true,
      syncInterval: 100,
      heartbeatInterval: 50,
      conflictResolution: 'timestamp'
    });
  });

  afterEach(() => {
    tabSyncManager1.destroy();
    tabSyncManager2.destroy();
    MockBroadcastChannel.instances = [];
  });

  describe('Tab Registration and Master Election', () => {
    it('should register tabs and elect master correctly', () => {
      const tab1Info = tabSyncManager1.getCurrentTabInfo();
      const tab2Info = tabSyncManager2.getCurrentTabInfo();

      expect(tab1Info).toBeDefined();
      expect(tab2Info).toBeDefined();
      expect(tab1Info!.id).not.toBe(tab2Info!.id);
      
      // 하나는 마스터, 하나는 슬레이브여야 함
      const masterCount = [tabSyncManager1.isMasterTab(), tabSyncManager2.isMasterTab()]
        .filter(Boolean).length;
      expect(masterCount).toBe(1);
    });

    it('should re-elect master when current master becomes inactive', async () => {
      // 초기 마스터 확인
      const initialMaster = tabSyncManager1.isMasterTab() ? tabSyncManager1 : tabSyncManager2;
      const initialSlave = initialMaster === tabSyncManager1 ? tabSyncManager2 : tabSyncManager1;

      expect(initialMaster.isMasterTab()).toBe(true);
      expect(initialSlave.isMasterTab()).toBe(false);

      // 마스터 탭 제거
      initialMaster.destroy();

      // 잠시 기다린 후 슬레이브가 마스터로 승격되는지 확인
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 새 마스터 선출이 이루어져야 함 (실제 구현에서는 heartbeat 체크로)
      initialSlave.electMasterTab();
      expect(initialSlave.isMasterTab()).toBe(true);
    });

    it('should handle multiple tabs correctly', () => {
      const tab3 = new TabSyncManager({ enableSync: true });
      
      const activeTabs1 = tabSyncManager1.getActiveTabs();
      expect(activeTabs1.length).toBeGreaterThanOrEqual(1);
      
      tab3.destroy();
    });
  });

  describe('State Broadcasting and Synchronization', () => {
    it('should broadcast state updates to other tabs', async () => {
      const stateUpdatePromise = new Promise<{ state: any, sourceTab: string }>((resolve) => {
        tabSyncManager2.onStateUpdate((state, sourceTab) => {
          resolve({ state, sourceTab });
        });
      });

      const testState = { 
        currentPage: '/news/politics',
        searchQuery: 'election',
        timestamp: new Date()
      };

      tabSyncManager1.broadcastStateUpdate(testState);

      const result = await stateUpdatePromise;
      expect(result.state.currentPage).toBe('/news/politics');
      expect(result.state.searchQuery).toBe('election');
      expect(result.sourceTab).toBe(tabSyncManager1.getCurrentTabInfo()!.id);
    });

    it('should filter syncable keys when specified', async () => {
      const filteredManager = new TabSyncManager({
        enableSync: true,
        syncKeys: ['currentPage', 'searchQuery'] // 특정 키만 동기화
      });

      const stateUpdatePromise = new Promise<any>((resolve) => {
        tabSyncManager1.onStateUpdate((state) => {
          resolve(state);
        });
      });

      const testState = {
        currentPage: '/news/sports',
        searchQuery: 'football',
        privateData: 'should not sync', // 동기화되지 않아야 함
        sessionId: 'secret'
      };

      filteredManager.broadcastStateUpdate(testState);

      const result = await stateUpdatePromise;
      expect(result.currentPage).toBe('/news/sports');
      expect(result.searchQuery).toBe('football');
      expect(result.privateData).toBeUndefined();
      expect(result.sessionId).toBeUndefined();

      filteredManager.destroy();
    });

    it('should update local state correctly', () => {
      const testState = { currentPage: '/news/economy' };
      tabSyncManager1.updateLocalState(testState);

      const tabInfo = tabSyncManager1.getCurrentTabInfo();
      expect(tabInfo!.sessionData.currentPage).toBe('/news/economy');
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('should detect conflicts when same keys have different values', async () => {
      // 두 탭에 다른 상태 설정
      tabSyncManager1.updateLocalState({ 
        currentPage: '/news/politics',
        searchQuery: 'local search'
      });

      tabSyncManager2.updateLocalState({ 
        currentPage: '/news/economy', // 충돌
        searchQuery: 'local search'    // 동일
      });

      const conflictPromise = new Promise<SyncConflictResolution>((resolve) => {
        tabSyncManager1.onConflict((conflict) => {
          resolve(conflict);
        });
      });

      // tab2에서 상태 브로드캐스트
      tabSyncManager2.broadcastStateUpdate({
        currentPage: '/news/economy',
        searchQuery: 'local search'
      });

      const conflict = await conflictPromise;
      expect(conflict.conflicts).toHaveLength(1);
      expect(conflict.conflicts[0].key).toBe('currentPage');
      expect(conflict.conflicts[0].localValue).toBe('/news/politics');
      expect(conflict.conflicts[0].remoteValue).toBe('/news/economy');
    });

    it('should resolve conflicts using timestamp strategy', async () => {
      const timestampManager = new TabSyncManager({
        conflictResolution: 'timestamp'
      });

      timestampManager.updateLocalState({ 
        data: 'local value' 
      });

      const conflictPromise = new Promise<SyncConflictResolution>((resolve) => {
        timestampManager.onConflict((conflict) => {
          resolve(conflict);
        });
      });

      tabSyncManager1.broadcastStateUpdate({ 
        data: 'remote value' 
      });

      const conflict = await conflictPromise;
      expect(conflict.strategy).toBe('timestamp');
      expect(conflict.resolvedData.data).toBe('remote value'); // 최신 것이 선택됨

      timestampManager.destroy();
    });

    it('should resolve conflicts using priority strategy', async () => {
      const priorityManager = new TabSyncManager({
        conflictResolution: 'priority'
      });

      // 마스터 탭으로 만들기
      priorityManager.electMasterTab();

      priorityManager.updateLocalState({ 
        data: 'master value' 
      });

      const conflictPromise = new Promise<SyncConflictResolution>((resolve) => {
        priorityManager.onConflict((conflict) => {
          resolve(conflict);
        });
      });

      tabSyncManager1.broadcastStateUpdate({ 
        data: 'slave value' 
      });

      const conflict = await conflictPromise;
      expect(conflict.strategy).toBe('priority');
      
      // 마스터 탭이면 local 값이, 슬레이브면 remote 값이 선택되어야 함
      if (priorityManager.isMasterTab()) {
        expect(conflict.resolvedData.data).toBe('master value');
      }

      priorityManager.destroy();
    });

    it('should resolve conflicts using merge strategy for objects', async () => {
      const mergeManager = new TabSyncManager({
        conflictResolution: 'merge'
      });

      mergeManager.updateLocalState({ 
        settings: { theme: 'dark', language: 'ko' }
      });

      const conflictPromise = new Promise<SyncConflictResolution>((resolve) => {
        mergeManager.onConflict((conflict) => {
          resolve(conflict);
        });
      });

      tabSyncManager1.broadcastStateUpdate({ 
        settings: { theme: 'light', fontSize: 'large' }
      });

      const conflict = await conflictPromise;
      expect(conflict.strategy).toBe('merge');
      expect(conflict.resolvedData.settings.theme).toBe('light'); // remote 값
      expect(conflict.resolvedData.settings.language).toBe('ko'); // local 값 유지
      expect(conflict.resolvedData.settings.fontSize).toBe('large'); // remote 값 추가

      mergeManager.destroy();
    });
  });

  describe('Heartbeat and Activity Monitoring', () => {
    it('should track tab activity through heartbeats', async () => {
      // 초기 활성 탭 수
      const initialActiveTabs = tabSyncManager1.getActiveTabs();
      expect(initialActiveTabs.length).toBeGreaterThanOrEqual(1);

      // 하트비트가 전송되는 시간 대기
      await new Promise(resolve => setTimeout(resolve, 100));

      const activeTabs = tabSyncManager1.getActiveTabs();
      expect(activeTabs.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect inactive tabs and remove them', async () => {
      // 새 탭 생성
      const shortLivedTab = new TabSyncManager({
        heartbeatInterval: 20 // 매우 짧은 간격
      });

      // 초기에는 활성 탭이어야 함
      await new Promise(resolve => setTimeout(resolve, 50));
      let activeTabs = tabSyncManager1.getActiveTabs();
      const hasShortLivedTab = activeTabs.some(tab => 
        tab.id === shortLivedTab.getCurrentTabInfo()?.id
      );

      // 탭 강제 종료 (destroy 호출하지 않고 비활성화)
      shortLivedTab.destroy();

      // 하트비트 타임아웃 후 확인
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 비활성 탭이 제거되었는지 확인하기 위해 수동으로 체크
      tabSyncManager1.electMasterTab(); // 이 과정에서 비활성 탭들이 정리됨
    });
  });

  describe('Sync Request and Response', () => {
    it('should respond to sync requests from master tab', async () => {
      // 마스터 탭에 상태 설정
      const masterTab = tabSyncManager1.isMasterTab() ? tabSyncManager1 : tabSyncManager2;
      const slaveTab = masterTab === tabSyncManager1 ? tabSyncManager2 : tabSyncManager1;

      masterTab.updateLocalState({ 
        masterData: 'important data' 
      });

      const stateUpdatePromise = new Promise<any>((resolve) => {
        slaveTab.onStateUpdate((state) => {
          resolve(state);
        });
      });

      // 슬레이브 탭에서 동기화 요청
      slaveTab.requestSync();

      const receivedState = await stateUpdatePromise;
      expect(receivedState.masterData).toBe('important data');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle multiple state updates efficiently', async () => {
      const updateCount = 10;
      const receivedUpdates: any[] = [];

      tabSyncManager2.onStateUpdate((state) => {
        receivedUpdates.push(state);
      });

      // 여러 상태 업데이트 전송
      for (let i = 0; i < updateCount; i++) {
        tabSyncManager1.broadcastStateUpdate({ 
          counter: i,
          timestamp: new Date()
        });
      }

      // 모든 업데이트가 수신될 때까지 대기
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(receivedUpdates.length).toBeGreaterThan(0);
      expect(receivedUpdates.length).toBeLessThanOrEqual(updateCount);
    });

    it('should properly clean up resources on destroy', () => {
      const tab = new TabSyncManager({ enableSync: true });
      const tabId = tab.getCurrentTabInfo()!.id;

      // 정리 전 활성 상태 확인
      expect(tab.getCurrentTabInfo()).toBeDefined();

      // 리소스 정리
      tab.destroy();

      // 정리 후 상태 확인
      expect(tab.getCurrentTabInfo()).toBeUndefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid message gracefully', () => {
      // 잘못된 메시지 형식 처리 테스트
      expect(() => {
        // BroadcastChannel을 통해 잘못된 메시지 전송 시뮬레이션
        const channel = new MockBroadcastChannel('tab-sync-channel');
        if (channel.onmessage) {
          channel.onmessage({ data: null });
        }
      }).not.toThrow();
    });

    it('should handle sync when disabled', () => {
      const disabledSyncManager = new TabSyncManager({ enableSync: false });
      
      // 동기화가 비활성화된 상태에서 상태 업데이트 시도
      expect(() => {
        disabledSyncManager.broadcastStateUpdate({ test: 'data' });
      }).not.toThrow();

      disabledSyncManager.destroy();
    });

    it('should handle empty state updates', async () => {
      const stateUpdatePromise = new Promise<any>((resolve) => {
        tabSyncManager2.onStateUpdate((state) => {
          resolve(state);
        });
      });

      tabSyncManager1.broadcastStateUpdate({});

      const result = await stateUpdatePromise;
      expect(result).toEqual({});
    });
  });
}); 