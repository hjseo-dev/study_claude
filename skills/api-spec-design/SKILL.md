---
name: api-spec-design
description: 화면 설계·데이터 모델로부터 REST API 엔드포인트·요청/응답 스키마를 설계하고 api-spec.md로 산출하는 스킬. screen-flow-design(화면 설계) 이후, 구현 이전 단계에서 사용.
disable-model-invocation: false
---

# 🔌 API 명세 설계

화면에서 필요한 데이터 입출력을 REST API로 표현하고, 엔드포인트·요청/응답 형식·오류 처리를 명세하는 스킬.

**전제**: 데이터 모델(db-schema-design)과 화면 설계(screen-flow-design)는 이미 확정되었고, 이를 토대로 프론트엔드-백엔드 간 통신 계약을 정의하는 단계.

## 0. 입력물 확보

1. `docs/features/<기능명>/database.md` — 엔티티/필드/관계
2. `docs/features/<기능명>/screen-flow.md` — 화면 목록과 각 화면의 액션 (버튼 클릭 시 어떤 데이터를 서버에 보내고 받는가)

## 1. 엔드포인트 도출

각 화면의 액션마다 필요한 엔드포인트를 도출한다:

| 화면 | 액션 | HTTP 메서드 | 엔드포인트 | 용도 |
|------|------|-----------|----------|------|
| 개체 목록 | 목록 조회 | GET | `/api/cats` | 목록 페이지 로드 |
| 개체 상세 | 상세 조회 | GET | `/api/cats/{id}` | 상세 페이지 로드 |
| 급식 기록 | 입력/저장 | POST | `/api/cats/{id}/feeding-logs` | 급식 기록 등록 |
| 급식 기록 | 수정 | PUT | `/api/cats/{id}/feeding-logs/{logId}` | 급식 기록 수정 |

**RESTful 원칙**:
- GET: 조회 (멱등)
- POST: 등록 (새 리소스 생성)
- PUT/PATCH: 수정
- DELETE: 삭제

## 2. 요청/응답 스키마

각 엔드포인트마다 구체적인 JSON 스키마를 정의한다:

```
POST /api/cats/{id}/feeding-logs

Request:
{
  "fedAt": "2026-09-05T14:30:00Z",
  "location": "골목길 A구간",
  "photoUrl": "s3://...",
  "notes": "잘 먹었음"
}

Response (201 Created):
{
  "id": "uuid",
  "catId": "uuid",
  "fedAt": "...",
  "location": "...",
  "createdAt": "2026-09-05T14:32:00Z"
}
```

필수/선택 필드, 타입, 길이 제약, 형식을 명시한다.

## 3. 오류 처리

공통 오류 응답 형식을 정의하고, 각 엔드포인트가 반환할 수 있는 오류 케이스를 나열한다:

| HTTP 상태 | 에러 코드 | 상황 |
|----------|----------|------|
| 400 | INVALID_REQUEST | 요청 형식 오류 |
| 401 | UNAUTHORIZED | 인증 필요 |
| 403 | FORBIDDEN | 권한 없음 |
| 404 | NOT_FOUND | 리소스 없음 |
| 409 | CONFLICT | 중복 |
| 500 | INTERNAL_ERROR | 서버 오류 |

## 4. 인증/권한

- 누가 이 엔드포인트에 접근할 수 있는가
- 토큰 전달 방식 (Authorization 헤더, 쿠키, 등)

## 5. 검증 체크리스트

- [ ] 모든 화면 액션이 엔드포인트로 변환되었는가
- [ ] 요청/응답 필드가 데이터 모델과 일치하는가
- [ ] 오류 케이스가 모두 정의되었는가
- [ ] 인증/권한 요구사항이 명시되었는가

## 6. 산출물

- `docs/features/<기능명>/api-spec.md` — 엔드포인트 표, 요청/응답 스키마, 오류 처리

## 7. 다음 단계 안내

완료 시 개발(feature-impl-guide)로 이어갈 수 있음을 안내한다.

## 주의사항

- API를 임의로 정의하지 않는다 — 화면 액션 → 후보 엔드포인트 → 사용자 확인 → 확정
- 요청/응답 필드명은 데이터 모델 용어집과 일치시킨다
