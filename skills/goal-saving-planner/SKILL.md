---
name: goal-saving-planner
description: Use when the user wants to figure out how much they can spend on their card each month while still hitting a savings goal by a target year, based on salary and fixed costs, and see a 30-year compound-interest asset projection across savings/investment products. Triggers on: "월급이랑 고정비 넣으면 카드값 얼마까지 쓸 수 있어", "목표금액 몇년안에 모으려면", "적금 예금 투자 나눠서 복리 계산해줘", "자산 계획 짜줘", "goal saving planner", "카드값 한도 계산". Not for comparing real bank deposit/installment product rates (use savings-compare instead) — this skill is for personal budget allocation and long-horizon compound projection using rates the user assumes themselves.
disable-model-invocation: true
---

# goal-saving-planner — 목표저축 기반 카드값 한도 + 30년 자산 시뮬레이션

월급과 고정비, 기존에 진행 중인 저축상품을 반영해서 "목표금액을 몇 년 안에 모으려면
카드값은 최대 얼마까지 쓸 수 있는지"를 역산하고, 그 목표저축액(+기존 저축)을
예금/적금/투자 등에 나눠 넣었을 때 복리 효과까지 반영한 30년 자산 시뮬레이션을
보여준다.

계산 공식은 [references/formula.md](references/formula.md)에 정리되어 있다 — 스크립트가
이미 그 공식대로 정확히 계산하므로, **직접 암산하거나 어림잡아 계산하지 않는다**.
반드시 `scripts/calculate_plan.js`의 출력을 그대로 사용한다.

## 1. 프로필 확인

`D:\dev\study_claude\.private\goal-saving-planner\profile.json` 파일이 있는지
확인한다(Read 시도).

- **없으면**: 다음을 물어본다 — 월급, 그리고 고정비/즉시지출/생활비/부가세모으기
  4개 항목의 금액. 이어서 "현재 진행 중인 저축상품이 있나요?"라고 물어보고, 있다면
  각각에 대해 이름, 거치식(예금)인지 적립식(적금)인지, 금액(예금이면 원금, 적금이면
  월납입액), 연금리, 남은 기간(개월), 단리/복리 여부를 받는다. 없으면 빈 배열로
  둔다.
- **있으면**: 저장된 값을 요약해서 보여주고 "이 값 그대로 쓸까요, 아니면 바꿀
  내용이 있나요?"라고 확인한다. 바뀐 내용이 있으면 그 값으로 다시 저장한다.

수집한 값을 임시 JSON 파일(스크래치패드)로 만들어 저장한다:

```json
{
  "salary": 4000000,
  "fixedCosts": { "고정비": 500000, "즉시지출": 300000, "생활비": 800000, "부가세모으기": 200000 },
  "existingSavings": [
    { "name": "청년적금", "kind": "installment", "monthlyAmount": 300000, "annualRatePercent": 4.5, "termMonths": 18, "compounding": "simple" }
  ]
}
```

`kind`는 `"lumpsum"`(예금, `principal` 필드 사용) 또는 `"installment"`(적금,
`monthlyAmount` 필드 사용). `termMonths`는 **지금부터 남은 개월 수**. 정부기여금·
회사매칭처럼 월급에서 나가는 돈이 아닌 항목이 섞여 있으면(예: 청년도약형 적금의
정부기여금), 본인 납입분과 분리해서 별도 항목으로 만들고
`excludeFromOutflow: true`를 붙인다. 사용자가 "만기된 예적금을 다른 자산으로
갈아타고 싶다"고 하면 그 항목에 `rolloverTo: { annualRatePercent, compounding }`을
붙인다([references/formula.md](references/formula.md) 참고). 그 다음 실행한다:

```
node <스킬 디렉터리>/scripts/set_profile.js <임시JSON경로>
```

## 2. 목표 & 신규 배분 수집

매번(저장하지 않음) 다음을 물어본다:

- 목표금액, 목표기간(년)
- 그 목표저축액을 나눠 넣을 상품들: 각각 이름, 거치식/적립식, 금액(원금 또는
  월납입액), 예상 연수익률(%), 기간(개월 — 30년 내내 계속 적립하고 싶다면 360),
  단리/복리 여부

사용자가 수익률을 모르겠다고 하면, 이 스킬은 API로 실제 상품을 조회하지 않고
**사용자가 가정한 값**만 쓴다는 것을 안내하고, 참고용으로 "예금/적금 평균
3~4%대, 투자/ETF는 상품마다 편차가 커서 사용자가 기대하는 값을 직접 불러야 한다"
정도로만 안내한다. 3.3% 예시 시나리오는 스크립트가 자동으로 함께 계산해주므로
별도로 만들 필요 없다.

## 3. 계산 실행

목표/신규배분 입력을 임시 JSON 파일로 만든다:

```json
{
  "goalAmount": 100000000,
  "goalYears": 10,
  "newAllocations": [
    { "name": "적금A", "kind": "installment", "monthlyAmount": 400000, "annualRatePercent": 4.0, "termMonths": 24, "compounding": "simple" },
    { "name": "ETF투자", "kind": "installment", "monthlyAmount": 300000, "annualRatePercent": 7.0, "termMonths": 360, "compounding": "compound" }
  ]
}
```

실행:

```
node <스킬 디렉터리>/scripts/calculate_plan.js <임시JSON경로>
```

`needSetup: true`가 나오면 1단계를 빠뜨린 것이니 먼저 프로필을 저장한다.

## 4. 결과 정리

출력 JSON을 아래 순서로 한국어로 정리한다:

1. **여유자금**, **목표달성 필요 월저축액**, **카드값 한도**를 가장 먼저 명확히
   제시 (`disposableIncome`, `requiredMonthlySaving`, `cardLimit`)
2. `warnings`가 있으면 그대로 안내 (신규 배분 합계가 필요 월저축액과 다름 등)
3. `totalAssetByYear`에서 주요 이정표 연도(1, 3, 5, 10, 15, 20, 25, 30년)만 표로
   보여준다 — 30개 행 전부를 나열하지 않는다. 전체 연도별 수치가 필요하면
   사용자가 요청할 때만 추가로 보여준다.
4. `exampleScenario`(연 3.3% 적금 예시)를 "만약 전액을 이렇게만 넣었다면"
   비교용으로 짧게 언급
5. `existingSavingsProjection`/`newAllocationsProjection`의 상품별 30년 후
   잔액도 표로 함께 보여준다
6. **모든 금액은 세전 기준**이며, 만기 상품은 "같은 조건으로 재예치했다"고
   가정한 시뮬레이션이라는 점을 마지막에 짧게 밝힌다.

## 5. 결과 리포트 생성 (로컬 HTML)

4단계 정리 내용을 로컬 HTML 파일로도 저장한다. **이 파일에는 월급·고정비·기존
저축 상품명 같은 실제 개인 재무정보가 그대로 들어가므로, 저장 위치는 반드시
`D:\dev\study_claude\.private\goal-saving-planner\docs\<yyyyMMdd-HHmm>.html`
(← `.gitignore`로 커밋 제외되는 `.private/` 하위)로 한다 — 절대 `.private/` 밖,
즉 git이 추적하는 경로에는 쓰지 않는다.** 다른 wlabs 스킬(test-case-creator 등)의
결과 문서도 전부 `docs/` 하위에 두는 걸 컨벤션으로 삼으므로, 여기서도
`reports/`가 아니라 `docs/`를 쓴다. Artifact 도구도 쓰지 않는다(사용자가
명시적으로 공유하겠다고 하지 않는 한, 개인 재무정보를 외부에 올릴 이유가 없다).

포함 내용: 프로필 요약(월급/고정비 항목별 금액), 여유자금/목표저축액/카드값 한도,
확정된 신규배분(상품별 금액·수익률), 만기 재예치 정책(어떤 상품이 만기 후 어디로
넘어가는지), 이정표 연도별 총자산 표, 상품별 30년 후 잔액. 스타일은 이전에 만든
`test-case-creator`의 리포트와 비슷한 톤(카드형 레이아웃, 표, 요약 스탯)으로
가되 색상 배지는 관점(기능/보안 등)이 아니라 카드값/저축/투자 구분에 맞게

사용자가 "이 조건이면 어떻게 돼?"처럼 다른 가정(예: 신규 납입을 몇 년만 하고
멈춘다, 배분 비중을 바꾼다)을 추가로 물어보면, **새 파일을 또 만들지 않고 같은
리포트 파일 안에 탭을 추가**해서 시나리오를 나란히 비교할 수 있게 한다(바닐라
JS로 탭 전환, 외부 라이브러리 없음). 신규 납입을 특정 기간만 하고 멈추는
시나리오는 `calculate_plan.js`가 기존저축의 만기(`termMonths`)를 프로필에
저장된 값으로 고정해서 쓰므로, 그 경우엔 `scripts/lib/finance.js`의
`simulateProduct`를 직접 불러 임시로 계산한다(계산 후 버린다 — 프로필 자체는
바꾸지 않는다).
새로 정한다.

대화창에는 표 전체를 다시 출력하지 않고, 핵심 숫자(카드값 한도, 목표달성 연도)와
**리포트 파일 경로**만 안내한다.

## 6. 값 변경

"프로필 다시 설정해줘", "월급 바뀌었어" 같은 요청을 받으면 1단계로 돌아가
새 값을 물어보고 `set_profile.js`로 덮어쓴다. 목표금액/신규배분은 애초에
저장하지 않으므로 매번 새로 받으면 된다.

## 안티패턴

- 스크립트 없이 직접 복리를 암산하거나 근사치로 답하지 않는다 — 30년치 재예치까지
  포함된 계산은 반드시 `calculate_plan.js`로 한다.
- 월급/고정비/기존저축 상품명 같은 개인 재무정보를 git이 추적하는 경로에 쓰지
  않는다 — 항상 `set_profile.js`를 통해 `.private/`(← `.gitignore`)에만
  저장한다. 5단계의 HTML 리포트도 마찬가지로 `.private/`에만 저장하고, Artifact
  도구로 올리지 않는다.
- 실제 은행 예금/적금 금리를 API로 조회하려 하지 않는다 — 이 스킬은 사용자가
  가정한 수익률만 쓴다 (실제 상품 비교가 필요하면 `savings-compare`를 안내한다).
- 30개 연도 전체를 항상 표로 나열하지 않는다 — 이정표 연도만 기본으로 보여준다.
