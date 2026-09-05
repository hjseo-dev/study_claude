# 사용 예시: tech-stack

## 시나리오

신규 모바일 앱을 만드는데, "내가 JavaScript와 Spring Boot 써봤는데, 뭐를 써야 할지 모르겠어"

## 실행

```
/wlabs:tech-stack
```

## 진행 과정

### 1단계: 개발자 경험 파악

```
질문:
- 프론트엔드: JavaScript/Vue.js 경험 있음
- 백엔드: Spring Boot (Java) 주로 사용
- DB: PostgreSQL 써봤음
- 모바일: 경험 없음

답변 정리:
→ JavaScript 일원화 가능? No, 백엔드는 Spring Boot 유지하고 싶음
→ 따라서 프론트는 JavaScript 계열, 백은 Java 계열로 분리
```

### 2단계: 프로젝트 요구사항 확인

```
질문:
- 플랫폼: iOS + Android 모바일 앱
- 사용자 규모: MVP → 나중에 확장
- 실시간 기능: 필요함 (여러 명이 같은 데이터 동시 편집)
- 라이선스: 오픈소스 중심

→ 프론트: 모바일 네이티브 필요
→ 백: 실시간 기능 지원 필요 → Spring Boot OK
→ DB: 실시간 동기화 고려 → PostgreSQL 추천
```

### 3단계: 스택 추천

```
| 계층 | 추천 | 이유 |
|------|------|------|
| 프론트 | React Native + Expo | JavaScript 경험 있음, 러닝커브 낮음 |
| 백엔드 | Spring Boot (Java) | 이미 경험 있음, 유지보수 최고 |
| 데이터베이스 | PostgreSQL | 복잡한 쿼리, JSON, 확장성 |
| UI 프레임워크 | NativeWind | Tailwind 스타일, 커스터마이징 자유 |
| 배포 | Docker + AWS | 프로덕션 준비, 스케일링 |

설치 리스트:
□ Node.js 21+
□ Java 21
□ PostgreSQL 14+
□ VS Code + 확장
□ Android Studio (에뮬레이터)
```

### 4단계: 파일 저장

```
생성 파일:
- docs/tech-stack.md → 최종 스택 문서
- docs/setup-checklist.md → 설치 체크리스트 및 명령어
```

## 실제 예시 (이번 세션)

```
사용자: JavaScript와 Vue만 써봤고, Spring Boot 경험 있어. 
        고양이 보호 관리 앱(길냥이)을 만들 건데, 
        여러 캣맘이 한 데이터베이스를 공유해야 해.

Claude:
→ JavaScript는 써봤으니 React Native + Expo 추천
→ Spring Boot 경험 있으니 그대로 유지
→ 공유 데이터 → PostgreSQL 추천 (복잡한 쿼리 + 트랜잭션)
→ UI는 화이트 배경 + 포인트 컬러 → NativeWind로 커스터마이징 쉬움
→ 라이선스: 오픈소스만 → 모두 OK (PostgreSQL, Spring Boot 등)

최종 스택:
- 프론트: React Native + TypeScript + Expo + NativeWind
- 백엔드: Java + Spring Boot
- DB: PostgreSQL
- 배포: Docker + AWS (또는 온프레미스)

필요한 설치:
- Node.js 21+
- Java 21
- PostgreSQL 14+
- VS Code + Java Extension Pack
- Android Studio
```

## 언제 쓰나

- ✅ 신규 프로젝트 시작 (기술 스택 결정할 때)
- ✅ 스택 변경 검토 (현재 스택에서 다른 기술로 넘어갈지 고민)
- ✅ 팀 온보딩 (새 팀원에게 왜 이 스택을 골랐는지 설명)
- ❌ 이미 진행 중인 프로젝트의 마이크로 선택 (ORM 고르기 같은 세부 결정 — 이건 domain expert가)
