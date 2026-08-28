---
name: home-eta
description: 자취방에서 본가까지 자차(무료도로 우선, 톨게이트 회피)로 이동할 때 지금 바로 및 지금부터 30분/1시간/1시간 30분 후 각각 출발하면 얼마나 걸리는지 Tmap 미래예측(타임머신) API로 조회한다. Use when the user asks how long a car drive from their place to their parents' home will take, at several future departure times. Triggers on: "본가 가는데 얼마나 걸려", "집 가는데 시간 얼마나 걸려", "본가까지 얼마나 걸려", "지금 출발하면 언제 도착해", "몇시에 출발하는 게 좋아", "home eta", "drive home". Not for 대중교통 경로나 다른 임의의 두 지점 간 길찾기.
disable-model-invocation: true
---

# 본가 가는 길 예상 소요시간

Tmap(SK 오픈API)의 미래예측(타임머신) 자동차 길 안내 API로, 자취방 -> 본가
구간을 **무료도로 우선(톨게이트 회피)** 옵션으로 조회해 지금 바로 / 지금부터
30분 / 1시간 / 1시간 30분 뒤 각각 출발했을 때의 예상 소요시간을 알려준다.

> 자취방/본가 주소는 이 리포지토리(GitHub에 공개됨) 안 어디에도 저장하지 않는다.
> 항상 사용자 홈 디렉터리(리포 밖)의 로컬 설정 파일에만 저장한다.

## 실행 방법

1. 환경변수 `TMAP_API_KEY`가 설정되어 있는지 확인한다. 없으면 아래 "인증키 설정"
   안내를 사용자에게 보여주고 중단한다.
2. 이 스킬 디렉터리의 `scripts/check_drive_time.js`를 Node.js로 실행한다.
   (스킬 로드 시 표시되는 "Base directory for this skill" 경로를 기준으로 삼는다.)

   ```
   node <스킬 디렉터리>/scripts/check_drive_time.js
   ```

3. 표준출력 JSON의 `needSetup`을 확인한다.
   - `needSetup: true`면 아직 주소가 저장되어 있지 않은 것이다. 사용자에게
     "자취방 주소"와 "본가 주소"를 물어본다 (도로명 또는 지번 주소면 충분,
     동/호수는 필요 없음). 답변을 받으면 아래 명령으로 저장한 뒤, 1번부터 다시
     실행해 실제 결과를 얻는다.

     ```
     node <스킬 디렉터리>/scripts/set_locations.js "<자취방 주소>" "<본가 주소>"
     ```

   - `needSetup: false`면 바로 4번으로 진행한다.

4. 정상 응답 형식:

   ```json
   {
     "error": false,
     "needSetup": false,
     "origin": "서울특별시 ...",
     "destination": "경기도 ...",
     "searchOption": "무료도로 우선(톨게이트 회피)",
     "results": [
       { "departAfterMin": 0, "departAt": "15:00", "arriveEta": "15:42", "durationMin": 42, "distanceKm": 25.3 },
       { "departAfterMin": 30, "departAt": "15:30", "arriveEta": "16:10", "durationMin": 40, "distanceKm": 25.3 },
       { "departAfterMin": 60, "departAt": "16:00", "arriveEta": "16:38", "durationMin": 38, "distanceKm": 25.3 },
       { "departAfterMin": 90, "departAt": "16:30", "arriveEta": "17:05", "durationMin": 35, "distanceKm": 25.3 }
     ]
   }
   ```

   `results`의 각 항목을 "지금부터 {departAfterMin}분 뒤({departAt}) 출발하면
   {durationMin}분 걸려서 {arriveEta}쯤 도착해요" 형태로 한국어로 간결하게
   정리해서 답한다. `departAfterMin`이 0인 항목은 "지금 바로({departAt}) 출발하면
   ..." 형태로 표현한다. 네 시점 결과를 비교해 더 빠른 시간대가 있으면 짧게
   언급해도 좋다.

   `error: true`이면 `message`를 그대로 전달하고, 원인(인증키 미설정/만료,
   주소 지오코딩 실패, 네트워크 오류 등)에 맞는 다음 행동을 제안한다.

5. 주소를 바꾸고 싶다는 요청(예: "주소 다시 설정해줘", "이사했어")을 받으면
   바로 새 주소 두 개를 물어보고 `set_locations.js`를 다시 실행해 덮어쓴다.

답변은 결과만 간결하게 전달한다. 스크립트가 이미 무료도로 우선 옵션과 미래예측
호출을 수행했으므로 그 결과를 신뢰하고, 별도로 다른 길찾기 API를 추가 조회하지
않는다.

## 인증키 설정

openapi.sk.com(SK Open API)에서 가입 후 "T map" 관련 앱을 만들면 발급되는
appKey를 `TMAP_API_KEY` 환경변수로 설정해야 한다. 무료 등급으로 충분하다.

PowerShell (영구 설정, 새 터미널부터 적용):

```powershell
setx TMAP_API_KEY "발급받은_appKey"
```

## 주소 저장 위치

`set_locations.js`가 주소를 지오코딩(Tmap Full Text Geocoding)해 좌표로 변환한
뒤, 사용자 홈 디렉터리의 다음 경로에 저장한다 (이 리포지토리 밖이므로 git으로
추적/커밋되지 않는다):

```
%USERPROFILE%\.claude\skill-data\home-eta\locations.json
```

## 참고: searchOption

`check_drive_time.js`는 Tmap `searchOption=01`(교통최적 + 무료우선, 톨게이트
회피)로 고정되어 있다. 유료도로를 포함한 최적 경로가 필요하면 이 값을 바꿔야
한다.
