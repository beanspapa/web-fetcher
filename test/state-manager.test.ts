import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  StateManager, 
  NavigationSession, 
  CategoryState, 
  SearchFilters, 
  SessionSnapshot 
} from '../src/state-manager';

describe('State Manager - Navigation Session Tracking', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager({
      maxAge: 60000, // 1분 (테스트용)
      maxHistoryLength: 5,
      autoSave: false, // 테스트에서는 수동 제어
      compression: true,
      encryption: false
    });
  });

  afterEach(() => {
    stateManager.destroy();
  });

  describe('Session Creation and Management', () => {
    it('should create a new session with initial values', () => {
      const url = 'https://news.example.com';
      const session = stateManager.createSession(url);

      expect(session.id).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(session.currentUrl).toBe(url);
      expect(session.visitedPages).toEqual([url]);
      expect(session.isActive).toBe(true);
      expect(session.categoryState.currentCategory).toBeNull();
      expect(session.searchFilters.keywords).toEqual([]);
    });

    it('should save and restore session correctly', () => {
      const session = stateManager.createSession('https://news.example.com');
      const sessionId = session.id;

      // 세션 수정
      session.currentUrl = 'https://news.example.com/politics';
      stateManager.saveSession(session);

      // 세션 복원
      const restoredSession = stateManager.restoreSession(sessionId);
      expect(restoredSession).not.toBeNull();
      expect(restoredSession!.currentUrl).toBe('https://news.example.com/politics');
    });

    it('should return null for non-existent session', () => {
      const result = stateManager.restoreSession('non-existent-id');
      expect(result).toBeNull();
    });

    it('should delete expired sessions automatically', async () => {
      // 짧은 만료 시간으로 StateManager 생성
      const shortTermManager = new StateManager({ maxAge: 100 }); // 100ms
      
      const session = shortTermManager.createSession('https://news.example.com');
      const sessionId = session.id;

      // 만료 시간 대기
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = shortTermManager.restoreSession(sessionId);
      expect(result).toBeNull();

      shortTermManager.destroy();
    });

    it('should track multiple active sessions', () => {
      const session1 = stateManager.createSession('https://news1.com');
      const session2 = stateManager.createSession('https://news2.com');
      const session3 = stateManager.createSession('https://news3.com');

      const activeSessions = stateManager.getActiveSessions();
      expect(activeSessions).toHaveLength(3);
      expect(activeSessions.map(s => s.id)).toContain(session1.id);
      expect(activeSessions.map(s => s.id)).toContain(session2.id);
      expect(activeSessions.map(s => s.id)).toContain(session3.id);
    });
  });

  describe('Navigation Location Tracking', () => {
    it('should update current location and add to history', () => {
      const session = stateManager.createSession('https://news.example.com');
      const sessionId = session.id;

      stateManager.updateCurrentLocation(sessionId, 'https://news.example.com/politics');
      stateManager.updateCurrentLocation(sessionId, 'https://news.example.com/economy');

      const updatedSession = stateManager.restoreSession(sessionId);
      expect(updatedSession!.currentUrl).toBe('https://news.example.com/economy');
      expect(updatedSession!.visitedPages).toEqual([
        'https://news.example.com',
        'https://news.example.com/politics',
        'https://news.example.com/economy'
      ]);
    });

    it('should limit history length according to maxHistoryLength', () => {
      const session = stateManager.createSession('https://news.example.com');
      const sessionId = session.id;

      // maxHistoryLength가 5이므로 6개 URL 추가
      const urls = [
        'https://news.example.com/page1',
        'https://news.example.com/page2',
        'https://news.example.com/page3',
        'https://news.example.com/page4',
        'https://news.example.com/page5',
        'https://news.example.com/page6'
      ];

      urls.forEach(url => {
        stateManager.updateCurrentLocation(sessionId, url);
      });

      const updatedSession = stateManager.restoreSession(sessionId);
      expect(updatedSession!.visitedPages).toHaveLength(5);
      expect(updatedSession!.visitedPages[0]).toBe('https://news.example.com/page2'); // 첫 번째는 제거됨
      expect(updatedSession!.visitedPages[4]).toBe('https://news.example.com/page6'); // 마지막
    });

    it('should throw error for invalid session ID', () => {
      expect(() => {
        stateManager.updateCurrentLocation('invalid-id', 'https://news.example.com');
      }).toThrow('Session not found');
    });
  });

  describe('Category State Management', () => {
    it('should update category state correctly', () => {
      const session = stateManager.createSession('https://news.example.com');
      const sessionId = session.id;

      const categoryState: Partial<CategoryState> = {
        currentCategory: '정치',
        selectedSubCategory: '대통령실',
        breadcrumbs: ['홈', '정치', '대통령실']
      };

      stateManager.updateCategoryState(sessionId, categoryState);

      const updatedSession = stateManager.restoreSession(sessionId);
      expect(updatedSession!.categoryState.currentCategory).toBe('정치');
      expect(updatedSession!.categoryState.selectedSubCategory).toBe('대통령실');
      expect(updatedSession!.categoryState.breadcrumbs).toEqual(['홈', '정치', '대통령실']);
    });

    it('should preserve existing category state when partially updating', () => {
      const session = stateManager.createSession('https://news.example.com');
      const sessionId = session.id;

      // 초기 상태 설정
      stateManager.updateCategoryState(sessionId, {
        currentCategory: '정치',
        categoryHistory: ['정치']
      });

      // 부분 업데이트
      stateManager.updateCategoryState(sessionId, {
        selectedSubCategory: '대통령실'
      });

      const updatedSession = stateManager.restoreSession(sessionId);
      expect(updatedSession!.categoryState.currentCategory).toBe('정치');
      expect(updatedSession!.categoryState.selectedSubCategory).toBe('대통령실');
      expect(updatedSession!.categoryState.categoryHistory).toEqual(['정치']);
    });
  });

  describe('Search Filters Management', () => {
    it('should update search filters correctly', () => {
      const session = stateManager.createSession('https://news.example.com');
      const sessionId = session.id;

      const filters: Partial<SearchFilters> = {
        keywords: ['선거', '정책'],
        sortBy: 'relevance',
        pageSize: 20,
        sources: ['연합뉴스', '조선일보']
      };

      stateManager.updateSearchFilters(sessionId, filters);

      const updatedSession = stateManager.restoreSession(sessionId);
      expect(updatedSession!.searchFilters.keywords).toEqual(['선거', '정책']);
      expect(updatedSession!.searchFilters.sortBy).toBe('relevance');
      expect(updatedSession!.searchFilters.pageSize).toBe(20);
      expect(updatedSession!.searchFilters.sources).toEqual(['연합뉴스', '조선일보']);
    });

    it('should handle date range filters', () => {
      const session = stateManager.createSession('https://news.example.com');
      const sessionId = session.id;

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      stateManager.updateSearchFilters(sessionId, {
        dateRange: { start: startDate, end: endDate }
      });

      const updatedSession = stateManager.restoreSession(sessionId);
      expect(updatedSession!.searchFilters.dateRange.start).toEqual(startDate);
      expect(updatedSession!.searchFilters.dateRange.end).toEqual(endDate);
    });
  });

  describe('Session Serialization and Deserialization', () => {
    it('should serialize session to snapshot correctly', () => {
      const session = stateManager.createSession('https://news.example.com');
      
      // 세션에 데이터 추가
      session.categoryState.currentCategory = '정치';
      session.searchFilters.keywords = ['테스트'];

      const snapshot = stateManager.serializeSession(session);

      expect(snapshot.version).toBe('1.0');
      expect(snapshot.compressed).toBe(true);
      expect(snapshot.data).toBeTruthy();
      expect(snapshot.checksum).toBeTruthy();
      expect(snapshot.createdAt).toBeInstanceOf(Date);
    });

    it('should deserialize snapshot back to session correctly', () => {
      const originalSession = stateManager.createSession('https://news.example.com');
      originalSession.categoryState.currentCategory = '정치';
      originalSession.searchFilters.keywords = ['테스트'];

      const snapshot = stateManager.serializeSession(originalSession);
      const deserializedSession = stateManager.deserializeSession(snapshot);

      expect(deserializedSession.id).toBe(originalSession.id);
      expect(deserializedSession.currentUrl).toBe(originalSession.currentUrl);
      expect(deserializedSession.categoryState.currentCategory).toBe('정치');
      expect(deserializedSession.searchFilters.keywords).toEqual(['테스트']);
    });

    it('should detect corrupted session data', () => {
      const session = stateManager.createSession('https://news.example.com');
      const snapshot = stateManager.serializeSession(session);

      // 체크섬 조작
      snapshot.checksum = 'invalid-checksum';

      expect(() => {
        stateManager.deserializeSession(snapshot);
      }).toThrow('Session data corrupted');
    });

    it('should handle compression correctly', () => {
      const uncompressedManager = new StateManager({ compression: false });
      const compressedManager = new StateManager({ compression: true });

      const session1 = uncompressedManager.createSession('https://news.example.com');
      const session2 = compressedManager.createSession('https://news.example.com');

      const snapshot1 = uncompressedManager.serializeSession(session1);
      const snapshot2 = compressedManager.serializeSession(session2);

      expect(snapshot1.compressed).toBe(false);
      expect(snapshot2.compressed).toBe(true);

      // 압축된 데이터가 더 긴 경우가 있을 수 있음 (짧은 데이터의 경우)
      // 하지만 구조는 올바르게 작동해야 함
      const restored1 = uncompressedManager.deserializeSession(snapshot1);
      const restored2 = compressedManager.deserializeSession(snapshot2);

      expect(restored1.currentUrl).toBe(session1.currentUrl);
      expect(restored2.currentUrl).toBe(session2.currentUrl);

      uncompressedManager.destroy();
      compressedManager.destroy();
    });
  });

  describe('Session Lifecycle Management', () => {
    it('should deactivate session correctly', () => {
      const session = stateManager.createSession('https://news.example.com');
      const sessionId = session.id;

      expect(session.isActive).toBe(true);

      stateManager.deactivateSession(sessionId);

      const updatedSession = stateManager.restoreSession(sessionId);
      expect(updatedSession!.isActive).toBe(false);

      const activeSessions = stateManager.getActiveSessions();
      expect(activeSessions).toHaveLength(0);
    });

    it('should delete session completely', () => {
      const session = stateManager.createSession('https://news.example.com');
      const sessionId = session.id;

      const deleted = stateManager.deleteSession(sessionId);
      expect(deleted).toBe(true);

      const restoredSession = stateManager.restoreSession(sessionId);
      expect(restoredSession).toBeNull();
    });

    it('should clear all sessions', () => {
      stateManager.createSession('https://news1.com');
      stateManager.createSession('https://news2.com');
      stateManager.createSession('https://news3.com');

      expect(stateManager.getActiveSessions()).toHaveLength(3);

      stateManager.clearAllSessions();

      expect(stateManager.getActiveSessions()).toHaveLength(0);
    });

    it('should handle auto-save cleanup', async () => {
      const autoSaveManager = new StateManager({
        maxAge: 100, // 100ms
        autoSave: true
      });

      const session = autoSaveManager.createSession('https://news.example.com');

      // 만료 시간 대기
      await new Promise(resolve => setTimeout(resolve, 200));

      // 자동 정리가 실행되었는지 확인하기 위해 직접 호출
      autoSaveManager.clearExpiredSessions();

      const activeSessions = autoSaveManager.getActiveSessions();
      expect(activeSessions).toHaveLength(0);

      autoSaveManager.destroy();
    });
  });
}); 