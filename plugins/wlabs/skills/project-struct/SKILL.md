---
name: project-struct
description: 프로젝트의 전반적인 구조를 분석해서 프로젝트 설명, 언어/프레임워크, 코딩 컨벤션, 전체 API 카탈로그(URI·기능·인증), 외부/타 시스템 연동 맵(어떤 기능·메소드가 어떤 외부 시스템을 쓰는지), 아키텍처 맵, 시작용 CLAUDE.md를 생성한다. "프로젝트 구조 안내해줘", "API 정리해줘", "이 프로젝트가 어떤 외부 시스템과 연동되는지 정리해줘"라고 요청할 때 사용한다.
---

# project-struct — 프로젝트 구조 가이드

낯선 코드베이스를 체계적으로 분석해서 구조화된 온보딩 가이드를 만든다. 아키텍처/컨벤션뿐 아니라 **전체 API 카탈로그**와 **외부 시스템 연동 맵**까지 다룬다.

## 언제 사용하나

- Claude Code로 프로젝트를 처음 열었을 때
- 새 팀이나 저장소에 합류했을 때
- 사용자가 "이 코드베이스 이해하는 거 도와줘"라고 요청할 때
- 사용자가 프로젝트용 CLAUDE.md 생성을 요청할 때
- 사용자가 "온보딩해줘" 또는 "이 저장소 구조 좀 설명해줘"라고 할 때
- 사용자가 "API 목록/카탈로그 정리해줘"라고 요청할 때
- 사용자가 "이 프로젝트가 어떤 외부 시스템과 연동되는지 정리해줘"라고 요청할 때

## 동작 방식

### Phase 1: 정찰 (Reconnaissance)

모든 파일을 읽지 않고 프로젝트에 대한 원시 신호를 수집한다. 아래 항목들을 병렬로 확인한다:

```
1. 패키지 매니페스트 탐지
   → package.json, go.mod, Cargo.toml, pyproject.toml, pom.xml, build.gradle,
     Gemfile, composer.json, mix.exs, pubspec.yaml

2. 프레임워크 지문 인식(fingerprinting)
   → next.config.*, nuxt.config.*, angular.json, vite.config.*,
     django settings, flask app factory, fastapi main, rails config

3. 진입점(entry point) 식별
   → main.*, index.*, app.*, server.*, cmd/, src/main/

4. 디렉토리 구조 스냅샷
   → 디렉토리 트리 상위 2단계 (node_modules, vendor, .git, dist, build,
     __pycache__, .next 는 제외)

5. 설정/툴링 탐지
   → .eslintrc*, .prettierrc*, tsconfig.json, Makefile, Dockerfile,
     docker-compose*, .github/workflows/, .env.example, CI 설정

6. 테스트 구조 탐지
   → tests/, test/, __tests__/, *_test.go, *.spec.ts, *.test.js,
     pytest.ini, jest.config.*, vitest.config.*

7. API 정의 소스 탐지
   → openapi.yaml/json, swagger.json, routes/, controllers/, urls.py,
     *Controller.*, api/ 디렉토리, NestJS/FastAPI/Express 라우트 데코레이터·등록 코드

8. 외부 연동 시그널 탐지
   → .env(.example) 안의 외부 서비스로 보이는 키 접두어 (STRIPE_, AWS_, SLACK_,
     SENTRY_, TWILIO_ 등), HTTP client 사용처 (axios, fetch, requests, httpx,
     RestTemplate), 외부 SDK import (@aws-sdk, stripe, @slack/web-api 등),
     메시지 큐/이벤트 브로커 설정 (kafka, sqs, rabbitmq, redis pub/sub, webhook 핸들러)
```

### Phase 2: 아키텍처 매핑

**기술 스택**
- 사용 언어와 버전 제약
- 프레임워크와 주요 라이브러리
- 데이터베이스와 ORM
- 빌드 도구/번들러
- CI/CD 플랫폼

**아키텍처 패턴**
- 모놀리스 / 모노레포 / 마이크로서비스 / 서버리스 여부
- 프론트엔드-백엔드 분리 구조인지, 풀스택인지
- API 스타일: REST, GraphQL, gRPC, tRPC

**주요 디렉토리**
최상위 디렉토리를 각 용도에 매핑한다:

<!-- 예시 — 실제 탐지된 디렉토리로 교체할 것 -->
```
src/components/  → UI 컴포넌트
src/api/         → API 라우트 핸들러
src/lib/         → 공용 유틸리티
src/db/          → 데이터베이스 모델 및 마이그레이션
tests/           → 테스트 스위트
scripts/         → 빌드/배포 스크립트
```

**데이터 흐름**
요청 하나가 진입점부터 응답까지 어떻게 흘러가는지 추적한다.

### Phase 3: 컨벤션 탐지

**네이밍 컨벤션** — 파일/컴포넌트/테스트 파일 네이밍 패턴
**코드 패턴** — 에러 처리 방식, 의존성 주입 여부, 상태 관리, 비동기 패턴
**Git 컨벤션** — 브랜치/커밋 스타일, PR 워크플로우. 히스토리가 얕으면 "Git 히스토리가 없거나 너무 얕아서 컨벤션을 탐지할 수 없음"이라고 명시

### Phase 4: API 카탈로그 작성

1. **소스 우선순위**: OpenAPI/Swagger 같은 공식 스펙 파일이 있으면 **그것을 1차 소스로 사용**한다. 코드에서 직접 재파싱해서 두 소스가 어긋나게 만들지 않는다.
2. 공식 스펙이 없으면 라우트/컨트롤러 파일을 Grep으로 스캔해서 추출한다.
3. 각 API 항목에 기록할 내용:
   - Method + URI
   - 핸들러 함수 · 파일 위치
   - 기능 한 줄 요약
   - 인증/권한 필요 여부
   - 파악 가능한 선에서 요청/응답 핵심 필드

출력 예시:

```markdown
| Method | URI | 기능 | 인증 | 위치 |
|--------|-----|------|------|------|
| POST | /api/users | 사용자 생성 | 불필요 | src/api/users.ts:12 |
| GET | /api/orders/:id | 주문 조회 | 필요 (로그인) | src/api/orders.ts:34 |
```

### Phase 5: 외부 시스템 연동 맵

목표: **"어떤 기능/메소드가 어떤 외부 시스템을 쓰는지"** 역방향으로 추적한다.

1. 외부 SDK/HTTP client import 지점을 Grep으로 찾는다.
2. 그 지점을 호출하는 상위 함수/서비스/기능 이름까지 역추적한다.
3. 동기 호출(REST/gRPC 외부 API)과 비동기 연동(메시지 큐, webhook, 이벤트)을 구분해서 기록한다.
4. 인증 방식(API key, OAuth, mTLS 등)을 기록한다.
5. 재시도/fallback 정책이 코드에 실제로 보이면 기록하고, 안 보이면 **"확인되지 않음"**이라고 명시한다 — 추측하지 않는다.

출력 예시:

```markdown
| 기능/메소드 | 외부 시스템 | 연동 방식 | 인증 방식 | 위치 |
|------------|------------|----------|----------|------|
| 결제 승인 (PaymentService.charge) | Stripe | 동기 REST | API key | src/services/payment.ts:45 |
| 주문 알림 (OrderNotifier.notify) | Slack | Webhook (비동기) | Webhook URL | src/services/notify.ts:20 |
```

### Phase 6: 온보딩 산출물 생성

#### 산출물 1: 온보딩/구조 가이드

```markdown
# 온보딩 가이드: [프로젝트 이름]

## 개요
[2~3문장: 이 프로젝트가 무엇을 하고, 누구를 위한 것인지]

## 기술 스택
| 계층 | 기술 | 버전 |
|-------|-----------|---------|
| 언어 | ... | ... |
| 프레임워크 | ... | ... |
| 데이터베이스 | ... | ... |

## 아키텍처
[컴포넌트들이 어떻게 연결되는지]

## 디렉토리 맵
[최상위 디렉토리 → 용도]

## API 카탈로그
[Phase 4 결과 — 항목이 많으면 `docs/API-CATALOG.md`로 분리 제안]

## 외부 시스템 연동 맵
[Phase 5 결과 — 항목이 많으면 `docs/EXTERNAL-INTEGRATIONS.md`로 분리 제안]

## 컨벤션
- [파일 네이밍 패턴]
- [에러 처리 방식]
- [테스트 패턴]
- [Git 워크플로우]

## 자주 쓰는 명령어
- 개발 서버 실행 / 테스트 / 린트 / 마이그레이션 / 빌드

## 어디를 봐야 하나
| 하고 싶은 일 | 살펴볼 곳 |
|--------------|-----------|
| API 엔드포인트 추가 | ... |
| 외부 시스템 연동 추가 | ... |
```

#### 산출물 2: 시작용 CLAUDE.md

기존 `CLAUDE.md`가 있으면 먼저 읽고 보강한다 (대체 금지). 100줄 이내로 간결하게 유지하고, API 카탈로그/외부 연동 맵처럼 세부 정보는 CLAUDE.md에 통째로 넣지 않고 별도 문서를 가리키는 링크만 남긴다.

## 모범 사례 (Best Practices)

1. **모든 파일을 읽지 말 것** — 정찰 단계는 Read가 아니라 Glob/Grep으로 수행한다. API·외부연동 탐지도 동일 원칙으로, 모호한 신호가 있을 때만 선별적으로 Read한다.
2. **추측하지 말고 검증할 것** — 설정 파일로 프레임워크가 탐지됐지만 실제 코드가 다른 걸 쓰고 있다면, 코드를 신뢰한다. 특히 외부 연동은 실제 import/호출 지점이라는 코드 근거 없이는 기록하지 않는다.
3. **기존 스펙을 소스로 삼을 것** — OpenAPI 등 공식 API 스펙이 있으면 그것을 1차 소스로 쓰고, 코드에서 재작성해 두 소스가 어긋나지 않게 한다.
4. **기존 CLAUDE.md를 존중할 것** — 이미 있다면 대체하지 말고 보강한다. 무엇이 새로 추가됐고 무엇이 기존 것인지 명시한다.
5. **간결하게 유지할 것** — CLAUDE.md는 2분 안에 훑어볼 수 있어야 한다(100줄 이내). API 카탈로그·외부 연동 맵처럼 분량이 많은 세부 정보는 별도 문서로 분리해 필요한 사람만 펼쳐보게 한다.
6. **모르는 것은 모른다고 표시할 것** — 컨벤션이나 재시도 정책·인증 방식처럼 확신 있게 탐지할 수 없는 정보는 추측하지 말고 그렇게 말한다. "재시도 정책 확인되지 않음"이 틀린 답보다 낫다.

## 피해야 할 안티패턴

- 100줄을 넘는 CLAUDE.md 생성 — 초점을 좁게 유지할 것
- 모든 의존성을 나열하는 것 — 코드 작성 방식에 실제로 영향을 주는 것만 강조할 것
- 자명한 디렉토리 이름까지 설명하는 것 — `src/`는 설명이 필요 없다
- README를 그대로 베끼는 것 — 온보딩 가이드는 README에 없는 구조적 통찰을 더해야 한다
- OpenAPI 스펙이 있는데 무시하고 코드에서 API 목록을 다시 뽑아 두 소스가 어긋나게 만드는 것
- 모든 내부 함수 호출을 "연동"으로 나열하는 것 — 실제로 프로젝트 경계를 넘어가는(외부 시스템) 호출만 기록할 것

## 예시

### 예시 1: 새 저장소에 처음 진입
**사용자**: "이 코드베이스 온보딩해줘"
**동작**: 6단계 전체 워크플로우 실행 → 온보딩 가이드 + 시작용 CLAUDE.md 생성
**결과**: 온보딩 가이드는 대화창에 바로 출력, `CLAUDE.md`는 프로젝트 루트에 파일로 작성

### 예시 2: 기존 프로젝트용 CLAUDE.md 생성
**사용자**: "이 프로젝트용 CLAUDE.md 만들어줘"
**동작**: Phase 1~3만 실행, 온보딩 가이드는 생략하고 CLAUDE.md만 생성
**결과**: 탐지된 컨벤션이 반영된 프로젝트 전용 `CLAUDE.md`

### 예시 3: 기존 CLAUDE.md 보강
**사용자**: "CLAUDE.md를 현재 프로젝트 컨벤션에 맞춰 업데이트해줘"
**동작**: 기존 CLAUDE.md를 읽고 Phase 1~3 실행 후 새로운 내용과 병합
**결과**: 추가된 부분이 명확히 표시된 갱신된 `CLAUDE.md`

### 예시 4: API 카탈로그만 요청
**사용자**: "이 프로젝트 API 목록 정리해줘"
**동작**: Phase 1(API 관련 신호만) + Phase 4만 실행
**결과**: API 카탈로그 표를 대화창에 출력, 항목이 많으면 `docs/API-CATALOG.md`로 저장 제안

### 예시 5: 외부 연동 맵만 요청
**사용자**: "이 프로젝트가 어떤 외부 시스템들이랑 연동되는지 정리해줘"
**동작**: Phase 1(연동 신호만) + Phase 5만 실행
**결과**: 기능/메소드 ↔ 외부 시스템 매핑 표 출력, 항목이 많으면 `docs/EXTERNAL-INTEGRATIONS.md`로 저장 제안
