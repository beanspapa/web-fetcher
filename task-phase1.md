# Task Phase 1: 프로젝트 기반 설정

이 문서는 AI Agent가 자동으로 실행할 수 있도록 상세하게 작성된 Phase 1 개발 태스크입니다.

**Phase 1 목표**: Node.js 환경 검증 및 프로젝트 기본 구조 설정

**실행 원칙**:
- 각 태스크는 순차적으로 실행
- 실패 시 명시된 복구 전략 적용
- 모든 검증 기준 통과 후 다음 단계 진행

---

## Phase 1: 프로젝트 기반 설정

### Task 1.1: Node.js 환경 검증
**목표**: Node.js 환경이 올바르게 설정되어 있는지 확인

**전제조건**: 
- 운영체제: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- 네트워크 연결 필요

**실행 단계**:
1. **Node.js 버전 확인**
   ```bash
   node --version
   ```
   - **성공 기준**: v18.0.0 이상 출력
   - **실패 시**: Node.js 최신 LTS 설치 후 재시도

2. **npm 버전 확인**
   ```bash
   npm --version
   ```
   - **성공 기준**: v8.0.0 이상 출력
   - **실패 시**: npm 업데이트 `npm install -g npm@latest`

3. **검증 테스트 파일 생성**
   - **파일**: `test/environment.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { execSync } from 'child_process';

   describe('Environment Setup', () => {
     it('should have Node.js version 18 or higher', () => {
       const version = execSync('node --version', { encoding: 'utf8' });
       const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
       expect(majorVersion).toBeGreaterThanOrEqual(18);
     });

     it('should have npm version 8 or higher', () => {
       const version = execSync('npm --version', { encoding: 'utf8' });
       const majorVersion = parseInt(version.split('.')[0]);
       expect(majorVersion).toBeGreaterThanOrEqual(8);
     });
   });
   ```

**완료 조건**: 모든 버전 체크 통과
**다음 단계**: Task 1.2
**실패 시 복구**: Node.js 재설치 후 전체 Task 1.1 재실행

---

### Task 1.2: 프로젝트 구조 초기화
**목표**: Git 저장소 및 기본 프로젝트 구조 생성

**실행 단계**:
1. **현재 디렉터리 확인**
   ```bash
   pwd
   ```
   - **성공 기준**: `/path/to/web-fetcher` 형태의 경로 출력

2. **Git 저장소 초기화**
   ```bash
   git init
   ```
   - **성공 기준**: "Initialized empty Git repository" 메시지 출력
   - **실패 시**: Git 설치 여부 확인 후 재시도

3. **package.json 생성**
   ```bash
   npm init -y
   ```
   - **성공 기준**: `package.json` 파일 생성됨
   - **검증**: `ls package.json` 명령어로 파일 존재 확인

4. **기본 폴더 구조 생성**
   ```bash
   mkdir -p src test docs results
   ```
   - **성공 기준**: 모든 폴더 생성됨
   - **검증**: `ls -la` 출력에서 src, test, docs, results 폴더 확인

5. **구조 검증 테스트**
   - **파일**: `test/project-structure.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { existsSync } from 'fs';
   import { resolve } from 'path';

   describe('Project Structure', () => {
     const folders = ['src', 'test', 'docs', 'results'];
     
     folders.forEach(folder => {
       it(`should have ${folder} directory`, () => {
         expect(existsSync(resolve(folder))).toBe(true);
       });
     });

     it('should have package.json', () => {
       expect(existsSync('package.json')).toBe(true);
     });

     it('should have .git directory', () => {
       expect(existsSync('.git')).toBe(true);
     });
   });
   ```

**완료 조건**: 모든 폴더 및 파일 생성 완료, 테스트 통과
**다음 단계**: Task 1.3
**실패 시 복구**: 폴더 삭제 후 전체 Task 1.2 재실행

---

### Task 1.3: TypeScript 환경 설정
**목표**: TypeScript 및 ESM 환경 구성

**실행 단계**:
1. **TypeScript 관련 패키지 설치**
   ```bash
   npm install --save-dev typescript @types/node
   ```
   - **성공 기준**: package.json의 devDependencies에 패키지 추가됨
   - **실패 시**: npm 캐시 클리어 후 재시도 `npm cache clean --force`

2. **tsconfig.json 생성**
   - **파일**: `tsconfig.json`
   - **내용**:
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ESNext",
       "moduleResolution": "node",
       "rootDir": "./src",
       "outDir": "./dist",
       "esModuleInterop": true,
       "allowSyntheticDefaultImports": true,
       "strict": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true,
       "declaration": true,
       "declarationMap": true,
       "sourceMap": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist", "test"]
   }
   ```

3. **package.json ESM 설정**
   - **수정할 파일**: `package.json`
   - **추가할 내용**:
   ```json
   {
     "type": "module",
     "main": "dist/main.js",
     "scripts": {
       "build": "tsc",
       "start": "node dist/main.js",
       "dev": "tsc --watch"
     }
   }
   ```

4. **TypeScript 설정 검증 테스트**
   - **파일**: `test/typescript.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { readFileSync, existsSync } from 'fs';

   describe('TypeScript Configuration', () => {
     it('should have tsconfig.json', () => {
       expect(existsSync('tsconfig.json')).toBe(true);
     });

     it('should have correct TypeScript configuration', () => {
       const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
       expect(tsconfig.compilerOptions.target).toBe('ES2020');
       expect(tsconfig.compilerOptions.module).toBe('ESNext');
       expect(tsconfig.compilerOptions.strict).toBe(true);
     });

     it('should have ESM configuration in package.json', () => {
       const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
       expect(pkg.type).toBe('module');
       expect(pkg.main).toBe('dist/main.js');
     });
   });
   ```

**완료 조건**: TypeScript 설치 완료, 설정 파일 생성, 테스트 통과
**다음 단계**: Task 1.4
**실패 시 복구**: node_modules 삭제 후 npm install 재실행

---

### Task 1.4: 개발 환경 파일 설정
**목표**: .gitignore 및 기타 개발 환경 파일 생성

**실행 단계**:
1. **.gitignore 파일 생성**
   - **파일**: `.gitignore`
   - **내용**:
   ```
   # Dependencies
   node_modules/
   
   # Build outputs
   dist/
   build/
   
   # Environment variables
   .env
   .env.local
   .env.production
   
   # Logs
   logs/
   *.log
   npm-debug.log*
   
   # Runtime data
   pids/
   *.pid
   *.seed
   
   # Coverage directory used by tools like istanbul
   coverage/
   
   # IDE files
   .vscode/
   .idea/
   *.swp
   *.swo
   
   # OS generated files
   .DS_Store
   .DS_Store?
   ._*
   .Spotlight-V100
   .Trashes
   ehthumbs.db
   Thumbs.db
   
   # Results
   results/*.json
   results/*.csv
   ```

2. **.editorconfig 파일 생성 (선택사항)**
   - **파일**: `.editorconfig`
   - **내용**:
   ```
   root = true

   [*]
   charset = utf-8
   end_of_line = lf
   indent_style = space
   indent_size = 2
   insert_final_newline = true
   trim_trailing_whitespace = true

   [*.md]
   trim_trailing_whitespace = false
   ```

3. **환경 파일 검증 테스트**
   - **파일**: `test/environment-files.test.ts`
   - **내용**:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { existsSync, readFileSync } from 'fs';

   describe('Environment Files', () => {
     it('should have .gitignore file', () => {
       expect(existsSync('.gitignore')).toBe(true);
     });

     it('should ignore node_modules in .gitignore', () => {
       const gitignore = readFileSync('.gitignore', 'utf8');
       expect(gitignore).toContain('node_modules/');
       expect(gitignore).toContain('dist/');
       expect(gitignore).toContain('.env');
     });
   });
   ```

4. **초기 커밋**
   ```bash
   git add .
   git commit -m "프로젝트 초기 세팅 및 기본 환경 구성"
   ```
   - **성공 기준**: 커밋 성공 메시지 출력
   - **실패 시**: Git 사용자 설정 후 재시도

**완료 조건**: 모든 환경 파일 생성, Git 커밋 완료, 테스트 통과
**다음 단계**: Phase 2
**실패 시 복구**: 파일 삭제 후 Task 1.4 재실행

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

## Phase 1 완료 체크리스트

- [ ] Task 1.1: Node.js 환경 검증 완료
- [ ] Task 1.2: 프로젝트 구조 초기화 완료
- [ ] Task 1.3: TypeScript 환경 설정 완료
- [ ] Task 1.4: 개발 환경 파일 설정 완료
- [ ] 모든 테스트 통과
- [ ] Git 커밋 완료
- [ ] 다음 Phase 준비 완료 