## 🚧 Phase 3: 뉴스 설정 관리 모듈 (TDD)

### 진행 예정 작업들

#### Task 3.1: 뉴스 사이트 설정 타입 정의 테스트
- [ ] RED: 설정 타입 테스트 작성 (`test/config.test.ts`)
- [ ] GREEN: 기본 설정 인터페이스 구현 (`src/config.ts`)
- [ ] REFACTOR: 설정 구조 최적화

#### Task 3.2: 환경변수 로딩 테스트
- [ ] dotenv 패키지 설치
- [ ] RED: 환경변수 로딩 테스트 작성 (`test/env-loader.test.ts`)
- [ ] GREEN: 환경변수 로딩 구현 (`src/env-loader.ts`)
- [ ] `.env.example` 파일 생성

#### Task 3.3: 뉴스 사이트 설정 병합 로직 테스트
- [ ] RED: 설정 병합 테스트 작성 (`test/config-merger.test.ts`)
- [ ] GREEN: 설정 관리자 구현 (`src/config-manager.ts`)
- [ ] REFACTOR: 타입 안전성 및 유효성 검증 개선

### 목표
뉴스 사이트별 설정(선택자, URL 패턴, 브라우저 옵션)을 관리하는 시스템 구축

### 완료 조건
- [ ] 모든 설정 관련 테스트 통과
- [ ] 환경변수와 기본값 병합 로직 완성
- [ ] ConfigManager 클래스 구현 완료

### 예상 소요 시간
약 2-3시간

### 다음 단계
Phase 4: 브라우저 관리 모듈 (playwright-ghost) 