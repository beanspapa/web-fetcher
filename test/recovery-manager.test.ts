import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  RecoveryManager, 
  RecoveryStrategy, 
  ErrorClassification, 
  RecoveryResult 
} from '../src/recovery-manager';

describe('Recovery Manager - Error Detection and Auto Recovery', () => {
  let recoveryManager: RecoveryManager;

  beforeEach(() => {
    recoveryManager = new RecoveryManager({
      enableAutoRecovery: true,
      maxGlobalAttempts: 5,
      globalTimeout: 30000,
      logRecoveryAttempts: false, // 테스트에서 로그 비활성화
      notifyOnFailure: false,
      customStrategies: new Map()
    });
  });

  afterEach(() => {
    recoveryManager.destroy();
  });

  describe('Error Classification', () => {
    it('should classify network errors correctly', () => {
      const networkError = new Error('Connection timeout');
      const classification = recoveryManager.classifyError(networkError);

      expect(classification.category).toBe('network');
      expect(classification.severity).toBe('medium');
      expect(classification.recoverable).toBe(true);
      expect(classification.suggestedStrategy.type).toBe('retry');
    });

    it('should classify page errors correctly', () => {
      const pageError = new Error('404 Page not found');
      const classification = recoveryManager.classifyError(pageError);

      expect(classification.category).toBe('page');
      expect(classification.severity).toBe('high');
      expect(classification.recoverable).toBe(true);
      expect(classification.suggestedStrategy.type).toBe('refresh');
    });

    it('should classify selector errors correctly', () => {
      const selectorError = new Error('Element not found');
      const classification = recoveryManager.classifyError(selectorError);

      expect(classification.category).toBe('selector');
      expect(classification.severity).toBe('low');
      expect(classification.recoverable).toBe(true);
      expect(classification.suggestedStrategy.type).toBe('alternative');
    });

    it('should classify timeout errors correctly', () => {
      const timeoutError = new Error('Operation timeout');
      const classification = recoveryManager.classifyError(timeoutError);

      expect(classification.category).toBe('timeout');
      expect(classification.severity).toBe('medium');
      expect(classification.recoverable).toBe(true);
      expect(classification.suggestedStrategy.type).toBe('retry');
    });

    it('should classify browser crash as non-recoverable', () => {
      const crashError = new Error('Browser closed unexpectedly');
      const classification = recoveryManager.classifyError(crashError);

      expect(classification.category).toBe('browser');
      expect(classification.severity).toBe('critical');
      expect(classification.recoverable).toBe(false);
      expect(classification.suggestedStrategy.type).toBe('rollback');
    });

    it('should classify unknown errors', () => {
      const unknownError = new Error('Some unknown error');
      const classification = recoveryManager.classifyError(unknownError);

      expect(classification.category).toBe('unknown');
      expect(classification.severity).toBe('medium');
      expect(classification.recoverable).toBe(false);
    });
  });

  describe('Retry Strategy Recovery', () => {
    it('should successfully recover with retry strategy after few attempts', async () => {
      let attemptCount = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary network error');
        }
        return 'success';
      });

      const error = new Error('Network timeout');
      const result = await recoveryManager.executeRecovery(error, operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toHaveLength(3);
      expect(result.strategyUsed).toBe('retry');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after maximum attempts with retry strategy', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent network error'));

      const error = new Error('Network timeout');
      const result = await recoveryManager.executeRecovery(error, operation);

      expect(result.success).toBe(false);
      expect(result.finalError).toBeDefined();
      expect(result.attempts.length).toBeGreaterThan(0);
      expect(result.strategyUsed).toBe('retry');
    });

    it('should apply exponential backoff between retry attempts', async () => {
      const timestamps: number[] = [];
      const operation = vi.fn().mockImplementation(async () => {
        timestamps.push(Date.now());
        throw new Error('Network timeout');
      });

      const error = new Error('Network timeout');
      await recoveryManager.executeRecovery(error, operation);

      // 백오프 간격이 증가하는지 확인
      for (let i = 1; i < timestamps.length; i++) {
        const interval = timestamps[i] - timestamps[i - 1];
        expect(interval).toBeGreaterThan(500); // 최소 백오프 시간
      }
    });
  });

  describe('Refresh Strategy Recovery', () => {
    it('should execute refresh strategy with page context', async () => {
      const mockPage = {
        reload: vi.fn().mockResolvedValue(undefined)
      };

      const operation = vi.fn().mockResolvedValue('success');
      const context = { page: mockPage };

      const error = new Error('500 Server error');
      const result = await recoveryManager.executeRecovery(error, operation, context);

      expect(result.success).toBe(true);
      expect(mockPage.reload).toHaveBeenCalled();
      expect(operation).toHaveBeenCalled();
    });
  });

  describe('Recovery Limitations and Safety', () => {
    it('should respect maximum global attempts limit', async () => {
      const limitedManager = new RecoveryManager({ maxGlobalAttempts: 2 });
      
      const operation = vi.fn().mockRejectedValue(new Error('Persistent error'));
      const error = new Error('Network timeout');

      const result = await limitedManager.executeRecovery(error, operation);

      expect(result.attempts).toHaveLength(2);
      expect(operation).toHaveBeenCalledTimes(2);
      
      limitedManager.destroy();
    });

    it('should not attempt recovery when auto-recovery is disabled', async () => {
      const disabledManager = new RecoveryManager({ enableAutoRecovery: false });
      
      const operation = vi.fn();
      const error = new Error('Network timeout');

      const result = await disabledManager.executeRecovery(error, operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toHaveLength(0);
      expect(result.strategyUsed).toBe('none');
      expect(operation).not.toHaveBeenCalled();
      
      disabledManager.destroy();
    });

    it('should not recover non-recoverable errors', async () => {
      const operation = vi.fn();
      const error = new Error('Browser closed unexpectedly');

      const result = await recoveryManager.executeRecovery(error, operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toHaveLength(0);
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('Recoverable Error Detection', () => {
    it('should correctly identify recoverable errors', () => {
      expect(recoveryManager.isRecoverable(new Error('Network timeout'))).toBe(true);
      expect(recoveryManager.isRecoverable(new Error('404 not found'))).toBe(true);
      expect(recoveryManager.isRecoverable(new Error('Element not found'))).toBe(true);
    });

    it('should correctly identify non-recoverable errors', () => {
      expect(recoveryManager.isRecoverable(new Error('Browser closed'))).toBe(false);
      expect(recoveryManager.isRecoverable(new Error('Unknown error'))).toBe(false);
    });
  });
}); 