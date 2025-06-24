// 다중 탭 동기화 관련 인터페이스
export interface TabSyncMessage {
  type: 'state_update' | 'tab_closed' | 'master_election' | 'heartbeat' | 'sync_request';
  tabId: string;
  data: any;
  timestamp: Date;
  source: string;
}

export interface TabInfo {
  id: string;
  isMaster: boolean;
  lastHeartbeat: Date;
  sessionData: any;
  url: string;
  active: boolean;
}

export interface SyncConflictResolution {
  strategy: 'timestamp' | 'priority' | 'merge' | 'user_choice';
  winner: string;
  resolvedData: any;
  conflicts: ConflictDetail[];
}

export interface ConflictDetail {
  key: string;
  localValue: any;
  remoteValue: any;
  resolution: 'local' | 'remote' | 'merged';
}

export interface TabSyncOptions {
  enableSync: boolean;
  syncInterval: number; // ms
  heartbeatInterval: number; // ms
  masterElectionTimeout: number; // ms
  conflictResolution: 'timestamp' | 'priority' | 'merge' | 'user_choice';
  maxTabs: number;
  syncKeys: string[]; // 동기화할 상태 키들
}

// 다중 탭 동기화 관리자
export class TabSyncManager {
  private tabId: string;
  private tabs: Map<string, TabInfo> = new Map();
  private isMaster: boolean = false;
  private options: TabSyncOptions;
  private channel: BroadcastChannel | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private onStateUpdateCallbacks: ((state: any, sourceTab: string) => void)[] = [];
  private onConflictCallbacks: ((conflict: SyncConflictResolution) => void)[] = [];

  constructor(options: Partial<TabSyncOptions> = {}) {
    this.options = {
      enableSync: true,
      syncInterval: 5000, // 5초
      heartbeatInterval: 2000, // 2초
      masterElectionTimeout: 10000, // 10초
      conflictResolution: 'timestamp',
      maxTabs: 10,
      syncKeys: ['*'], // 모든 키 동기화
      ...options
    };

    this.tabId = this.generateTabId();
    this.initializeBroadcastChannel();
    this.registerTab();
    
    if (this.options.enableSync) {
      this.startSync();
    }
  }

  // BroadcastChannel 초기화
  private initializeBroadcastChannel(): void {
    try {
      this.channel = new BroadcastChannel('tab-sync-channel');
      this.channel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (error) {
      console.warn('BroadcastChannel not supported, falling back to localStorage');
      this.initializeStorageSync();
    }
  }

  // localStorage 기반 동기화 (BroadcastChannel 미지원 시)
  private initializeStorageSync(): void {
    window.addEventListener('storage', (event) => {
      if (event.key === 'tab-sync-message') {
        try {
          const message = JSON.parse(event.newValue || '{}');
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse sync message:', error);
        }
      }
    });
  }

  // 탭 등록
  private registerTab(): void {
    const tabInfo: TabInfo = {
      id: this.tabId,
      isMaster: false,
      lastHeartbeat: new Date(),
      sessionData: {},
      url: window.location.href,
      active: true
    };

    this.tabs.set(this.tabId, tabInfo);
    this.electMasterTab();
  }

  // 마스터 탭 선정
  electMasterTab(): void {
    const activeTabs = Array.from(this.tabs.values())
      .filter(tab => tab.active)
      .sort((a, b) => a.id.localeCompare(b.id)); // 일관된 정렬

    if (activeTabs.length === 0) {
      return;
    }

    // 기존 마스터가 여전히 활성 상태인지 확인
    const currentMaster = activeTabs.find(tab => tab.isMaster);
    if (currentMaster && this.isTabActive(currentMaster)) {
      return;
    }

    // 새 마스터 선정 (가장 오래된 탭)
    const newMaster = activeTabs[0];
    
    // 모든 탭의 마스터 상태 업데이트
    for (const tab of this.tabs.values()) {
      tab.isMaster = tab.id === newMaster.id;
    }

    this.isMaster = newMaster.id === this.tabId;

    // 마스터 선정 알림
    this.broadcastMessage({
      type: 'master_election',
      tabId: this.tabId,
      data: { newMasterId: newMaster.id },
      timestamp: new Date(),
      source: this.tabId
    });
  }

  // 상태 업데이트 브로드캐스트
  broadcastStateUpdate(state: any): void {
    if (!this.options.enableSync) {
      return;
    }

    const filteredState = this.filterSyncableKeys(state);
    
    this.broadcastMessage({
      type: 'state_update',
      tabId: this.tabId,
      data: filteredState,
      timestamp: new Date(),
      source: this.tabId
    });
  }

  // 상태 업데이트 수신 콜백 등록
  onStateUpdate(callback: (state: any, sourceTab: string) => void): void {
    this.onStateUpdateCallbacks.push(callback);
  }

  // 충돌 해결 콜백 등록
  onConflict(callback: (conflict: SyncConflictResolution) => void): void {
    this.onConflictCallbacks.push(callback);
  }

  // 메시지 처리
  private handleMessage(message: TabSyncMessage): void {
    if (message.tabId === this.tabId) {
      return; // 자신이 보낸 메시지 무시
    }

    switch (message.type) {
      case 'state_update':
        this.handleStateUpdate(message);
        break;
      
      case 'tab_closed':
        this.handleTabClosed(message);
        break;
      
      case 'master_election':
        this.handleMasterElection(message);
        break;
      
      case 'heartbeat':
        this.handleHeartbeat(message);
        break;
      
      case 'sync_request':
        this.handleSyncRequest(message);
        break;
    }
  }

  // 상태 업데이트 처리
  private handleStateUpdate(message: TabSyncMessage): void {
    const sourceTab = message.tabId;
    const remoteState = message.data;
    
    // 충돌 감지 및 해결
    const conflicts = this.detectConflicts(remoteState);
    if (conflicts.length > 0) {
      const resolution = this.resolveConflicts(remoteState, conflicts);
      this.notifyConflictResolution(resolution);
      
      // 해결된 상태로 업데이트
      this.notifyStateUpdate(resolution.resolvedData, sourceTab);
    } else {
      this.notifyStateUpdate(remoteState, sourceTab);
    }

    // 탭 정보 업데이트
    this.updateTabInfo(sourceTab, { 
      lastHeartbeat: new Date(),
      sessionData: remoteState,
      active: true 
    });
  }

  // 충돌 감지
  private detectConflicts(remoteState: any): ConflictDetail[] {
    const conflicts: ConflictDetail[] = [];
    const localTab = this.tabs.get(this.tabId);
    
    if (!localTab || !localTab.sessionData) {
      return conflicts;
    }

    const localState = localTab.sessionData;

    for (const key in remoteState) {
      if (localState.hasOwnProperty(key) && 
          JSON.stringify(localState[key]) !== JSON.stringify(remoteState[key])) {
        conflicts.push({
          key,
          localValue: localState[key],
          remoteValue: remoteState[key],
          resolution: 'remote' // 기본값
        });
      }
    }

    return conflicts;
  }

  // 충돌 해결
  private resolveConflicts(remoteState: any, conflicts: ConflictDetail[]): SyncConflictResolution {
    const localTab = this.tabs.get(this.tabId);
    const localState = localTab?.sessionData || {};
    let resolvedData = { ...remoteState };

    for (const conflict of conflicts) {
      switch (this.options.conflictResolution) {
        case 'timestamp':
          // 더 최신 것을 선택 (여기서는 remote가 더 최신으로 가정)
          conflict.resolution = 'remote';
          break;
          
        case 'priority':
          // 마스터 탭의 것을 선택
          conflict.resolution = this.isMaster ? 'local' : 'remote';
          if (conflict.resolution === 'local') {
            resolvedData[conflict.key] = conflict.localValue;
          }
          break;
          
        case 'merge':
          // 객체인 경우 병합 시도
          if (typeof conflict.localValue === 'object' && typeof conflict.remoteValue === 'object') {
            resolvedData[conflict.key] = { ...conflict.localValue, ...conflict.remoteValue };
            conflict.resolution = 'merged';
          } else {
            conflict.resolution = 'remote';
          }
          break;
          
        case 'user_choice':
          // 사용자 선택이 필요 - 일단 remote로 설정하고 콜백에서 처리
          conflict.resolution = 'remote';
          break;
      }
    }

    return {
      strategy: this.options.conflictResolution,
      winner: 'remote',
      resolvedData,
      conflicts
    };
  }

  // 탭 닫힘 처리
  private handleTabClosed(message: TabSyncMessage): void {
    const closedTabId = message.tabId;
    this.tabs.delete(closedTabId);
    
    // 마스터 탭이 닫혔다면 재선출
    if (this.tabs.get(closedTabId)?.isMaster) {
      this.electMasterTab();
    }
  }

  // 마스터 선정 처리
  private handleMasterElection(message: TabSyncMessage): void {
    const newMasterId = message.data.newMasterId;
    
    for (const tab of this.tabs.values()) {
      tab.isMaster = tab.id === newMasterId;
    }
    
    this.isMaster = newMasterId === this.tabId;
  }

  // 하트비트 처리
  private handleHeartbeat(message: TabSyncMessage): void {
    this.updateTabInfo(message.tabId, { 
      lastHeartbeat: new Date(),
      active: true 
    });
  }

  // 동기화 요청 처리
  private handleSyncRequest(message: TabSyncMessage): void {
    if (this.isMaster) {
      // 마스터 탭이 현재 상태를 브로드캐스트
      const localTab = this.tabs.get(this.tabId);
      if (localTab?.sessionData) {
        this.broadcastStateUpdate(localTab.sessionData);
      }
    }
  }

  // 메시지 브로드캐스트
  private broadcastMessage(message: TabSyncMessage): void {
    if (this.channel) {
      this.channel.postMessage(message);
    } else {
      // localStorage 폴백
      localStorage.setItem('tab-sync-message', JSON.stringify(message));
      localStorage.removeItem('tab-sync-message');
    }
  }

  // 동기화 시작
  private startSync(): void {
    // 하트비트 시작
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
      this.checkInactiveTabs();
    }, this.options.heartbeatInterval);

    // 정기 동기화
    this.syncTimer = setInterval(() => {
      this.performRegularSync();
    }, this.options.syncInterval);
  }

  // 하트비트 전송
  private sendHeartbeat(): void {
    this.broadcastMessage({
      type: 'heartbeat',
      tabId: this.tabId,
      data: { url: window.location.href },
      timestamp: new Date(),
      source: this.tabId
    });
  }

  // 비활성 탭 확인
  private checkInactiveTabs(): void {
    const now = new Date();
    const inactiveTabs: string[] = [];

    for (const [tabId, tab] of this.tabs.entries()) {
      if (tabId !== this.tabId) {
        const timeSinceHeartbeat = now.getTime() - tab.lastHeartbeat.getTime();
        if (timeSinceHeartbeat > this.options.heartbeatInterval * 3) {
          tab.active = false;
          inactiveTabs.push(tabId);
        }
      }
    }

    // 비활성 탭들 정리
    for (const tabId of inactiveTabs) {
      this.tabs.delete(tabId);
    }

    // 마스터 재선출이 필요한지 확인
    if (inactiveTabs.length > 0) {
      this.electMasterTab();
    }
  }

  // 정기 동기화 수행
  private performRegularSync(): void {
    if (this.isMaster) {
      // 마스터 탭에서만 정기 동기화 수행
      const localTab = this.tabs.get(this.tabId);
      if (localTab?.sessionData) {
        this.broadcastStateUpdate(localTab.sessionData);
      }
    }
  }

  // 탭 정보 업데이트
  private updateTabInfo(tabId: string, updates: Partial<TabInfo>): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      Object.assign(tab, updates);
    } else {
      this.tabs.set(tabId, {
        id: tabId,
        isMaster: false,
        lastHeartbeat: new Date(),
        sessionData: {},
        url: '',
        active: true,
        ...updates
      });
    }
  }

  // 동기화 가능한 키 필터링
  private filterSyncableKeys(state: any): any {
    if (this.options.syncKeys.includes('*')) {
      return state;
    }

    const filtered: any = {};
    for (const key of this.options.syncKeys) {
      if (state.hasOwnProperty(key)) {
        filtered[key] = state[key];
      }
    }
    return filtered;
  }

  // 탭 활성 상태 확인
  private isTabActive(tab: TabInfo): boolean {
    const now = new Date();
    const timeSinceHeartbeat = now.getTime() - tab.lastHeartbeat.getTime();
    return timeSinceHeartbeat <= this.options.heartbeatInterval * 2;
  }

  // 상태 업데이트 알림
  private notifyStateUpdate(state: any, sourceTab: string): void {
    for (const callback of this.onStateUpdateCallbacks) {
      try {
        callback(state, sourceTab);
      } catch (error) {
        console.error('Error in state update callback:', error);
      }
    }
  }

  // 충돌 해결 알림
  private notifyConflictResolution(resolution: SyncConflictResolution): void {
    for (const callback of this.onConflictCallbacks) {
      try {
        callback(resolution);
      } catch (error) {
        console.error('Error in conflict resolution callback:', error);
      }
    }
  }

  // 탭 ID 생성
  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 현재 탭 정보 조회
  getCurrentTabInfo(): TabInfo | undefined {
    return this.tabs.get(this.tabId);
  }

  // 활성 탭 목록 조회
  getActiveTabs(): TabInfo[] {
    return Array.from(this.tabs.values()).filter(tab => tab.active);
  }

  // 마스터 탭 여부 확인
  isMasterTab(): boolean {
    return this.isMaster;
  }

  // 동기화 요청
  requestSync(): void {
    this.broadcastMessage({
      type: 'sync_request',
      tabId: this.tabId,
      data: {},
      timestamp: new Date(),
      source: this.tabId
    });
  }

  // 로컬 상태 업데이트
  updateLocalState(state: any): void {
    const tab = this.tabs.get(this.tabId);
    if (tab) {
      tab.sessionData = { ...tab.sessionData, ...state };
    }
  }

  // 리소스 정리
  destroy(): void {
    // 탭 닫힘 알림
    this.broadcastMessage({
      type: 'tab_closed',
      tabId: this.tabId,
      data: {},
      timestamp: new Date(),
      source: this.tabId
    });

    // 타이머 정리
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // 채널 정리
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    // 콜백 정리
    this.onStateUpdateCallbacks = [];
    this.onConflictCallbacks = [];
    this.tabs.clear();
  }
} 