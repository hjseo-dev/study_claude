---
name: test-case-creator
description: Use when the user wants test cases or TDD tests generated for the changes on a git branch. Triggers on: "테스트케이스 만들어줘", "TDD 작성해줘", "이 브랜치 테스트 코드 생성해줘", "회귀 테스트 만들어줘", "보안 테스트 만들어줘", "mock 테스트도 같이 만들어줘", test case, TDD, unit test, regression test, mock test. Boundary: for onboarding-style structural analysis of the whole project (아키텍처, API 카탈로그 등) use project-struct instead — this skill is specifically for generating executable test code from a git branch diff, and calls project-struct internally when project context is missing.
---

# test-case-creator — 브랜치 diff 기반 테스트케이스/TDD 생성

지정한 브랜치가 base 브랜치(master/main) 대비 만든 모든 변경사항을 분석해서,
**기능(Functional) / 보안성(Security) / 안정성(Stability) / 회귀(Regression)**
4가지 관점의 테스트케이스를 도출하고, 프로젝트에 이미 쓰이고 있는 언어·테스트
프레임워크 관례에 맞춰 실행 가능한 테스트 코드(가능하면 Mock 포함)를 생성한다.
실행은 항상 사용자에게 먼저 물어본다.

## 0. 인자 파싱: 비교 대상 브랜치

- `$ARGUMENTS`가 있으면 그것을 **target 브랜치**로 쓴다.
- 없으면 `git branch --show-current`로 현재 체크아웃된 브랜치를 target으로 쓴다.
- target 브랜치가 로컬에 없으면(`git rev-parse --verify --quiet <target>` 실패)
  존재하는 브랜치 목록(`git branch -a`)을 보여주고 사용자에게 다시 물어본다 —
  추측으로 비슷한 이름을 골라 진행하지 않는다.

**base 브랜치 자동 감지**: `git rev-parse --verify --quiet main`이 성공하면
`main`, 실패하면 `master`를 시도한다. 둘 다 없으면 `git branch -a` 결과를
보여주고 base 브랜치를 사용자에게 물어본다.

target과 base가 같으면(비교할 게 없음) 사용자에게 실제로 비교하고 싶은
브랜치를 다시 확인한다.

## 1. 변경 범위 확보 (모든 커밋 포함)

merge-base 기준 3-dot diff로, target 브랜치가 base에서 갈라진 이후 쌓인
**모든 커밋의 누적 변경**을 한 번에 잡는다(마지막 커밋만 보지 않는다):

```
git log <base>..<target> --oneline          # 포함되는 커밋 목록(요약용)
git diff <base>...<target> --name-status     # 변경 파일 목록 (A/M/D)
git diff <base>...<target> -- <파일>          # 파일별 상세 diff
```

파일이 많으면 `--name-status`로 먼저 전체 목록을 파악한 뒤, 실제 로직이 바뀐
파일(설정/락파일/생성된 파일 제외)만 골라 파일별로 상세 diff를 확인한다.

## 2. 프로젝트 컨텍스트 확보

`docs/STRUCTURE.md`가 있는지 확인한다.

- **있으면** 그 문서(및 있다면 `docs/API.md`, `docs/EXTERNAL-SYSTEMS.md`)를
  읽어 기술 스택, 테스트 컨벤션(파일 패턴/위치), 외부 연동(Mock 대상)을
  파악한다.
- **없으면** 먼저 `project-struct` 스킬을 실행해서 이 정보를 생성한 뒤 이어서
  진행한다 (Skill 도구로 project-struct를 호출한다). 사용자에게 미리 "프로젝트
  분석 파일이 없어서 project-struct를 먼저 실행합니다"라고 알린다.
- `docs/STRUCTURE.md`의 기술 스택 표만으로 언어가 애매하면 매니페스트 파일
  (`pom.xml`/`build.gradle`, `package.json`, `pyproject.toml`, `go.mod` 등)을
  직접 확인해 보정한다.
- 이 과정에서 STRUCTURE.md 내용이 실제 코드와 다른 걸 발견하면, 조용히
  우회만 하지 말고 결과 보고 시 "STRUCTURE.md가 실제와 달라진 것
  같습니다 — `project-struct`를 다시 실행해서 갱신할까요?"라고 제안한다.

감지된 언어(들)에 맞는 테스트 프레임워크·Mock 라이브러리·파일 배치 관례는
[references/frameworks.md](references/frameworks.md)를 읽어 따른다. 프로젝트에
이미 테스트 코드가 있다면 references보다 **기존 코드의 실제 관례를 우선**한다
(예: 이미 Kotest를 쓰고 있는데 references가 JUnit5를 권장하더라도 Kotest를
따른다).

## 3. 변경 코드 분석

1단계에서 추린 파일별 상세 diff와 필요시 전체 파일(Read)을 통해 다음을 파악한다:
- 함수/메서드 시그니처, 조건 분기, 반환값/예외 케이스
- 입력 검증 유무(경계값, null/빈 값, 타입 오류에 대한 처리)
- 외부 의존성 호출(DB, 외부 API, 파일시스템, 시간, 랜덤, 큐 등) — Mock 대상 후보
- 인증/인가, 민감정보 처리 로직이 바뀌었는지
- 이 변경이 건드리는 기존 동작(회귀 위험 지점) — 같은 파일/클래스의 diff 밖
  코드도 필요하면 Read해서 "건드리지 않았지만 영향받을 수 있는 부분"을 확인

## 4. 4관점 테스트케이스 도출

표로 먼저 대화창에 제시한다(코드 생성 전에 사용자가 범위를 검토할 수 있게):

```markdown
| ID | 관점 | 시나리오 | 입력/조건 | 기대 결과 | Mock 필요 | 비고 |
|----|------|---------|----------|----------|----------|------|
| F1 | 기능 | 정상 입력으로 주문 생성 | ... | 201 + 주문ID 반환 | - | |
| F2 | 기능 | 필수값 누락 | ... | 400 검증 에러 | - | 경계값 |
| S1 | 보안 | 타인 리소스 접근 시도 | 다른 사용자 토큰으로 조회 | 403 | 인증 서비스 mock | |
| ST1| 안정성 | 외부 API 타임아웃 | PaymentClient 응답 지연 | 재시도 후 실패 응답, 예외 전파 안 됨 | 외부 API mock | |
| R1 | 회귀 | 기존 할인 로직 유지 확인 | 변경 전과 동일 입력 | 변경 전과 동일 출력 | - | diff가 건드린 계산 로직 |
```

각 관점의 초점:
- **기능**: 정상 경로 + 경계값 + 잘못된 입력에 대한 명세대로의 동작
- **보안성**: 인증/인가 우회, 입력 검증 누락으로 인한 injection/과다노출,
  권한 상승, 민감정보 로그/응답 노출 등 — diff에서 실제로 확인되는 리스크
  기준으로만 도출한다(일반론적 OWASP 체크리스트를 기계적으로 다 넣지 않는다)
- **안정성**: 예외 처리, null/timeout/재시도, 동시성, 리소스 정리(누수) 등
- **회귀**: 이번 diff가 건드린 기존 동작 중 깨질 수 있는 부분, 기존 테스트와의
  충돌 여부

빈약한 diff(예: 단순 오타 수정)라면 4관점을 억지로 다 채우지 않는다 — 해당
없는 관점은 표에서 생략하고 이유를 짧게 남긴다.

**케이스는 최대 10개로 제한한다.** 후보가 10개를 넘으면 아래 우선순위로 상위
10개만 표에 남긴다(그 다음부터는 5단계 코드 생성도 하지 않는다):

1. 실제로 버그로 확인된 것(코드 근거로 교차검증된 오동작) — 관점 무관 최우선
2. 보안성 — 인증/인가·입력검증 관련 실제 리스크
3. 안정성 — 예외/타임아웃/동시성 등 런타임 위험
4. 회귀 — 기존 동작이 깨질 위험이 큰 것부터
5. 기능 — 나머지 정상/경계값 케이스

10개를 넘겨서 제외한 케이스가 있으면 표 아래에 "총 N개 중 상위 10개만
표시했습니다"라고 짧게 남긴다 — 조용히 잘라내지 않는다.

## 5. 테스트 코드 생성

- [references/frameworks.md](references/frameworks.md)의 언어별 관례(또는
  기존 코드 관례)에 맞춰 실제 실행 가능한 테스트 파일을 작성한다.
- 외부 의존성은 가능한 한 Mock으로 대체한다(예: Java면 JUnit5 `@Test` +
  Mockito `@Mock`/`@InjectMocks`). Mock으로 대체할 수 없는 케이스(실제 DB
  연결, 로컬 파일, 사설 네트워크, 특정 로컬 환경변수 등)는 **테스트
  코드 주석과 대화 요약 모두에** "⚠️ 로컬 전용 — Mock 불가, 실제 환경 필요"라고
  명시한다. 조용히 만들어 놓고 넘어가지 않는다.
- 저장 위치는 `docs/STRUCTURE.md`의 테스트 컨벤션(파일 패턴/디렉토리)을
  따른다. 문서에 없으면 프로젝트의 기존 테스트 디렉토리 구조를 Glob으로
  확인해서 그대로 따르고, 그마저도 없으면 언어 기본 관례
  (references/frameworks.md 참고)를 쓰되 사용자에게 저장 경로를 확인한다.
- getter/setter만 확인하는 것처럼 실제 동작을 검증하지 않는 뻔한 테스트는
  만들지 않는다. 각 테스트는 4단계 표의 특정 ID와 대응돼야 한다.

## 6. 실행 여부 확인

파일 저장 후 `AskUserQuestion`으로 지금 실행할지 물어본다 (예/아니오, 2개
옵션). "예"를 선택하면 `docs/STRUCTURE.md`의 빌드 도구에 맞는 명령으로 방금
생성한 테스트만 좁혀서 Bash로 실행한다:

```
Maven      : mvn test -Dtest=<TestClass>
Gradle     : ./gradlew test --tests <TestClass>
npm/Jest   : npx jest <파일경로>
npm/Vitest : npx vitest run <파일경로>
pytest     : pytest <파일경로>
Go         : go test ./<패키지>/... -run <TestName>
```

빌드 도구를 특정할 수 없으면 실행 전 사용자에게 정확한 실행 명령을 확인한다.
"아니오"를 선택하면 실행 명령어만 안내하고 끝낸다. 로컬 전용으로 표시한
케이스는 "예"를 선택해도 별도로 다시 한번 실행 여부/환경 준비 여부를 확인한다.

## 7. 결과 리포트 생성 (로컬 HTML)

4단계 표 + 발견 사항(있다면) + 5단계에서 생성된 파일 목록 + 6단계 실행
결과(실행했다면)를 묶어서 **로컬 HTML 파일 하나로 저장**한다. Artifact 도구는
쓰지 않는다 — 순수 로컬 파일이며, 브라우저로 직접 열어보는 용도다.

- 저장 위치: target 프로젝트의 `docs/test-reports/<target 브랜치명(슬래시는
  `-`로 치환)>_<yyyyMMdd-HHmmss>.html`
  (예: `docs/test-reports/feature-order-refund_20260904-1530.html`)
- 스타일/구조는 [references/report-template.html](references/report-template.html)을
  참고해서 실제 내용으로 채운 완전한 HTML 문서를 새로 작성한다(외부 CDN/폰트
  링크 없이 `<style>` 내부에 전부 인라인 — `file://`로 열어도 인터넷 연결 없이
  그대로 보여야 한다).
- 리포트에 반드시 포함:
  - 헤더: 프로젝트명, `<base> vs <target>`, 포함된 커밋 수, 생성 일시
  - ⚠️ 발견된 이슈(버그로 보이는 것) — 있으면 눈에 띄게 콜아웃으로, 없으면 섹션 생략
  - 4단계의 테스트케이스 표 전체(관점별로 색이 구분되게)
  - 생성된 테스트 파일 목록(경로, 대응 케이스 ID, 로컬 전용 여부)
  - 실행했다면 케이스별 통과/실패 결과
  - 관점별 케이스 수 요약
- 대화창에는 표를 전부 다시 출력하지 않고, 핵심 요약(파일 개수, 발견된 이슈,
  로컬 전용 개수)과 **리포트 파일의 정확한 경로**만 짧게 안내한다 — 자세한
  내용은 리포트를 열어보게 유도한다.

## 안티패턴

- diff 밖의 무관한 코드까지 리팩터링하거나 손대지 않는다 — 테스트 코드
  작성에만 집중한다.
- 프로젝트에 없는 프레임워크를 상상해서 쓰지 않는다 — `docs/STRUCTURE.md`나
  매니페스트, 기존 테스트 코드로 확인된 것만 사용한다.
- 마지막 커밋의 diff만 보고 그 브랜치의 이전 커밋들을 놓치지 않는다 — 항상
  `<base>...<target>`(3-dot)로 전체 누적 변경을 본다.
- Mock 불가능한 케이스를 조용히 생략하거나, 반대로 로컬 전용이라는 표시 없이
  "성공"이라고 보고하지 않는다.
- 사용자 확인 없이 테스트를 바로 실행하지 않는다.
- 결과 리포트를 Artifact 도구로 올리지 않는다 — 항상 로컬 파일로만 저장한다.
