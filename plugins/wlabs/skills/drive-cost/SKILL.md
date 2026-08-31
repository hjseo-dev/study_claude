---
name: drive-cost
description: 출발지와 목적지를 입력받아 자차로 왕복 운전할 때 드는 통행료(톨비)와 기름값을 Tmap 경로 API, 한국에너지공단 자동차 연비 API, 오피넷 유가 API로 계산한다. Use when the user asks how much a round-trip car drive between two arbitrary places will cost (tolls + fuel). Triggers on: "톨비 얼마나 나와", "왕복 기름값 계산해줘", "OO에서 OO까지 운전하면 얼마 들어", "통행료랑 기름값 알려줘", "기름값 톨비 계산", "drive cost". 소요시간(ETA)만 묻는 경우나 자취방-본가 고정 구간은 이 스킬이 아니라 home-eta를 사용한다.
---

# 왕복 운전 비용(통행료 + 기름값) 계산

임의의 출발지 -> 목적지를 자차로 왕복할 때 드는 **통행료(톨비)**와
**기름값**을 계산해서 총 km, 톨비, 기름값, 총 합계를 알려준다.

> 통행료는 Tmap 경로 API가 주는 **경로 전체 합계**만 정확하다. 게이트(요금소)별
> 개별 금액은 API가 제공하지 않으므로, 통과하는 요금소/IC **이름**만 참고용으로
> 함께 보여준다 (금액은 표시하지 않음).

## 실행 방법

1. 사용자가 출발지와 목적지를 아직 말하지 않았다면 먼저 물어본다 (도로명 주소,
   지번 주소, 또는 잘 알려진 장소명/역/건물명이면 충분하다).
2. 환경변수 `TMAP_API_KEY`가 설정되어 있는지 확인한다. 없으면 "인증키 설정"
   안내를 사용자에게 보여주고 중단한다.
3. 이 스킬 디렉터리의 `scripts/check_drive_cost.js`를 실행한다.

   ```
   node <스킬 디렉터리>/scripts/check_drive_cost.js "<출발지>" "<목적지>"
   ```

4. 응답 JSON을 확인한다.

   - `needCarSetup: true`이면 차량 정보가 아직 없는 것이다. 거리/톨비는 이미
     응답에 들어있으니 그것부터 사용자에게 보여주고, 이어서 "차종이 뭐예요?"
     라고 물어본 뒤 아래 "차량 정보 설정" 절차를 진행한다. 완료 후 3번부터
     다시 실행해 기름값까지 포함한 최종 결과를 얻는다.
   - `fuel.error: true`이면(오피넷 유가 조회 실패) `fuel.message`를 사용자에게
     알리고, 톨비/거리만이라도 결과로 전달한다.
   - 정상 응답 예시:

     ```json
     {
       "error": false,
       "needCarSetup": false,
       "origin": "서울역",
       "destination": "부산역",
       "oneWayKm": 325.4,
       "roundTripKm": 650.8,
       "roundTripTollWon": 45600,
       "tollGatesPassed": ["서울요금소", "부산IC"],
       "tollGatesNote": "게이트별 금액은 제공되지 않으며, ...",
       "fuel": {
         "error": false,
         "fuelType": "휘발유",
         "pricePerLiterWon": 1650,
         "fuelEfficiencyKmPerL": 13.5,
         "roundTripFuelWon": 79560
       },
       "totalCostWon": 125160
     }
     ```

5. 결과를 한국어로 간결하게 정리해서 답한다. 각 줄 앞에 어울리는 이모지를
   붙이고, 최종 합계 줄은 "⭐ "로 시작한다. 예:

   ```
   🚗 총 왕복 거리: 650.8km (편도 325.4km)
   🛣️ 왕복 통행료: 45,600원 (통과 추정 요금소/IC: 서울요금소, 부산IC)
   ⛽ 왕복 기름값: 79,560원 (휘발유, 리터당 1,650원, 연비 13.5km/L 기준)
   ⭐ 왕복 총 비용: 약 125,160원
   ```

   `tollGatesPassed`가 비어 있으면 게이트 관련 줄은 생략한다. `totalCostWon`이
   null이면(차량 미설정 또는 유가 조회 실패) 톨비까지만 합계로 말하고, 기름값은
   왜 빠졌는지 한 줄로 설명한다.

6. `error: true`이면 `message`를 그대로 전달하고, 원인(인증키 미설정/만료,
   지오코딩 실패, 네트워크 오류 등)에 맞는 다음 행동을 제안한다.

## 차량 정보 설정 (연비 자동 조회)

`needCarSetup: true`를 받았거나 사용자가 "차량 정보 바꿔줘", "차 바꿨어" 등을
요청하면 다음을 진행한다.

1. 사용자에게 차종(모델명, 예: "아반떼 CN7", "쏘렌토 하이브리드")을 물어본다.
2. `scripts/lookup_fuel_efficiency.js`를 실행한다.

   ```
   node <스킬 디렉터리>/scripts/lookup_fuel_efficiency.js "<차종>"
   ```

   이 스크립트는 한국에너지공단 공공데이터 API의 **원본 응답을 그대로** 돌려준다
   (필드명이 사전에 확인되지 않았기 때문에 파싱하지 않음). `raw` 안의 배열을
   직접 살펴보고, 검색어와 일치하는 모델을 찾아 복합연비(km/L)와 유종(휘발유/
   경유/LPG)을 추출한다.

   - 여러 모델이 매칭되면 후보를 사용자에게 보여주고 하나를 고르게 한다.
   - `error: true`이거나 `FUEL_API_KEY` 관련 오류이면 "인증키 설정" 안내를
     보여주고, 발급 전이라면 사용자에게 연비(km/L)와 유종을 직접 물어봐서
     진행해도 된다.
   - API 응답에서 도저히 원하는 모델을 못 찾아도, 사용자에게 직접 연비/유종을
     물어보는 것으로 대체할 수 있다.

3. 확정된 값을 사용자에게 한 번 보여주고("아반떼 CN7, 복합연비 13.5km/L,
   휘발유 맞나요?") 확인받은 뒤 저장한다.

   ```
   node <스킬 디렉터리>/scripts/save_car.js "<차종>" "<연비>" "<유종>"
   ```

   유종은 반드시 "휘발유", "경유", "LPG" 중 하나로 정규화해서 넘긴다 (오피넷
   유가 조회가 이 문자열로 매칭한다).

## 인증키 설정

세 가지 키/설정이 필요하다. 모두 무료 등급으로 충분하다.

1. **TMAP_API_KEY** — openapi.sk.com(SK Open API) 가입 후 "T map" 앱 생성 시
   발급되는 appKey. (home-eta와 공유 가능한 동일 키)
2. **FUEL_API_KEY** — data.go.kr 가입 후 "한국에너지공단_자동차 표시연비
   목록 조회 서비스"를 활용신청하면 승인 후 마이페이지에서 서비스키를 확인할 수
   있다. 요청 기본 주소(`https://apis.data.go.kr/B553530/CAREFF`)는
   `lookup_fuel_efficiency.js`에 이미 고정되어 있다. **시스템(Machine-level)
   환경변수로 저장되어 있다** — home-eta의 `TMAP_API_KEY`와 마찬가지로, `Bash`/
   `PowerShell` 도구로 새로 띄운 셸은 `$env:FUEL_API_KEY`로 바로 보이지 않을 수
   있다. 스크립트를 직접 실행해 디버깅할 때는 PowerShell에서
   `[System.Environment]::GetEnvironmentVariable("FUEL_API_KEY", "Machine")`로
   읽어 자식 프로세스 env에 주입한 뒤 `node`를 실행한다 (스킬 정상 실행 시에는
   Node가 알아서 프로세스 환경변수를 상속하므로 별도 조치가 필요 없다).
3. **OPINET_API_KEY** — opinet.co.kr 가입 후 유가정보 API 페이지에서 무료로
   발급받는 인증키(certkey).

PowerShell (영구 설정, 새 터미널부터 적용):

```powershell
setx TMAP_API_KEY "발급받은_appKey"
setx FUEL_API_KEY "발급받은_서비스키" /M
setx OPINET_API_KEY "발급받은_certkey"
```

## 저장 위치

차량 정보는 이 리포지토리(GitHub에 공개됨) 안에는 저장하지 않는다. 항상
사용자 홈 디렉터리(리포 밖)의 다음 경로에만 저장한다:

```
%USERPROFILE%\.claude\skill-data\drive-cost\car.json
```

## 참고: searchOption

`check_drive_cost.js`는 Tmap `searchOption=0`(추천 경로, 유료도로 포함)으로
고정되어 있다. 무료도로만 타는 경로가 필요하면 이 값을 바꿔야 하고, 그 경우
통행료는 0에 가까워진다.

[USAGE.md](USAGE.md)에 사용자용 사용법 안내가 있다.
