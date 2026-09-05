---
name: umbrella
description: 서울 금천구 독산1동 기준으로 기상청 단기예보 API(초단기실황+초단기예보)를 조회해 지금부터 1~2시간 이내 비/눈이 올지 판단하고 우산이 필요한지 알려준다. Use when the user asks whether they need an umbrella or whether it will rain/snow soon in 독산1동. Triggers on: "우산 챙겨야해?", "우산 필요해?", "우산 가져가야 하나", "오늘 비와?", "지금 비와?", "눈 와?", "비 올까?", "umbrella". Not for multi-day forecasts or other locations.
---

# 우산 필요 여부 확인 (독산1동)

공공데이터포털의 기상청 단기예보 조회서비스 2.0
(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0`)에서
초단기실황(`getUltraSrtNcst`)과 초단기예보(`getUltraSrtFcst`)를 함께 조회해
서울 금천구 독산1동 중앙(독산1동주민센터) 기준으로 우산이 필요한지 판단한다.

> 기상청 API는 15분 단위 예보를 제공하지 않는다(최소 단위 1시간). 정확도를 높이기
> 위해 "지금 실황"(실측값, 가장 신뢰도 높음)과 "향후 1~2시간 초단기예보"를 함께
> 확인해서 판단한다.

## 실행 방법

1. 환경변수 `KMA_API_KEY`가 설정되어 있는지 확인한다. 없으면 아래 "인증키 설정"
   안내를 사용자에게 보여주고 중단한다.
2. 이 스킬 디렉터리의 `scripts/check_weather.js`를 Node.js로 실행한다.
   (스킬 로드 시 표시되는 "Base directory for this skill" 경로를 기준으로 삼는다.)

   ```
   node <스킬 디렉터리>/scripts/check_weather.js
   ```

3. 표준출력으로 나오는 JSON을 파싱한다. 형식:

   ```json
   {
     "error": false,
     "location": "서울특별시 금천구 독산1동",
     "observedAt": "20260829 1400",
     "current": { "pty": "0", "ptyText": "없음", "rn1_mm": "0" },
     "upcoming": [
       { "time": "08/29 15:00", "pty": "1", "ptyText": "비", "pop": "70", "sky": "4" }
     ],
     "verdict": "umbrella_needed",
     "reason": "15:00 무렵 비 예보가 있어요 (강수확률 70%)."
   }
   ```

4. `verdict` 값에 따라 사용자에게 한국어로 간결하게 답한다:
   - `umbrella_needed`: 우산을 챙기라고 명확히 권한다 (예: "☔ 우산 챙기세요!").
   - `maybe`: 챙기면 안심이라고 부드럽게 권한다.
   - `not_needed`: 안 챙겨도 된다고 안내한다.
   - `reason` 필드의 근거(시간, 강수확률/강수형태)를 함께 짧게 덧붙인다.
   - `error: true`이면 `message`를 그대로 전달하고, 원인(인증키 미설정/만료,
     네트워크 오류, API 응답 오류 등)에 맞는 다음 행동을 제안한다.

답변은 결과만 간단히 전달한다. 스크립트가 이미 판단 로직(실황 우선, 그다음 예보의
강수형태·강수확률)을 수행했으므로 그 결과를 신뢰하고, 별도로 다른 날씨 API를 추가
조회하지 않는다.

## 인증키 설정

공공데이터포털(data.go.kr)에서 "기상청_단기예보 조회서비스" 활용신청 후 발급받은
인증키(서비스키)를 `KMA_API_KEY` 환경변수로 설정해야 한다.

PowerShell (영구 설정, 새 터미널부터 적용):

```powershell
setx KMA_API_KEY "발급받은_인증키"
```

## 격자 좌표

독산1동은 위경도(37.4702776, 126.8970762, 독산1동주민센터 기준)를 기상청 LCC DFS
격자 변환식으로 계산해 `nx=58, ny=125`를 사용한다 (`scripts/check_weather.js`
상단에 하드코딩됨). 다른 동네를 확인하고 싶다면 이 값을 바꿔야 한다.
