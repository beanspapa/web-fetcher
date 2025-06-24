// 세션 상태 관리 인터페이스
export interface NavigationSession {
  id: string;
  currentUrl: string;
  visitedPages: string[];
  categoryState: CategoryState;
  searchFilters: SearchFilters;
  timestamp: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface CategoryState {
  currentCategory: string | null;
  selectedSubCategory: string | null;
  categoryHistory: string[];
  breadcrumbs: string[];
}

export interface SearchFilters {
  keywords: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  sources: string[];
  sortBy: 'date' | 'relevance' | 'popularity';
  pageSize: number;
}

export interface SessionSnapshot {
  version: string;
  compressed: boolean;
  data: string; // JSON 직렬화된 세션 데이터
  checksum: string;
  createdAt: Date;
}

export interface SessionOptions {
  maxAge: number; // 세션 유효 시간 (ms)
  maxHistoryLength: number; // 방문 히스토리 최대 길이
  autoSave: boolean; // 자동 저장 여부
  compression: boolean; // 압축 저장 여부
  encryption: boolean; // 암호화 여부
}

// 상태 관리자 클래스
export class StateManager {
  private sessions: Map<string, NavigationSession> = new Map();
  private options: SessionOptions;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(options: Partial<SessionOptions> = {}) {
    this.options = {
      maxAge: 24 * 60 * 60 * 1000, // 24시간
      maxHistoryLength: 100,
      autoSave: true,
      compression: true,
      encryption: false,
      ...options
    };

    if (this.options.autoSave) {
      this.startAutoSave();
    }
  }

  // 세션 생성
  createSession(url: string): NavigationSession {
    const session: NavigationSession = {
      id: this.generateSessionId(),
      currentUrl: url,
      visitedPages: [url],
      categoryState: {
        currentCategory: null,
        selectedSubCategory: null,
        categoryHistory: [],
        breadcrumbs: []
      },
      searchFilters: {
        keywords: [],
        dateRange: { start: null, end: null },
        sources: [],
        sortBy: 'date',
        pageSize: 10
      },
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + this.options.maxAge),
      isActive: true
    };

    this.sessions.set(session.id, session);
    return session;
  }

  // 세션 저장
  saveSession(session: NavigationSession): void {
    if (!session.id) {
      throw new Error('Session ID is required');
    }

    session.timestamp = new Date();
    this.sessions.set(session.id, { ...session });
  }

  // 세션 복원
  restoreSession(sessionId: string): NavigationSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (this.isSessionExpired(session)) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  // 현재 위치 업데이트
  updateCurrentLocation(sessionId: string, url: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.currentUrl = url;
    session.visitedPages.push(url);
    
    // 히스토리 길이 제한
    if (session.visitedPages.length > this.options.maxHistoryLength) {
      session.visitedPages = session.visitedPages.slice(-this.options.maxHistoryLength);
    }

    this.saveSession(session);
  }

  // 카테고리 상태 업데이트
  updateCategoryState(sessionId: string, categoryState: Partial<CategoryState>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.categoryState = { ...session.categoryState, ...categoryState };
    this.saveSession(session);
  }

  // 검색 필터 업데이트
  updateSearchFilters(sessionId: string, filters: Partial<SearchFilters>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.searchFilters = { ...session.searchFilters, ...filters };
    this.saveSession(session);
  }

  // 세션 직렬화
  serializeSession(session: NavigationSession): SessionSnapshot {
    const data = JSON.stringify(session);
    const compressed = this.options.compression ? this.compress(data) : data;
    const checksum = this.generateChecksum(compressed);

    return {
      version: '1.0',
      compressed: this.options.compression,
      data: compressed,
      checksum,
      createdAt: new Date()
    };
  }

  // 세션 역직렬화
  deserializeSession(snapshot: SessionSnapshot): NavigationSession {
    if (!this.verifyChecksum(snapshot.data, snapshot.checksum)) {
      throw new Error('Session data corrupted');
    }

    const data = snapshot.compressed ? this.decompress(snapshot.data) : snapshot.data;
    return JSON.parse(data);
  }

  // 만료된 세션 정리
  clearExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // 활성 세션 목록
  getActiveSessions(): NavigationSession[] {
    this.clearExpiredSessions();
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  // 세션 비활성화
  deactivateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.saveSession(session);
    }
  }

  // 세션 삭제
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  // 모든 세션 삭제
  clearAllSessions(): void {
    this.sessions.clear();
  }

  // 세션 만료 확인
  private isSessionExpired(session: NavigationSession): boolean {
    return new Date() > session.expiresAt;
  }

  // 세션 ID 생성
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 자동 저장 시작
  private startAutoSave(): void {
    this.saveTimer = setInterval(() => {
      this.clearExpiredSessions();
    }, 5 * 60 * 1000); // 5분마다 정리
  }

  // 자동 저장 중지
  stopAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }

  // 데이터 압축 (간단한 구현)
  private compress(data: string): string {
    // 실제로는 gzip 등을 사용해야 하지만, 여기서는 간단한 구현
    return Buffer.from(data).toString('base64');
  }

  // 데이터 압축 해제
  private decompress(data: string): string {
    return Buffer.from(data, 'base64').toString();
  }

  // 체크섬 생성
  private generateChecksum(data: string): string {
    // 간단한 해시 함수 (실제로는 crypto.createHash 사용 권장)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    return hash.toString(16);
  }

  // 체크섬 검증
  private verifyChecksum(data: string, checksum: string): boolean {
    return this.generateChecksum(data) === checksum;
  }

  // 리소스 정리
  destroy(): void {
    this.stopAutoSave();
    this.clearAllSessions();
  }
} 