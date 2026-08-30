---
name: weather
description: 서울 금천구 독산1동 기준으로 오늘 날씨(현재 기온, 오늘 최고/최저기온, 하늘 상태, 강수형태·강수확률, 습도, 풍속)를 기상청 단기예보 API로 조회해서 알려주는 스킬
disable-model-invocation: true
---

# 오늘 날씨 (독산1동)

공공데이터포털의 기상청 단기예보 조회서비스 2.0
(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0`)의 `getVilageFcst`를
조회해서 서울 금천구 독산1동 기준 오늘 날씨를 알려준다.

> 비/눈이 곧 올지, 우산이 필요한지만 궁금하면 이 스킬 대신 `umbrella` 스킬을 사용한다.
> 이 스킬은 기온·하늘상태·습도·풍속 등 오늘 하루 전반적인 날씨를 다룬다.

API 필드 코드(SKY/PTY/TMN/TMX 등)의 의미와 TMN/TMX를 가져올 때 주의할 점은
[references/api-fields.md](references/api-fields.md)에 정리되어 있다 — 회차별로
TMN/TMX가 왜 따로 조회되는지 헷갈리면 먼저 그 문서를 읽는다.

## 실행 방법

1. 환경변수 `KMA_API_KEY`가 설정되어 있는지 확인한다 (umbrella와 같은 키를 공유해도 된다).
   없으면 아래 "인증키 설정" 안내를 사용자에게 보여주고 중단한다.
2. 이 스킬 디렉터리의 `scripts/check_today_weather.js`를 Node.js로 실행한다.

   ```
   node <스킬 디렉터리>/scripts/check_today_weather.js
   ```

3. 표준출력의 JSON을 파싱한다. 형식:

   ```json
   {
     "error": false,
     "location": "서울특별시 금천구 독산1동",
     "announcedAt": "20260829 1400",
     "todayForecastEnded": false,
     "current": {
       "time": "1500", "tmp": "23", "sky": "1", "skyText": "맑음",
       "pty": "0", "ptyText": "없음", "pop": "10", "reh": "55", "wsd": "2.3"
     },
     "todayLow": "18",
     "todayHigh": "26"
   }
   ```

4. 사용자에게 한국어로 간결하게 요약한다. 예:
   `🌤 오늘 독산1동: 15시 기준 23°C, 맑음. 오늘 최저 18°C / 최고 26°C. 강수확률 10%, 습도 55%, 풍속 2.3m/s.`
   - `todayLow`/`todayHigh`가 `null`이면 "아직 발표 전"이라고 표시한다 (이른 새벽 시간대 조회 시 정상적인 상황).
   - `todayForecastEnded: true`이면 `current`는 `null`이다. 최신 발표 회차(보통 23시)가 이미
     다음날 시간대만 담고 있어 오늘 남은 시간대 예보가 없다는 뜻(자정 임박 시각 조회 시 정상 상황)이므로,
     "오늘 예보 시간 종료"라고 안내하고 `todayLow`/`todayHigh`만 전달한다.
   - `error: true`이면 `message`를 그대로 전달하고, 원인(인증키 미설정/만료, 네트워크 오류, API 응답 오류 등)에 맞는 다음 행동을 제안한다.

답변은 결과만 간단히 전달한다. 스크립트가 이미 회차별 조회·필드 매핑을 다 처리했으므로
그 결과를 신뢰하고 별도로 다른 날씨 API를 추가 조회하지 않는다.

## 인증키 설정

공공데이터포털(data.go.kr)에서 "기상청_단기예보 조회서비스" 활용신청 후 발급받은
인증키(서비스키)를 `KMA_API_KEY` 환경변수로 설정해야 한다.

PowerShell (영구 설정, 새 터미널부터 적용):

```powershell
setx KMA_API_KEY "발급받은_인증키"
```

## 격자 좌표

독산1동은 위경도(37.4702776, 126.8970762, 독산1동주민센터 기준)를 기상청 LCC DFS
격자 변환식으로 계산해 `nx=58, ny=125`를 사용한다 (umbrella 스킬과 동일 좌표,
`scripts/check_today_weather.js` 상단에 하드코딩됨). 다른 동네를 보고 싶으면 이 값을
바꿔야 한다.

## 테스트 시나리오

이 스킬을 테스트/개선할 때 아래 상황을 확인한다:

1. 정상 응답 — 맑은 날 (SKY=1, PTY=0)
2. 정상 응답 — 비/눈 오는 날 (PTY≠0)
3. `KMA_API_KEY` 미설정 → 안내 메시지 정상 출력
4. API 오류 응답(`resultCode`≠00) → 에러 메시지 처리
5. 새벽 시간대 조회 시 `todayLow`/`todayHigh`가 아직 발표 전이라 `null`로 나오는 경우 → "아직 발표 전" 문구로 정상 안내되는지
6. 자정 임박(최신 발표 회차 이후 오늘 남은 시간대가 없는) 시각 조회 시 → `todayForecastEnded: true`, `current: null`로 나오고 "오늘 예보 시간 종료" 문구로 정상 안내되는지
