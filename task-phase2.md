# Task Phase 2: 테스트 프레임워크 설정 (Vitest)

이 문서는 AI Agent가 자동으로 실행할 수 있도록 상세하게 작성된 Phase 2 개발 태스크입니다.

**Phase 2 목표**: Vitest 테스트 프레임워크 설치 및 기본 테스트 환경 구축

**실행 원칙**:
- 각 태스크는 순차적으로 실행
- 실패 시 명시된 복구 전략 적용
- 모든 검증 기준 통과 후 다음 단계 진행

---

## Phase 2: 테스트 프레임워크 설정 (Vitest)

### Task 2.1: Vitest 테스트 환경 구축
**목표**: Vitest 설치 및 기본 설정 완료

**실행 단계**:
1. **Vitest 패키지 설치**
   ```bash
   npm install --save-dev vitest @vitest/ui happy-dom
   ```
   - **성공 기준**: package.json devDependencies에 패키지 추가
   - **실패 시**: npm 레지스트리 확인 후 재시도

2. **vite.config.ts 생성**
   - **파일**: `vite.config.ts`
   - **내용**:
   ```typescript
   import { defineConfig } from 'vite';

   export default defineConfig({
     test: {
       globals: true,
       environment: 'happy-dom',
       include: ['test/**/*.test.ts'],
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html'],
         exclude: [
           'node_modules/',
           'test/',
           'dist/',
           '**/*.d.ts'
         ]
       }
     }
   });
   ```

3. **첫 번째 더미 테스트 작성**
   - **파일**: `test/dummy.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect } from 'vitest';

   describe('Dummy Test', () => {
     it('should pass basic assertion', () => {
       expect(1 + 1).toBe(2);
     });

     it('should handle string operations', () => {
       expect('hello world').toContain('world');
     });

     it('should work with arrays', () => {
       const arr = [1, 2, 3];
       expect(arr).toHaveLength(3);
       expect(arr).toContain(2);
     });
   });
   ```

4. **테스트 실행 확인**
   ```bash
   npx vitest run test/dummy.test.ts
   ```
   - **성공 기준**: 모든 테스트 통과 (3 passed)
   - **실패 시**: 설정 파일 재검토 후 재실행

**완료 조건**: Vitest 설치 완료, 설정 파일 생성, 더미 테스트 통과
**다음 단계**: Task 2.2
**실패 시 복구**: node_modules 삭제 후 패키지 재설치

---

### Task 2.2: 테스트 스크립트 설정
**목표**: package.json에 테스트 관련 스크립트 추가

**실행 단계**:
1. **package.json 스크립트 섹션 업데이트**
   - **수정할 파일**: `package.json`
   - **추가할 스크립트**:
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:run": "vitest run",
       "test:watch": "vitest --watch",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest run --coverage",
       "build": "tsc",
       "start": "node dist/main.js",
       "dev": "tsc --watch"
     }
   }
   ```

2. **테스트 스크립트 실행 확인**
   ```bash
   npm test -- --run
   ```
   - **성공 기준**: 테스트 실행 및 통과
   - **실패 시**: package.json 스크립트 섹션 재확인

3. **스크립트 검증 테스트**
   - **파일**: `test/scripts.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { readFileSync } from 'fs';

   describe('Package Scripts', () => {
     it('should have required test scripts', () => {
       const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
       const scripts = pkg.scripts;
       
       expect(scripts).toHaveProperty('test');
       expect(scripts).toHaveProperty('test:run');
       expect(scripts).toHaveProperty('test:coverage');
       expect(scripts).toHaveProperty('build');
       expect(scripts).toHaveProperty('start');
     });
   });
   ```

**완료 조건**: 모든 스크립트 추가 완료, 테스트 실행 성공
**다음 단계**: Phase 3
**실패 시 복구**: package.json 백업에서 복원 후 재실행

---

## 에러 처리 및 복구 전략

### 일반적인 에러 상황
1. **패키지 설치 실패**
   - npm 캐시 클리어: `npm cache clean --force`
   - 레지스트리 변경: `npm config set registry https://registry.npmjs.org/`
   - 재시도 3회 후 수동 개입 요청

2. **테스트 실패**
   - 에러 로그 분석 및 출력
   - 관련 파일 재생성
   - 의존성 재설치

3. **파일 시스템 에러**
   - 권한 확인
   - 디스크 공간 확인
   - 경로 유효성 검증

### 복구 체크포인트
- 각 Phase 완료 시 Git 커밋
- 설정 파일 백업
- 테스트 통과 상태 저장

---

## Phase 2 완료 체크리스트

- [ ] Task 2.1: Vitest 테스트 환경 구축 완료
- [ ] Task 2.2: 테스트 스크립트 설정 완료
- [ ] 모든 테스트 통과
- [ ] Git 커밋 완료
- [ ] 다음 Phase 준비 완료 