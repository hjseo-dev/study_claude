---
name: cafe-with-study
description: Use when the user wants cafe recommendations suited for studying or working (laptop-friendly, quiet, has outlets, okay to stay long, solo-friendly) in a specific area. Triggers on "공부하기 좋은 카페 찾아줘", "노트북 하기 좋은 카페", "콘센트 있는 조용한 카페 추천해줘", "스터디하기 좋은 카페", "카공하기 좋은 카페". Not for general cafe recommendations without a study/work angle, and not for reservations, menus, or prices.
disable-model-invocation: true
context: fork
---

# 공부하기 좋은 카페 추천

지역을 입력받아 네이버 지역검색 API로 카페 후보를 찾고, 각 후보의 네이버
플레이스 리뷰 키워드 태그를 스크래핑해서 "공부/작업하기 좋음" 관련 태그가
있는 곳을 골라 요약 추천한다. LLM으로 리뷰 문장을 분석하지 않는다 — 카페
수만큼 토큰이 드는 걸 피하기 위해 태그/키워드 매칭만 사용한다.

## 절차

1. **지역 확인**: 사용자가 이미 이번 대화에서 지역(동네명/역명 등)을 말했다면
   다시 묻지 않는다. 아직 없다면 "어느 지역에서 카페를 찾아드릴까요? (예:
   강남역 근처, 홍대)"라고 먼저 물어본다. 이 스킬은 위치를 저장하지 않으므로
   매번 새로 묻는다.

2. **후보 검색**: `node scripts/search_naver_places.js "<지역명> 카페"` 실행.
   - `NAVER_HUB_KEY_ID` / `NAVER_HUB_KEY` 환경변수가 없다는 오류가 나면
     사용자에게 [USAGE.md](USAGE.md)의 발급 절차(NAVER Cloud Platform API HUB)를
     안내하고 중단한다. 404 오류가 나면 지역검색 API 경로가 추정값이었다는
     뜻이므로, NCP 콘솔의 실제 예제 경로를 확인해 `search_naver_places.js`의
     `API_URL`을 고치라고 안내한다.
   - 네이버 지역검색 API는 한 번에 최대 5개까지만 준다. 후보가 부족하면
     검색어를 바꿔("스터디카페" 추가, 다른 인접 지역명 등) 1~2번 더 호출해도
     된다. 무리하게 반복 호출하지 않는다(과도한 API 호출 방지).

3. **리뷰 태그 조사**: 후보마다 `link` 값이 있으면
   `node scripts/fetch_place_page.js "<link>"`를 실행해 원본 페이지 데이터를
   받는다.
   - `link`가 없거나 `fetchFailed: true`면 그 카페는 "리뷰 확인 불가"로
     표시하고 스킵한다.
   - 받은 `embeddedState`(있는 경우) 또는 `htmlPreview`를 직접 살펴서
     리뷰 키워드 태그 목록(예: "혼자 방문하기 좋아요", "조용해요", "콘센트가
     많아요", "좌석이 편해요" 같은 태그+카운트 형태)을 찾는다. 이 페이지
     구조는 사전에 확정되어 있지 않으므로, 스크립트가 준 note를 참고해서
     실제 데이터를 보고 판단한다. 못 찾으면 그 카페도 "리뷰 확인 불가"로
     표시한다.

4. **스터디 적합도 채점 (키워드 매칭만 사용, LLM 판단 금지)**: 찾은 태그 이름에
   다음 키워드가 포함되는지 문자열 매칭으로만 확인한다 —
   `콘센트`, `조용`, `노트북`, `스터디`, `카공`, `1인`, `혼자`, `좌석`, `넓`,
   `오래`. 매칭된 태그들의 카운트를 합산해 점수로 쓴다(태그에 카운트가 없으면
   매칭 태그 개수를 대신 쓴다).

5. **결과 정리**: 점수 높은 순으로 정렬해 상위 3~5곳을 요약한다. 각 항목에
   카페 이름, 주소, 매칭된 스터디 친화 태그(+카운트), 전화번호(있으면)를
   보여준다. "리뷰 확인 불가" 카페는 마지막에 참고용으로만 짧게 언급한다.
   결과 줄 앞에는 어울리는 이모지를 붙이고 최상위 추천에는 ⭐를 붙인다.

6. 이 스킬은 서브에이전트(포크)로 실행되므로, 검색/스크래핑 원본 데이터는
   메인 대화에 남기지 않고 위 요약만 반환한다.

## 참고

- [USAGE.md](USAGE.md) — 최초 설정(API 키 발급) 및 호출 방법.
