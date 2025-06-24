// 에러 복구 관련 인터페이스
export interface RecoveryStrategy {
  type: 'retry' | 'refresh' | 'rollback' | 'alternative';
  maxAttempts: number;
  backoffMs: number;
  timeout?: number;
  fallbackAction?: () => Promise<void>;
  condition?: (error: Error) => boolean;
}

export interface ErrorClassification {
  category: 'network' | 'page' | 'browser' | 'selector' | 'timeout' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  suggestedStrategy: RecoveryStrategy;
}

export interface RecoveryAttempt {
  id: string;
  error: Error;
  strategy: RecoveryStrategy;
  attemptNumber: number;
  timestamp: Date;
  success: boolean;
  duration: number;
  resultMessage?: string;
}

export interface RecoveryResult {
  success: boolean;
  attempts: RecoveryAttempt[];
  finalError?: Error;
  recoveryTime: number;
  strategyUsed: string;
}

export interface RecoveryOptions {
  enableAutoRecovery: boolean;
  maxGlobalAttempts: number;
  globalTimeout: number;
  logRecoveryAttempts: boolean;
  notifyOnFailure: boolean;
  customStrategies: Map<string, RecoveryStrategy>;
}

// 에러 복구 관리자
export class RecoveryManager {
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private recoveryHistory: RecoveryAttempt[] = [];
  private options: RecoveryOptions;
  private onRecoveryFailed?: (error: Error, attempts: RecoveryAttempt[]) => void;

  constructor(options: Partial<RecoveryOptions> = {}) {
    this.options = {
      enableAutoRecovery: true,
      maxGlobalAttempts: 10,
      globalTimeout: 300000, // 5분
      logRecoveryAttempts: true,
      notifyOnFailure: true,
      customStrategies: new Map(),
      ...options
    };

    this.initializeDefaultStrategies();
  }

  // 기본 복구 전략 초기화
  private initializeDefaultStrategies(): void {
    // 네트워크 오류 전략
    this.strategies.set('network_error', {
      type: 'retry',
      maxAttempts: 3,
      backoffMs: 1000,
      timeout: 30000,
      condition: (error) => this.isNetworkError(error)
    });

    // 페이지 로딩 오류 전략
    this.strategies.set('page_error', {
      type: 'refresh',
      maxAttempts: 2,
      backoffMs: 2000,
      timeout: 60000,
      condition: (error) => this.isPageError(error)
    });

    // 선택자 실패 전략
    this.strategies.set('selector_error', {
      type: 'alternative',
      maxAttempts: 5,
      backoffMs: 500,
      timeout: 10000,
      condition: (error) => this.isSelectorError(error)
    });

    // 타임아웃 오류 전략
    this.strategies.set('timeout_error', {
      type: 'retry',
      maxAttempts: 2,
      backoffMs: 5000,
      timeout: 120000,
      condition: (error) => this.isTimeoutError(error)
    });

    // 브라우저 크래시 전략
    this.strategies.set('browser_crash', {
      type: 'rollback',
      maxAttempts: 1,
      backoffMs: 0,
      timeout: 30000,
      condition: (error) => this.isBrowserCrash(error)
    });

    // 사용자 정의 전략 추가
    for (const [key, strategy] of this.options.customStrategies) {
      this.strategies.set(key, strategy);
    }
  }

  // 오류 분류
  classifyError(error: Error): ErrorClassification {
    // 타임아웃 에러를 먼저 확인 (네트워크 에러와 겹칠 수 있음)
    if (this.isTimeoutError(error)) {
      return {
        category: 'timeout',
        severity: 'medium',
        recoverable: true,
        suggestedStrategy: this.strategies.get('timeout_error')!
      };
    }

    if (this.isBrowserCrash(error)) {
      return {
        category: 'browser',
        severity: 'critical',
        recoverable: false,
        suggestedStrategy: this.strategies.get('browser_crash')!
      };
    }

    if (this.isPageError(error)) {
      return {
        category: 'page',
        severity: 'high',
        recoverable: true,
        suggestedStrategy: this.strategies.get('page_error')!
      };
    }

    if (this.isSelectorError(error)) {
      return {
        category: 'selector',
        severity: 'low',
        recoverable: true,
        suggestedStrategy: this.strategies.get('selector_error')!
      };
    }

    if (this.isNetworkError(error)) {
      return {
        category: 'network',
        severity: 'medium',
        recoverable: true,
        suggestedStrategy: this.strategies.get('network_error')!
      };
    }

    return {
      category: 'unknown',
      severity: 'medium',
      recoverable: false,
      suggestedStrategy: {
        type: 'retry',
        maxAttempts: 1,
        backoffMs: 1000
      }
    };
  }

  // 복구 전략 등록
  registerRecoveryStrategy(errorType: string, strategy: RecoveryStrategy): void {
    this.strategies.set(errorType, strategy);
  }

  // 복구 실행
  async executeRecovery(
    error: Error, 
    operation: () => Promise<any>,
    context?: any
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    const attempts: RecoveryAttempt[] = [];

    if (!this.options.enableAutoRecovery) {
      return {
        success: false,
        attempts: [],
        finalError: error,
        recoveryTime: 0,
        strategyUsed: 'none'
      };
    }

    const classification = this.classifyError(error);
    if (!classification.recoverable) {
      return {
        success: false,
        attempts: [],
        finalError: error,
        recoveryTime: Date.now() - startTime,
        strategyUsed: 'none'
      };
    }

    const strategy = classification.suggestedStrategy;
    let currentAttempt = 0;
    let lastError = error;

    while (currentAttempt < strategy.maxAttempts && currentAttempt < this.options.maxGlobalAttempts) {
      const attemptStartTime = Date.now();
      const attemptId = this.generateAttemptId();

      try {
        if (currentAttempt > 0) {
          await this.applyBackoff(strategy.backoffMs, currentAttempt);
        }

        await this.executeStrategy(strategy, operation, context);

        // 성공한 경우
        const attempt: RecoveryAttempt = {
          id: attemptId,
          error: lastError,
          strategy,
          attemptNumber: currentAttempt + 1,
          timestamp: new Date(),
          success: true,
          duration: Date.now() - attemptStartTime,
          resultMessage: 'Recovery successful'
        };

        attempts.push(attempt);
        this.recordRecoveryAttempt(attempt);

        return {
          success: true,
          attempts,
          recoveryTime: Date.now() - startTime,
          strategyUsed: strategy.type
        };

      } catch (recoveryError) {
        lastError = recoveryError as Error;

        const attempt: RecoveryAttempt = {
          id: attemptId,
          error: lastError,
          strategy,
          attemptNumber: currentAttempt + 1,
          timestamp: new Date(),
          success: false,
          duration: Date.now() - attemptStartTime,
          resultMessage: lastError.message
        };

        attempts.push(attempt);
        this.recordRecoveryAttempt(attempt);

        currentAttempt++;
      }
    }

    // 모든 복구 시도 실패
    if (this.options.notifyOnFailure && this.onRecoveryFailed) {
      this.onRecoveryFailed(lastError, attempts);
    }

    return {
      success: false,
      attempts,
      finalError: lastError,
      recoveryTime: Date.now() - startTime,
      strategyUsed: strategy.type
    };
  }

  // 복구 가능 여부 확인
  isRecoverable(error: Error): boolean {
    const classification = this.classifyError(error);
    return classification.recoverable;
  }

  // 복구 전략 실행
  private async executeStrategy(
    strategy: RecoveryStrategy,
    operation: () => Promise<any>,
    context?: any
  ): Promise<any> {
    switch (strategy.type) {
      case 'retry':
        return await operation();

      case 'refresh':
        if (context && context.page) {
          await context.page.reload();
          await new Promise(resolve => setTimeout(resolve, 2000)); // 페이지 로딩 대기
        }
        return await operation();

      case 'rollback':
        if (context && context.restoreState) {
          await context.restoreState();
        }
        return await operation();

      case 'alternative':
        if (strategy.fallbackAction) {
          await strategy.fallbackAction();
        }
        return await operation();

      default:
        throw new Error(`Unknown recovery strategy: ${strategy.type}`);
    }
  }

  // 백오프 적용 (지수 백오프)
  private async applyBackoff(baseMs: number, attempt: number): Promise<void> {
    const delay = baseMs * Math.pow(2, attempt - 1) + Math.random() * 1000; // 지터 추가
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // 오류 유형 감지 메소드들
  private isTimeoutError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const timeoutKeywords = ['operation timeout', 'execution timeout', 'wait timeout'];
    return timeoutKeywords.some(keyword => message.includes(keyword)) || 
           (message.includes('timeout') && !this.isNetworkTimeoutError(error));
  }

  private isNetworkTimeoutError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('connection timeout') || 
           message.includes('network timeout') ||
           message.includes('request timeout');
  }

  private isNetworkError(error: Error): boolean {
    const networkKeywords = ['network', 'connection', 'ECONNREFUSED', 'ENOTFOUND'];
    return networkKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword.toLowerCase())
    ) || this.isNetworkTimeoutError(error);
  }

  private isPageError(error: Error): boolean {
    const pageKeywords = ['404', '500', 'page not found', 'server error'];
    return pageKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isSelectorError(error: Error): boolean {
    const selectorKeywords = ['selector', 'element not found', 'no such element'];
    return selectorKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isBrowserCrash(error: Error): boolean {
    const crashKeywords = ['browser closed', 'context destroyed', 'target closed'];
    return crashKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // 복구 시도 기록
  private recordRecoveryAttempt(attempt: RecoveryAttempt): void {
    this.recoveryHistory.push(attempt);
    
    // 히스토리 크기 제한 (최대 1000개)
    if (this.recoveryHistory.length > 1000) {
      this.recoveryHistory = this.recoveryHistory.slice(-1000);
    }

    if (this.options.logRecoveryAttempts) {
      console.log(`Recovery attempt ${attempt.id}: ${attempt.success ? 'SUCCESS' : 'FAILED'} - ${attempt.resultMessage}`);
    }
  }

  // 복구 히스토리 조회
  getRecoveryHistory(limit?: number): RecoveryAttempt[] {
    const history = [...this.recoveryHistory].reverse(); // 최신순
    return limit ? history.slice(0, limit) : history;
  }

  // 복구 실패 콜백 등록
  onRecoveryFailure(callback: (error: Error, attempts: RecoveryAttempt[]) => void): void {
    this.onRecoveryFailed = callback;
  }

  // 복구 성공률 통계
  getRecoveryStats(): {
    totalAttempts: number;
    successfulRecoveries: number;
    successRate: number;
    averageRecoveryTime: number;
    strategyStats: Map<string, { attempts: number; successes: number; }>;
  } {
    const strategyStats = new Map<string, { attempts: number; successes: number; }>();
    let totalDuration = 0;
    let successfulRecoveries = 0;

    for (const attempt of this.recoveryHistory) {
      const strategyType = attempt.strategy.type;
      
      if (!strategyStats.has(strategyType)) {
        strategyStats.set(strategyType, { attempts: 0, successes: 0 });
      }

      const stats = strategyStats.get(strategyType)!;
      stats.attempts++;
      
      if (attempt.success) {
        stats.successes++;
        successfulRecoveries++;
        totalDuration += attempt.duration;
      }
    }

    return {
      totalAttempts: this.recoveryHistory.length,
      successfulRecoveries,
      successRate: this.recoveryHistory.length > 0 ? successfulRecoveries / this.recoveryHistory.length : 0,
      averageRecoveryTime: successfulRecoveries > 0 ? totalDuration / successfulRecoveries : 0,
      strategyStats
    };
  }

  // 시도 ID 생성
  private generateAttemptId(): string {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 리소스 정리
  destroy(): void {
    this.strategies.clear();
    this.recoveryHistory = [];
    this.onRecoveryFailed = undefined;
  }
} 