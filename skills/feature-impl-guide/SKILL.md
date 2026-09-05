---
name: feature-impl-guide
description: 설계 완료된 기능을 구현하기 위한 체크리스트·구현 순서·주의사항을 정리하는 스킬. api-spec-design(API 설계) 이후, 실제 구현 이전 단계에서 사용.
disable-model-invocation: false
---

# 🚀 기능 구현 가이드

완성된 설계(스키마·화면·API)를 바탕으로 프론트엔드·백엔드 구현 순서와 체크리스트를 정리하는 스킬.

**전제**: 스키마(db-schema-design), 화면(screen-flow-design), API(api-spec-design)는 모두 설계 완료 상태. 이제 "무엇을, 어떤 순서로, 어떤 규칙으로 구현할지"를 정리하는 단계.

## 0. 입력물 확보

1. `docs/features/<기능명>/database.md` — 엔티티/테이블 정의
2. `docs/features/<기능명>/screen-flow.md` — 화면 목록/플로우
3. `docs/features/<기능명>/api-spec.md` — REST API 엔드포인트/명세
4. `docs/guide/convention.md` — 개발 규칙(패키지 구조, 주석, 예외 처리, 등)

## 1. 구현 단계 (Phase)

프론트엔드와 백엔드를 병렬로 진행하되, 순서를 명확히 한다:

### 백엔드 (Spring Boot)
1. **Entity 클래스** — `entity/<기능>/`에 엔티티 생성
2. **Repository** — `repository/<기능>/`에 CRUD 인터페이스
3. **DTO** — `dto/<기능>/`에 요청/응답 클래스 (유효성 검증 포함)
4. **Exception** — `exception/<기능>/`에 도메인 예외
5. **Service** — `service/<기능>/`에 비즈니스 로직
6. **Controller** — `controller/<기능>/`에 REST 엔드포인트
7. **테스트** — 각 계층별 단위 테스트

### 프론트엔드 (React Native)
1. **Types** — `types/`에 TypeScript 인터페이스
2. **API Service** — `services/<기능>/`에 백엔드 호출 함수
3. **Hooks** — `hooks/<기능>/`에 상태 관리
4. **Screens** — `screens/<기능>/`에 화면 컴포넌트
5. **Navigation** — 라우팅 타입 추가
6. **테스트** — 통합 테스트

## 2. 개발 순서

**권장 순서**:
1. 백엔드 Entity/Repository (데이터 계층)
2. 백엔드 DTO/Controller (인터페이스)
3. 프론트엔드 Types/Services (API 클라이언트)
4. 프론트엔드 화면 (UI)
5. 통합 테스트 (E2E)

**이유**: 백엔드 API가 먼저 확정되면 프론트엔드가 병렬로 진행 가능

## 3. 구현 체크리스트

### 공통
- [ ] 코딩 규칙 준수 (convention.md)
- [ ] 필드/클래스명이 용어집과 일치
- [ ] 모든 public 메서드에 목적 주석 추가
- [ ] 예외 처리 (도메인 예외 vs 로깅)

### 백엔드
- [ ] Entity: 모든 필드 정의
- [ ] Repository: 필요한 쿼리 메서드
- [ ] DTO: 유효성 검증 애노테이션
- [ ] Service: 트랜잭션 처리
- [ ] Controller: 정확한 HTTP 상태 코드
- [ ] API 문서: Swagger 애노테이션

### 프론트엔드
- [ ] Types: 백엔드 응답과 매칭
- [ ] Services: 토큰 전달, 오류 처리
- [ ] Screens: 로딩/오류/성공 상태
- [ ] Navigation: 화면 전환 테스트
- [ ] 입력값 검증

## 4. 산출물

- `docs/features/<기능명>/impl-guide.md` — 체크리스트, 주의사항
- 실제 코드 (백엔드 + 프론트엔드)

## 5. 다음 단계 안내

구현 완료 후 통합 테스트 → 다음 기능 사이클로 이어진다.

## 주의사항

- 설계에 빠진 부분을 발견하면 구현 중단하고 설계 수정
- 테스트: 개발과 동시에 진행
