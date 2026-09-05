# study_claude
클로드 학습

개인/팀용 Claude Code 스킬 모음. `wlabs` 플러그인 하나에 스킬들이 모여 있고,
각 스킬은 `/wlabs:<스킬명>`으로 호출한다.

## 전체 스킬 목록

### 백엔드 개발 워크플로우 (서로 연결됨)

| 스킬 | 하는 일 | 연관 스킬 |
|---|---|---|
| `project-struct` | 프로젝트 구조/컨벤션/API 카탈로그/외부연동 맵을 분석해서 `docs/STRUCTURE.md` 등을 생성 | `5w1h`·`backend-dev`·`code-review`·`test-case-creator` **4개 스킬 모두**가 `docs/STRUCTURE.md` 없으면 각자 자동으로 먼저 실행함 |
| `5w1h` | 기존 프로젝트/기능을 추가개발·유지보수·버그수정·접근방법결정·고려사항 관점으로 분석 | `project-struct` 없으면 자동 실행 → 산출물은 `backend-dev`의 필수 입력이 됨 |
| `backend-dev` | 5w1h 분석 문서 기반으로 실제 백엔드 코드 구현 | `5w1h` 문서 필수(없으면 먼저 실행할지 물어봄) · `project-struct` 없으면 자동 실행 · `code-review` 항상 자동 호출(Critical/Medium 자동 반영) · `test-case-creator`는 테스트 요청 시에만 호출 |
| `code-review` | git diff(현재 브랜치=미커밋 포함) 리뷰, Critical/Medium/Low 분류 + 호출부·사이드이펙트 검증 | `project-struct` 없으면 자동 실행 · `backend-dev`가 자동 호출하면 반영까지 자동(Critical/Medium) · 독립 호출 시엔 항상 확인 후 반영 |
| `test-case-creator` | git 브랜치 diff 기반 4관점(기능/보안성/안정성/회귀) 테스트케이스 및 코드 생성 | `project-struct` 없으면 자동 실행 · `backend-dev`가 테스트 요청 시에만 호출 · 독립 호출도 가능 |
| `meeting-speech-review` | 회의/발표 대본을 5W1H 완결성 + 구어체 어순으로 검토 | `5w1h` 문서 있으면 참고(자동 연결은 없음 — `project-struct`도 자동 실행하지 않고, 항상 직접 호출해야 함) |
| `skill-creator` | 새 Claude Code 스킬을 인터뷰-설계-테스트-개선 루프로 제작 | 다른 스킬과 실행 연결 없음(스킬을 만드는 메타 도구) |

### 생활/개인 용도 (서로 독립 — description의 경계 문구로만 구분)

| 스킬 | 하는 일 | 헷갈릴 수 있는 이웃 |
|---|---|---|
| `weather` | 독산1동 기준 오늘 날씨 조회 | `umbrella`와 API 공유, 목적으로 구분 |
| `umbrella` | 독산1동 기준 1~2시간 내 우산 필요 여부 | `weather` 참고 |
| `home-eta` | 자취방→본가 출발시점별 소요시간(Tmap) | `drive-cost`와 "고정 구간·ETA" vs "임의 구간·비용"으로 구분 |
| `drive-cost` | 임의 구간 왕복 톨비+기름값 계산 | `home-eta` 참고 |
| `cafe-with-study` | 지역 기반 "공부하기 좋은 카페" 추천 | — |
| `jeju-trip-plan` | 제주 숙소 근처 날짜별 여행 일정 생성 | — |
| `bookmark` | URL 내용을 정리해 로컬 마크다운으로 저장 | — |
| `fconline` | FC온라인 최근 전적 분석 + 전술 추천 | — |
| `stock-picks` | 관심 테마별 시가총액 top3 조회 | `stock-screener`와 "순위만" vs "심층분석"으로 구분 |
| `stock-screener` | 개별 종목 재무제표(ROE·부채비율 등) + 밸류에이션(PER·PBR·PEG) 분석 | `stock-picks` 참고 |
| `savings-compare` | 실제 예금/적금 상품 API 비교, 세후 수령액 최고 상품 추천 | `goal-saving-planner`와 "실제 상품" vs "가정 기반 시뮬레이션"으로 구분 |
| `goal-saving-planner` | 월급/고정비 기반 카드값 한도 역산 + 30년 복리 자산 시뮬레이션 | `savings-compare` 참고 |

### 백엔드 워크플로우 연관관계

**공통 배경지식 — `project-struct`**
`5w1h`·`backend-dev`·`code-review`·`test-case-creator` 넷 다 시작할 때
`docs/STRUCTURE.md`가 있는지부터 확인하고, **없으면 각자 알아서**
`project-struct`를 먼저 실행한 뒤 이어서 진행한다. 한 번 만들어두면 넷 다
그 산출물을 재사용하므로, 프로젝트당 보통 한 번만 겪는 비용이다.

```
project-struct
  ├─(없으면 자동 실행)── 5w1h
  ├─(없으면 자동 실행)── backend-dev
  ├─(없으면 자동 실행)── code-review
  └─(없으면 자동 실행)── test-case-creator
```

**메인 개발 흐름**

```
5w1h ──(필수 재료)──▶ backend-dev ──(자동, 항상)──▶ code-review
                           │
                     (테스트 요청 시에만)
                           ▼
                   test-case-creator
```

**부가 연결**
- `meeting-speech-review`: `5w1h` 문서가 있으면 참고하지만, 없다고 뭘
  자동 실행하지도 않고 5w1h 쪽에서 끝난 뒤 자동 제안하지도 않는다 —
  항상 사용자가 직접 호출해야 한다.
- `code-review`·`test-case-creator`: `backend-dev`를 거치지 않고
  독립적으로도 호출 가능하다(예: 동료 브랜치 리뷰, 기존 브랜치 테스트만
  따로 뽑기).

## 앱 개발 파이프라인 스킬 (wlabs)

Catizen 프로젝트를 진행하며 만든 스킬 체인. `/wlabs:<이름>`으로 호출하며, 아래 순서로 이어서 쓴다.

| 순서 | 스킬 | 역할 | 상태 |
|------|------|------|------|
| 1 | `design-base-color` | 로고/마스코트 등 브랜드 자산에서 컬러 팔레트를 뽑아 대시보드 목업으로 확정 | ✅ 완료 |
| 2 | `tech-stack` | 개발자 기존 경험 + 프로젝트 요구사항으로 기술 스택(프론트/백/DB) 추천 | ✅ 완료 |
| 3 | `app-init` | 확정된 스택으로 프로젝트 뼈대(폴더구조/설정/빈 DB 연결) 자동 생성 — 도메인 스키마는 포함하지 않음 | ✅ 완료 |
| 4 | `what-to-build` | "무엇을 만들지" 기능 범위(MVP + 확장 로드맵) 확정 — 스키마/화면구조/API 설계보다 먼저 진행 | 🚧 스킬만 생성, 실행 전 |
| 5 | `db-schema-design` | 확정된 기능에서 엔티티를 뽑아 테이블/관계(ERD)를 설계하고 schema.sql로 산출 | ⬜ 예정 (what-to-build 이후) |
| 6 | (예정) 화면구조 설계 | 정보구조(IA)와 화면 간 네비게이션 플로우 설계 | ⬜ 예정 |
| 7 | (예정) API 설계 | 스키마+화면구조 기반 REST API 명세 작성 | ⬜ 예정 |
| 8 | 로그인 화면 구현 | 위 산출물을 바탕으로 첫 실제 기능 구현 시작 | ⬜ 예정 |

**설계 원칙**: 1~3(뼈대)과 4~7(도메인/기능 설계)을 명확히 분리한다 — 뼈대 스킬은 순수 설정까지만 하고, 실제 기능/테이블/엔티티/API 스펙은 반드시 사용자 확인을 거쳐 별도 단계에서 확정한다. 기능 범위(4)가 스키마(5)보다 먼저인 이유: 스키마는 "무엇을 저장할지"이므로 "무엇을 만들지"가 먼저 정해져야 한다.
