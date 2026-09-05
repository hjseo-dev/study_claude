---
name: tech-stack
description: 개발자의 기술 경험 + 프로젝트 요구사항을 기반으로 프론트엔드, 백엔드, DB, UI 프레임워크 등의 기술 스택을 선정하는 스킬. 유지보수성과 학습곡선을 균형잡아 추천.
disable-model-invocation: false
---

# 🛠️ 프로젝트 기술 스택 선정

개발자의 기존 기술 경험 + 프로젝트 특성을 고려해서, 프론트엔드부터 백엔드, 데이터베이스, UI 프레임워크까지 일관성 있는 기술 스택을 추천하는 스킬.

## 0. 개발자 기술 경험 파악

사용자에게 다음을 묻는다:

1. **프론트엔드**: JavaScript/TypeScript 경험? 아니면 Kotlin/Swift? 어떤 프레임워크 써봤어?
2. **백엔드**: 주로 쓰는 언어 (Java/Python/Node.js/Go 등), 프레임워크 (Spring Boot/Django/Express 등)
3. **DB**: SQL? NoSQL? 경험있는 DB?
4. **모바일**: 경험이 있으면 어떤 방식? (React Native/Flutter/네이티브)
5. **배포/인프라**: 클라우드 경험 여부 (AWS/GCP/Azure)

## 1. 프로젝트 요구사항 정리

사용자에게 다음을 확인한다:

1. **플랫폼**: 웹만? 모바일도? (웹 + iOS + Android)
2. **사용자 규모**: MVP 단계? 이미 유지보수 중인 대규모 시스템?
3. **실시간 기능**: 필요한가? (실시간 동기화, 채팅, 알림 등)
4. **지연 시간 민감도**: 일반 API vs 밀리초 단위 성능 필요?
5. **팀 크기**: 혼자? 팀 협업? 여러 팀?
6. **라이선스 제약**: 오픈소스만? 상용 라이브러리 OK?

## 2. 스택 추천 원칙

### A. 유지보수성 우선
- 개발자가 이미 써본 기술 → 새 언어는 피함 (예: Kotlin 모를 땐 Java로)
- 커뮤니티 규모 큼 → 레퍼런스 많음 → 문제 발생 시 해결 빠름

### B. 학습곡선 균형
- 새 기술을 배우더라도 "부분적 일원화"는 가능 (예: JavaScript는 써봤으니 React Native 학습 비용은 적음)
- 극단적 새로운 기술 스택은 피함 (예: Go 백엔드 + Swift 프론트엔드 = 난이도 높음)

### C. 라이선스 제약 준수
- 오픈소스 중심 추천 (PostgreSQL/MySQL/MongoDB 등)
- 상용 라이브러리는 사용자가 명시할 때만

### D. 생태계 일관성
- 예1: JavaScript/TypeScript 일원화 → React + Node.js + MongoDB
- 예2: Spring 생태계 → Java + Spring Boot + PostgreSQL + React

## 3. 추천 구성

최종 추천은 다음 테이블 형태로 제시:

| 계층 | 추천 | 대안 | 이유 |
|------|------|------|------|
| **프론트엔드** | React Native + TypeScript | Flutter | JavaScript 경험 있으면 러닝커브 낮음 |
| **백엔드** | Spring Boot (Java) | Spring Boot (Kotlin), Node.js | 대규모 시스템은 Java 안정성 |
| **데이터베이스** | PostgreSQL | MySQL, MongoDB | 복잡한 쿼리+JSON 타입 지원 |
| **UI 프레임워크** | NativeWind (Tailwind for RN) | React Native Paper | 커스터마이징 자유도 높음 |
| **빌드 도구** | Gradle (Spring Boot) | Maven | Gradle이 더 모던 |
| **배포** | Docker + (AWS or 온프레미스) | Heroku | 프로덕션 준비 필요 |

## 4. 설치/준비 리스트

추천된 스택 기준으로 개발자가 설치해야 할 것들:

- Node.js + npm (React Native/Expo)
- Java 21 (Spring Boot)
- PostgreSQL (DB)
- Git
- IDE (VS Code 또는 IntelliJ)
- Android Studio (모바일 에뮬레이터 테스트용)

## 5. 산출물 저장

- `docs/tech-stack.md` — 최종 기술 스택 정리 (테이블 + 설명)
- `docs/setup-checklist.md` — 설치 체크리스트

## 주의사항

- **"최고의 기술"이 아니라 "이 팀에 최적"을 추천**: 개발자의 경험이 가장 중요
- **변경 비용**: 나중에 스택을 바꾸는 건 매우 비쌈 → 초기에 신중히 선택
- **트렌드 vs 안정성**: 새로운 기술은 매력적이지만, 프로덕션에서는 검증된 것이 낫다
