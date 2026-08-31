#!/usr/bin/env node
// 금융감독원 "금융상품 한눈에"(finlife) API로 예금/적금 상품을 조회해서
// 정렬 + 인덱스를 붙여 반환한다.
//
// 사용법: node fetch_products.js <deposit|saving> <bank|savings-bank|both> <base|final> [개월수[+]] [상위N]
//
// 4번째 인자(선택): 목표 개월수. 그냥 숫자(예: "12")면 정확히 일치하는 것만,
// 뒤에 +를 붙이면(예: "12+") 그 이상인 것도 포함한다. 정확히 일치하는 게
// 하나도 없으면 가장 가까운 개월수로 자동 대체하고 결과의 nearestFallback에
// 표시한다. 생략하면 전체를 다 반환한다(개수가 아주 많을 수 있으니 되도록
// 넘긴다 — 컨텍스트에 큰 JSON이 그대로 올라가는 걸 막기 위한 필터다).
// 5번째 인자(선택): 정렬 후 상위 몇 개만 반환할지 (기본 20).
//
// 엔드포인트는 공식 문서가 상세 스펙을 완전히 공개하지 않아 아래 경로로
// 추정했다 (2026-08-30 기준). 첫 실행에서 404/형식 오류가 나면 이 값이
// 틀린 것이니, finlife.fss.or.kr의 "오픈API > 상세 및 테스트" 페이지에서
// 실제 경로를 확인해 아래 ENDPOINTS를 고친다.
const ENDPOINTS = {
  deposit: "http://finlife.fss.or.kr/finlifeapi/depositProductsSearch.json",
  saving: "http://finlife.fss.or.kr/finlifeapi/savingProductsSearch.json",
};

const REGION_CODES = {
  bank: ["020000"],
  "savings-bank": ["030300"],
  both: ["020000", "030300"],
};

function getApiKey() {
  const raw = process.env.FINLIFE_API_KEY;
  if (!raw) {
    console.error(JSON.stringify({
      error: true,
      message: "FINLIFE_API_KEY 환경변수가 설정되어 있지 않습니다. finlife.fss.or.kr에서 오픈API 인증키를 발급받아 FINLIFE_API_KEY 환경변수에 설정하세요.",
    }));
    process.exit(1);
  }
  return raw;
}

async function fetchAllPages(endpoint, params) {
  const key = getApiKey();
  const items = [];
  let pageNo = 1;
  let maxPageNo = 1;

  do {
    const qs = new URLSearchParams({ ...params, auth: key, pageNo: String(pageNo) }).toString();
    const url = `${endpoint}?${qs}`;
    const res = await fetch(url);
    const text = await res.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`API 응답을 JSON으로 해석할 수 없습니다. 엔드포인트가 틀렸을 수 있습니다. 응답 앞부분: ${text.slice(0, 200)}`);
    }

    const body = json?.result;
    if (!body) {
      throw new Error(`API 응답에 result가 없습니다: ${text.slice(0, 200)}`);
    }
    if (body.err_cd && body.err_cd !== "000") {
      throw new Error(`API 오류 (${body.err_cd}): ${body.err_msg ?? "알 수 없는 오류"}`);
    }

    maxPageNo = Number(body.max_page_no ?? 1);
    for (const p of body.baseList ?? []) items.push({ base: p, options: [] });
    // optionList는 fin_prdt_cd로 baseList와 매칭되는 별도 배열로 오는 경우가 많다.
    const byCode = new Map(items.map((it) => [it.base.fin_prdt_cd, it]));
    for (const o of body.optionList ?? []) {
      const match = byCode.get(o.fin_prdt_cd);
      if (match) match.options.push(o);
    }

    pageNo += 1;
  } while (pageNo <= maxPageNo);

  return items;
}

const EVENT_KEYWORDS = ["특판", "이벤트", "한정", "선착순", "프로모션"];

function guessEvent(text) {
  if (!text) return false;
  return EVENT_KEYWORDS.some((k) => text.includes(k));
}

// "월 최대 30만원", "월 30만원 한도" 같은 패턴을 최대한 찾아본다. 못 찾으면 null.
function guessMonthlyLimit(text) {
  if (!text) return null;
  const m = text.match(/월\s*(?:최대\s*)?([0-9,]+)\s*만\s*원/);
  if (m) return `${m[1]}만원 (추정)`;
  return null;
}

async function main() {
  const [, , productType, region, sortBy, monthsArg, topNArg] = process.argv;
  if (!["deposit", "saving"].includes(productType)) {
    throw new Error("첫 번째 인자는 deposit 또는 saving 이어야 합니다.");
  }
  if (!REGION_CODES[region]) {
    throw new Error("두 번째 인자는 bank, savings-bank, both 중 하나여야 합니다.");
  }
  const sortKey = sortBy === "final" ? "intr_rate2" : "intr_rate";
  const topN = topNArg ? Number(topNArg) : 20;

  let monthsMode = null; // { type: "exact"|"atLeast", value: number }
  if (monthsArg) {
    if (monthsArg.endsWith("+")) {
      monthsMode = { type: "atLeast", value: Number(monthsArg.slice(0, -1)) };
    } else {
      monthsMode = { type: "exact", value: Number(monthsArg) };
    }
  }

  const endpoint = ENDPOINTS[productType];
  const regionLabel = { bank: "1금융권(은행)", "savings-bank": "2금융권(저축은행)", both: "1+2금융권" }[region];

  const rows = [];
  for (const topFinGrpNo of REGION_CODES[region]) {
    const items = await fetchAllPages(endpoint, { topFinGrpNo });
    for (const { base, options } of items) {
      for (const opt of options) {
        const cndText = [base.spcl_cnd, base.join_member].filter(Boolean).join(" ");
        rows.push({
          bank: base.kor_co_nm,
          product: base.fin_prdt_nm,
          joinWay: base.join_way ?? null,
          joinTarget: base.join_member ?? null,
          termMonths: Number(opt.save_trm),
          baseRate: opt.intr_rate != null ? Number(opt.intr_rate) : null,
          finalRate: opt.intr_rate2 != null ? Number(opt.intr_rate2) : null,
          rateType: opt.intr_rate_type === "M" ? "복리" : "단리",
          reserveType: productType === "saving" ? (opt.rsrv_type === "F" ? "자유적립" : "정액적립") : null,
          monthlyLimitGuess: productType === "saving" ? (guessMonthlyLimit(cndText) ?? "명시 안 됨") : null,
          eventGuess: guessEvent(base.fin_prdt_nm) || guessEvent(base.spcl_cnd),
          disclosureEndDate: base.dcls_end_day ?? null, // "이벤트 종료일"이 아니라 공시 종료일(참고용)
          specialCondition: base.spcl_cnd ?? null,
        });
      }
    }
  }

  const rateField = sortKey === "intr_rate2" ? "finalRate" : "baseRate";
  rows.sort((a, b) => (b[rateField] ?? -1) - (a[rateField] ?? -1));

  let filtered = rows;
  let nearestFallback = null;
  if (monthsMode) {
    if (monthsMode.type === "atLeast") {
      filtered = rows.filter((r) => r.termMonths >= monthsMode.value);
    } else {
      filtered = rows.filter((r) => r.termMonths === monthsMode.value);
      if (filtered.length === 0 && rows.length > 0) {
        const available = [...new Set(rows.map((r) => r.termMonths))];
        const nearest = available.reduce((a, b) =>
          Math.abs(b - monthsMode.value) < Math.abs(a - monthsMode.value) ? b : a
        );
        nearestFallback = { requested: monthsMode.value, used: nearest };
        filtered = rows.filter((r) => r.termMonths === nearest);
      }
    }
  }

  const limited = filtered.slice(0, topN);
  const indexed = limited.map((r, i) => ({ index: i + 1, ...r }));

  console.log(JSON.stringify({
    error: false,
    productType,
    region: regionLabel,
    sortBy: sortBy === "final" ? "최종금리(우대조건 반영)" : "기본금리",
    totalBeforeFilter: rows.length,
    nearestFallback,
    count: indexed.length,
    products: indexed,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exitCode = 1; // 비동기 fetch 이후이므로 process.exit()으로 강제종료하지 않는다 (weather에서 발견한 크래시 방지)
});
