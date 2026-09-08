# study_claude

클로드 학습

회사(백엔드 개발) 워크플로우용 Claude Code 스킬 모음. `myskill` 플러그인
하나에 스킬들이 모여 있고, 각 스킬은 `/myskill:<스킬명>`으로 호출한다.

> Catizen 앱 개발 파이프라인과 개인/생활용 스킬은 이 저장소에서 분리되어
> 각각 [wlabs-skills](https://github.com/hjseo-dev/wlabs-skills)(`/wlabs:<이름>`),
> [personal-life-skills](https://github.com/hjseo-dev/personal-life-skills)(`/life:<이름>`)
> 저장소로 이동했다.

## 전체 스킬 목록 (백엔드 개발 워크플로우, 서로 연결됨)

| 스킬 | 하는 일 | 연관 스킬 |
|---|---|---|
| `project-struct` | 프로젝트 구조/컨벤션/API 카탈로그/외부연동 맵을 분석해서 `docs/STRUCTURE.md` 등을 생성 | `5w1h`·`backend-dev`·`code-review`·`test-case-creator` **4개 스킬 모두**가 `docs/STRUCTURE.md` 없으면 각자 자동으로 먼저 실행함 |
| `5w1h` | 기존 프로젝트/기능을 추가개발·유지보수·버그수정·접근방법결정·고려사항 관점으로 분석 | `project-struct` 없으면 자동 실행 → 산출물은 `backend-dev`의 필수 입력이 됨 |
| `backend-dev` | 5w1h 분석 문서 기반으로 실제 백엔드 코드 구현 | `5w1h` 문서 필수(없으면 먼저 실행할지 물어봄) · `project-struct` 없으면 자동 실행 · `code-review` 항상 자동 호출(Critical/Medium 자동 반영) · `test-case-creator`는 테스트 요청 시에만 호출 |
| `code-review` | git diff(현재 브랜치=미커밋 포함) 리뷰, Critical/Medium/Low 분류 + 호출부·사이드이펙트 검증 | `project-struct` 없으면 자동 실행 · `backend-dev`가 자동 호출하면 반영까지 자동(Critical/Medium) · 독립 호출 시엔 항상 확인 후 반영 |
| `test-case-creator` | git 브랜치 diff 기반 4관점(기능/보안성/안정성/회귀) 테스트케이스 및 코드 생성 | `project-struct` 없으면 자동 실행 · `backend-dev`가 테스트 요청 시에만 호출 · 독립 호출도 가능 |
| `meeting-speech-review` | 회의/발표 대본을 5W1H 완결성 + 구어체 어순으로 검토 | `5w1h` 문서 있으면 참고(자동 연결은 없음 — `project-struct`도 자동 실행하지 않고, 항상 직접 호출해야 함) |
| `readme-creator` | 프로젝트 스캔 기반으로 README.md를 6개 체크리스트 항목으로 작성/갱신 | 다른 스킬과 실행 연결 없음 |
| `skill-creator` | 새 Claude Code 스킬을 인터뷰-설계-테스트-개선 루프로 제작 | 다른 스킬과 실행 연결 없음(스킬을 만드는 메타 도구) |

## 백엔드 워크플로우 연관관계

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
