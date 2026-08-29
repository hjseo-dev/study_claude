# skill-creator 사용법

새 Claude Code 스킬을 "인터뷰 → 설계 → (필요시 코드) → 테스트 → 반복개선 →
산출물"까지 이어서 만들어주는 메타스킬입니다. 파일 하나 뚝딱 써주고 끝나는
게 아니라, 만드는 과정에서 규모/스크립트 언어/테스트 강도를 직접 물어보고
진행합니다.

## 1. 호출 방법

Claude Code에서 아래 슬래시 명령을 입력합니다.

```
/skill-creator:skill-creator
```

이 스킬은 "스킬 만들어줘" 같은 말을 해도 자동으로는 실행되지 않습니다
(SKILL.md의 `disable-model-invocation: true` 설정). 위 슬래시 명령으로
명시적으로 불러야 합니다.

## 2. 진행 흐름

1. 기존 `plugins/` 스킬을 실제로 확인해서 겹치는 부분/재사용할 패턴이 있는지 체크
2. 목적, 이름, 스코프(개인/프로젝트/플러그인), 트리거 조건, 호출 주체, 격리 여부,
   도구 제한, 부속 파일, 인자, 테스트케이스 필요 여부를 한국어 질문으로 확인
3. description·frontmatter 설계
4. **체크포인트 A** — SKILL.md 하나로 끝낼지, `references/`까지 분리할지 확인
5. 실제 파일 작성 (플러그인 스코프면 `marketplace.json` 등록 + `validate` + **install**까지)
6. **체크포인트 B** — 스크립트가 필요하면 Node.js(기본)로 할지 Python이 필요한지 확인
7. **체크포인트 C** — 가볍게(직접 실행+리뷰) 검증할지, 무겁게(병렬 비교) 검증할지 확인
8. 테스트 중 발견한 문제는 그 자리에서 바로 알려주고 원하면 즉시 고침
9. 만족할 때까지 반복
10. 산출물 정리 및 안내

## 3. 산출물로 뭐가 만들어지는지

스코프에 따라 위치가 다릅니다.

- **개인**: `~/.claude/skills/<name>/SKILL.md`
- **프로젝트**: `.claude/skills/<name>/SKILL.md`
- **플러그인**(팀 공유, 우리가 주로 쓰는 방식): `D:\project\study_claude\plugins\<name>\SKILL.md` +
  `.claude-plugin/plugin.json` + `marketplace.json` 등록 + 실제 `claude plugin install`까지 완료된 상태

## 4. 유의사항

- **플러그인 스코프는 `marketplace.json` 등록 + `validate`만으로는 안 됩니다.**
  `claude plugin install <name>@study-claude-skills`까지 실제로 실행해야
  `/<name>`이 인식됩니다. 실제로 이 단계를 빼먹어서 "Unknown command"가 났던
  적이 있습니다 (weather 스킬 만들 때).
- 새로 만들거나 수정한 스킬은 **새 Claude Code 세션부터** 인식됩니다. 지금 이
  세션에서 바로 써지지 않는다고 당황할 필요 없습니다.
- API 키처럼 `setx`로 환경변수를 설정해야 하는 스킬을 만들 때, Claude가 도구로
  대신 `setx`를 실행해주면 샌드박스 환경이라 실제 사용자 터미널에는 반영이
  안 될 수 있습니다. 이런 경우엔 사용자가 직접 자기 터미널에서 `setx`를 쳐야
  확실합니다.

## 5. 개선/확장 아이디어

- 개인(`~/.claude/skills/`)·프로젝트(`.claude/skills/`) 스코프는 아직 한 번도
  실제로 써본 적이 없어서 검증이 안 된 상태입니다 (지금까지 만든 5개 스킬이
  전부 플러그인 스코프).
- 체크포인트 C의 "무겁게"(서브에이전트 병렬 with-skill/baseline 비교) 경로도
  아직 실전에서 써본 적이 없습니다.
- 산출물 단계에 `USAGE.md`(이 파일 같은 것) 작성을 표준 절차로 넣는 걸 이번에
  놓쳤다가 뒤늦게 추가했습니다 — 앞으로는 5번(파일 작성)에서 스킬 규모가 있으면
  자동으로 물어보게 만드는 게 좋겠습니다.
- 여러 스킬(umbrella/home-eta/fconline/weather)에 중복 구현된 Node.js 유틸
  (인증키 인코딩, KST 시간 계산, JSON 에러 출력 등)을 skill-creator가 자동으로
  감지해서 공용화를 제안하게 만들면 유지보수가 편해질 것 같습니다.
