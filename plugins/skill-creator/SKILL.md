---
name: skill-creator
description: Use when the user wants to create, scaffold, draft, or improve a Claude Code skill — asks to "make a skill", "create a skill for X", "build a SKILL.md", "새 스킬 만들어줘", "스킬 개선해줘", "이 워크플로우를 스킬로 만들어줘", or discusses turning a repeatable workflow into a reusable skill. Runs a guided Q&A, writes the resulting SKILL.md (and supporting files), tests it, and iterates based on feedback.
disable-model-invocation: true
---

# Skill Creator

새 Claude Code 스킬을 설계하고, 작성하고, 테스트하고, 사용자 피드백을 반영해 반복 개선하는 스킬. 파일 하나 써주고 끝나는 게 아니라 "인터뷰 → 설계 → (필요시 코드) → 테스트 → 개선"까지 이어지는 루프를 따라간다.

바로 파일부터 쓰지 말고 아래 단계를 순서대로 진행한다. `AskUserQuestion`은 관련 있는 질문끼리 묶어서 진행하고, 대화에서 이미 답이 나온 건 다시 묻지 않는다. 질문/선택지 텍스트는 항상 한국어로 쓴다 (작성되는 스킬 파일이나 그 외 대화 응답은 대화 언어를 따른다).

## 0. 기존 스킬 확인

`D:\project\study_claude\plugins\` 아래 기존 스킬들을 Glob/Read로 **실제로 열어서** 확인한다 (폴더 이름이나 기억만으로 "이건 완성/미완성이다"라고 추측해서 말하지 않는다 — 각 폴더에 `SKILL.md`가 실제로 있는지, 내용이 뭔지 직접 확인한 뒤에만 언급한다). 새로 만들 스킬과 겹치거나 참고할 만한 구조/패턴이 있으면 사용자에게 알려주고 재사용/차별화 여부를 물어본다.

## 1. 요구사항 수집

다음을 확인한다 (2~3번의 `AskUserQuestion`으로 묶어서 진행):

- **목적 & 이름**: 스킬이 한 문장으로 뭘 해야 하는지. kebab-case 이름 도출 (예: `db-migration-writer`). `~/.claude/skills/<name>/`, `.claude/skills/<name>/`, `D:\project\study_claude\plugins\<name>\`에 이미 같은 이름이 있는지 확인.
- **스코프**: 이 스킬을 어디에 둘지.
  - **개인** (`~/.claude/skills/<name>/SKILL.md`) — 이 사람의 모든 프로젝트에서 사용. `~/.claude/skills/` 바로 아래에 있어야 함(한 단계만 스캔하므로 중첩 폴더는 무시됨).
  - **프로젝트** (`.claude/skills/<name>/SKILL.md`) — 현재 저장소 전용.
  - **플러그인** (`D:\project\study_claude\plugins\<name>\`) — 팀과 공유하고 다른 프로젝트에서도 쓰고 싶을 때. **우리 팀 컨벤션은 1 플러그인 = 1 스킬, `SKILL.md`는 플러그인 루트에 직접 위치** (`plugins/<name>/SKILL.md`, `plugins/<name>/.claude-plugin/plugin.json`) — `skills/<name>/` 중첩 구조는 쓰지 않는다.
- **트리거 조건**: 어떤 문구/상황에서 발동해야 하는지. 구체적인 예시 문구(한국어 포함)를 받는다 — 이게 `description`이 되고, description만 보고 트리거 여부가 결정되므로 매우 중요하다.
- **호출 주체**:
  - 사용자(`/name`)와 클로드 자동 트리거 둘 다 — 기본값, 별도 프론트매터 불필요.
  - 사용자만, `disable-model-invocation: true` — 배포/메시지 전송/파괴적 작업처럼 부작용 있는 스킬에 사용.
  - 클로드만, `user-invocable: false` — 사용자가 슬래시 커맨드로 직접 칠 일 없는 배경 지식/컨벤션용.
- **격리**: 메인 대화에서 바로 실행할지, 서브에이전트로 분리(`context: fork`, 필요시 `agent: <type>`)할지. 조사/탐색성 작업이라 원본 도구 출력이 메인 컨텍스트를 어지럽힐 때만 fork.
- **도구 제한**: `allowed-tools: Read, Grep, Glob`처럼 제한할지, 전체 도구 허용(필드 생략)할지.
- **부속 파일**: `references/`(필요시 읽는 문서), `scripts/`(보조 스크립트), `examples/`, `templates/` 중 뭐가 필요한지 — 추측하지 말고 물어본다.
- **인자**: 호출 시 자유 입력(`$ARGUMENTS`)을 받는지, 받는다면 뭘 받는지.
- **테스트케이스 필요 여부**: 결과가 객관적으로 검증 가능한 유형(파일 변환, 데이터 추출, 고정된 워크플로우)이면 테스트케이스가 도움되고, 주관적인 유형(글쓰기 스타일 등)이면 대개 필요 없다. 기본값을 제안하되 최종 결정은 사용자에게 맡긴다.

## 2. Description 작성

가장 중요한 부분이다. 이 형태를 따른다:

```
Use when <상황/트리거>. Triggers on: "<문구1>", "<문구2>", <키워드>, <키워드>. <선택: 겹칠 수 있는 다른 스킬과의 경계>
```

- 추상적인 카테고리명이 아니라 구체적인 트리거 문구를 앞에 배치한다.
- 기존 스킬과 헷갈릴 수 있으면 경계를 명시한다.
- SKILL.md 본문은 "스킬이 발동됐을 때 클로드가 따를 지침"에 집중한다 — 사람이 읽는 스킬 소개 문서가 아니다.

## 3. Frontmatter 구성

기본값과 다른 필드만 포함한다:

```yaml
---
name: kebab-case-name
description: <2번에서 설계한 내용>
disable-model-invocation: true   # 사용자 전용일 때만
user-invocable: false            # 클로드 전용일 때만 (위와 동시 사용 불가)
allowed-tools: Read, Grep, Glob  # 도구 제한할 때만
context: fork                    # 격리 실행할 때만
agent: Explore                   # context: fork이고 특정 에이전트 타입 지정할 때만
---
```

## 4. 설계안 작성 — 체크포인트 A

파일을 쓰기 전에 규모를 확인한다:

> "이 스킬, `references/`로 분리할 만큼 내용이 많거나 테스트케이스를 만들어 검증할 만한 규모인가요? 아니면 SKILL.md 하나로 끝나는 간단한 스킬인가요?"

- 간단하면 SKILL.md 단일 파일로 설계를 확정한다.
- 규모가 있으면 `references/`·`assets/` 구조까지 설계하고, 1번에서 정한 테스트케이스 필요 여부를 반영한다.

## 5. 파일 작성

1. 디렉토리 생성:
   - 개인/프로젝트 스코프: `<scope-root>/skills/<name>/`
   - 플러그인 스코프: `D:\project\study_claude\plugins\<name>\` + `.claude-plugin\plugin.json`
2. `SKILL.md` 작성: 프론트매터 + "스킬이 뭘 하는지, 발동됐을 때 따를 단계별 지침, 부속 파일 링크(`[references/x.md](references/x.md)` 형식 — 상대경로, 필요할 때만 읽히도록)".
3. 논의된 `references/`, `scripts/`, `examples/`, `templates/` 파일 작성. 프로젝트에 기존 컨벤션이 있으면 그걸 따른다.
4. 요청받지 않은 파일은 만들지 않는다. 단, **플러그인 스코프에서 API 키 발급이나 초기 설정(닉네임/주소 등)이 필요한 스킬**이라면 `USAGE.md`(사전 준비·호출 방법·결과 예시·자주 겪는 문제·개선 아이디어)를 함께 작성한다 — home-eta/fconline이 이미 이 컨벤션을 쓰고 있다. 설정이 필요 없는 간단한 스킬(bookmark, umbrella처럼)까지 무조건 만들 필요는 없다.
5. **플러그인 스코프라면 추가로**, 이 4단계를 빠짐없이 순서대로 실행한다 — 등록/검증까지만 하고 설치를 빠뜨리는 게 가장 흔한 실수다:
   1. `.claude-plugin/marketplace.json`에 항목 등록(`name`, `description`, `source: "./plugins/<name>"`)
   2. `claude plugin validate "D:\project\study_claude"`로 매니페스트 검증
   3. **`claude plugin install <name>@<marketplace-name>`로 실제 설치** — 등록/검증은 설치가 아니다. 이 명령을 실행하기 전까지는 `/<name>`이 "Unknown command"로 뜬다.
   4. `claude plugin list`로 방금 만든 스킬이 목록에 뜨는지 확인

## 6. 코드/스크립트 작성 — 체크포인트 B (스크립트가 필요한 경우만)

1번에서 스크립트가 필요하다고 판단됐다면, 작성 전에 확인한다:

> "이 스크립트는 Node.js로 만들면 될 것 같은데(우리 팀 기본 환경), Python이 꼭 필요한 이유가 있나요?"

- 특별한 이유가 없으면 Node.js(또는 순수 셸)로 작성한다 — 이 환경(Windows)에 Python이 항상 있다는 보장이 없다.
- 사용자가 Python이 필요하다고 확인하면 그때 Python으로 작성한다.

## 7. 테스트 — 체크포인트 C

실행해보기 전에 검증 수준을 확인한다:

> "이 스킬, 한 번 직접 실행해보고 결과를 보여드리는 정도면 될까요? 아니면 스킬 있음/없음을 비교하거나 여러 케이스를 벤치마크할 만큼 중요한 스킬인가요?"

- **가볍게** (기본값): 실제 입력으로 한 번 실행 → 결과를 사용자에게 보여주고 피드백을 받는다.
- **무겁게**: 같은 프롬프트로 서브에이전트 두 개를 같은 턴에 스폰해서 "스킬 있음"과 "스킬 없음(또는 이전 버전)"을 병렬 실행 → 결과를 나란히 비교해서 사용자에게 보여준다. 공식 Anthropic `skill-creator`처럼 별도 채점/벤치마크 스크립트나 JSON 산출물을 만들 필요는 없고, 비교 결과를 대화 안에서 요약하는 정도로 충분하다.
- 플러그인 스코프라면 5번에서 이미 `claude plugin install`까지 끝냈어야 한다 (아직이면 지금 바로 실행). 이전 버전이 설치돼 있었다면 `claude plugin uninstall` 후 다시 `install`로 갈아끼운다. 그 다음 새 세션(또는 `claude -p`)에서 실제로 `/<name>`이 인식되는지 반드시 확인한다 — "등록/검증했으니 될 것"이라고 넘겨짚지 않는다.
- **테스트 도중 버그나 개선 여지를 발견하면, 9번(산출물)까지 미루지 말고 그 자리에서 바로 말한다.** 결과 보고와 함께 "이런 문제를 발견했는데 지금 바로 고칠까요?"처럼 구체적으로 제안하고, 사용자가 원하면 바로 8번으로 들어가서 고친다. (실제 사례: weather 스킬 테스트 중 `process.exit(1)`이 Windows에서 크래시 나는 걸 그 자리에서 발견하고 즉시 고쳤다 — 9번까지 기다렸다면 문제를 안 보고 넘어갈 뻔했다.)

## 8. 반복 개선

사용자 피드백을 받으면 (7번에서 클로드가 스스로 발견한 문제든, 사용자가 직접 준 피드백이든 둘 다 여기로 들어온다):

1. 피드백을 일반화해서 반영한다 — 특정 테스트 케이스에만 맞춘 땜질 대신, 왜 이 지침이 필요한지 설명하는 방식으로.
2. 스킬을 수정하고 5~7번을 다시 진행한다.
3. 범위가 크게 바뀌지 않는 한 체크포인트 A/B/C를 다시 묻지 않고, 이전에 정한 무게 수준을 유지한다.
4. 사용자가 만족하거나, 피드백이 더 없거나, 더 이상 유의미한 개선이 없을 때까지 반복한다.

## 9. 확인 및 산출물

7~8번 루프가 끝난(사용자가 만족했거나 더 볼 게 없는) 뒤에만 진행한다. 작성/수정이 끝나면 사용자에게 알린다:

- 작성된 정확한 경로.
- 호출 방법: 수동 호출은 `/<name>`, 자동 트리거라면 트리거 문구.
- 플러그인 스코프라면 `claude plugin validate` 결과와 로컬 install/uninstall로 실제 동작 확인한 내용.
- **새 개인/플러그인 스킬은 새 Claude Code 세션에서부터 인식된다** (이미 열려 있는 세션은 프로젝트 스킬이어도 재로드가 필요할 수 있음) — 바로 된다고 단정하지 말고 이렇게 안내한다.
- git 커밋/push는 사용자가 명시적으로 요청할 때만 진행한다 (먼저 제안은 하되 실행은 요청 후).
- **이 스킬에서 끝내 고치지 않고 남겨둔(의도적으로 보류했거나 범위 밖인) 지점**을 짧게 짚어준다 (7번에서 발견해서 이미 고친 건 여기서 반복하지 않는다 — 여긴 "아직 안 고친 것"만). 없으면 없다고 말한다.
- 트리거 문구가 잘 작동하는지 현재 세션에서 테스트-호출해볼지 제안한다.

## Anti-patterns

- description이 이름만 반복하면 트리거가 안정적이지 않다 ("A skill for X" 같은 건 피한다).
- 서로 관련 없는 기능을 한 스킬에 욱여넣지 않는다 — 트리거 조건이 다르면 스킬을 나누라고 제안한다.
- 이유 없이 `context: fork`를 기본값으로 쓰지 않는다 — 도구 출력이 지저분하거나 백그라운드 실행이 필요할 때만.
- 요청받지 않은 스크립트/템플릿을 만들지 않는다.
- 개인 스킬을 `~/.claude/skills/` 아래 그룹 폴더로 중첩시키지 않는다 — 바로 아래(direct child)만 인식된다.
- `marketplace.json` 등록 + `claude plugin validate`까지만 하고 **`claude plugin install`을 빠뜨리지 않는다** — 실제로 겪은 실수다. 등록/검증은 설치가 아니고, install을 안 하면 새 세션에서도 `/<name>`이 "Unknown command"로 뜬다. 산출물 안내 전에 반드시 install까지 하고 실제 트리거를 확인한다.
- 4/6/7번 체크포인트를 건너뛰고 임의로 무겁게/가볍게 정하지 않는다 — 항상 먼저 물어본다.
- 0번에서 기존 스킬 상태(완성/미완성, 어떤 파일이 있는지)를 실제로 확인하지 않고 추측해서 말하지 않는다.
