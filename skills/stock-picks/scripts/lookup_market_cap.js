#!/usr/bin/env node
// 공공데이터포털 "금융위원회_주식시세정보" API(getStockPriceInfo)로 KOSPI+KOSDAQ
// 전체 종목의 최근 영업일 시세(시가총액 포함 추정)를 받아온 뒤, 넘겨받은
// 종목코드 목록에 해당하는 항목만 걸러서 돌려준다.
//
// 이 API 응답의 정확한 필드명은 사전에 100% 확정되지 않았다(공개 문서 기준
// mrktTotAmt=시가총액, srtnCd=단축코드/종목코드, itmsNm=종목명으로 알려져
// 있으나, 실제 서비스키로 호출해서 검증된 적은 없다). 그래서 이 스크립트는
// 필드를 임의로 가공하지 않고 raw item을 그대로 돌려준다 — 실제 필드명이
// 다르면 이 스크립트를 호출한 SKILL이 raw 데이터를 보고 판단해야 한다.
//
// 데이터가 "당일" 기준이 아니라 전전영업일 기준일 수 있다(주말/공휴일 제외,
// 오후 1시 이후 갱신). 이 스크립트는 최근 10일 중 데이터가 있는 첫 영업일을
// 자동으로 찾는다.
//
// 사용법: node lookup_market_cap.js <종목코드1> <종목코드2> ...
//   (종목코드는 get_theme_stocks.js가 준 code 값. 6자리 숫자)

const API_URL = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo";
// 주의: 이 API의 mrktCls 파라미터는 실제로는 필터링하지 않는다(어떤 값을 줘도
// 무시되고 같은 결과가 옴) — 확인됨. 그래서 시장 구분 없이 한 번에 전체
// 종목(코스피+코스닥 등, 하루 기준 약 2,900건)을 받아온다.
const MAX_ROWS = 4000;
const MAX_DAYS_BACK = 10;

function getServiceKey() {
  const key = process.env.STOCK_API_KEY;
  if (!key) {
    console.error(JSON.stringify({
      error: true,
      message: "STOCK_API_KEY 환경변수가 설정되어 있지 않습니다. data.go.kr 가입 후 '금융위원회_주식시세정보' 서비스를 활용신청하면 발급되는 서비스키를 STOCK_API_KEY로 등록하세요.",
    }));
    process.exit(1);
  }
  return key;
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

async function fetchDay(serviceKey, basDt) {
  const url = `${API_URL}?serviceKey=${encodeURIComponent(serviceKey)}&resultType=json&numOfRows=${MAX_ROWS}&pageNo=1&basDt=${basDt}`;
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, raw: text.slice(0, 500) };
  }
  const items = json?.response?.body?.items?.item;
  const resultCode = json?.response?.header?.resultCode;
  const itemsArr = Array.isArray(items) ? items : items ? [items] : [];
  if (resultCode !== "00" || itemsArr.length === 0) {
    return { ok: false, resultCode, raw: json?.response?.header };
  }
  return { ok: true, items: itemsArr };
}

async function main() {
  const codes = process.argv.slice(2);
  if (codes.length === 0) {
    console.error(JSON.stringify({ error: true, message: "종목코드가 1개 이상 필요합니다. 예: node lookup_market_cap.js 005930 000660" }));
    process.exit(1);
  }
  const serviceKey = getServiceKey();
  const codeSet = new Set(codes);

  let usedDate = null;
  let allItems = [];
  const attempts = [];

  for (let back = 0; back < MAX_DAYS_BACK; back++) {
    const d = new Date();
    d.setDate(d.getDate() - back);
    if (isWeekend(d)) continue;
    const basDt = ymd(d);

    const result = await fetchDay(serviceKey, basDt);
    attempts.push({ basDt, ok: result.ok });

    if (result.ok) {
      usedDate = basDt;
      allItems = result.items;
      break;
    }
  }

  if (!usedDate) {
    console.log(JSON.stringify({
      error: false,
      dataAvailable: false,
      message: `최근 ${MAX_DAYS_BACK}일 내에서 정상 응답을 받지 못했습니다. STOCK_API_KEY가 유효한지, 활용신청이 승인되었는지 확인하세요.`,
      attempts,
    }, null, 2));
    return;
  }

  const matched = allItems.filter((it) => codeSet.has(it.srtnCd));
  const notFound = codes.filter((c) => !matched.some((it) => it.srtnCd === c));

  console.log(JSON.stringify({
    error: false,
    dataAvailable: true,
    basDt: usedDate,
    requestedCount: codes.length,
    matchedCount: matched.length,
    notFoundCodes: notFound,
    items: matched,
    note: "각 item은 API 원본 필드를 그대로 담고 있다. 공개 문서 기준 mrktTotAmt가 시가총액(원 단위)으로 알려져 있으나 실제 검증은 안 됐으니, 이 필드가 실제로 있는지/숫자로 잘 파싱되는지 먼저 확인한 뒤 내림차순 정렬해서 상위 3개를 뽑을 것. notFoundCodes에 있는 종목은 이 시장 데이터에서 못 찾은 것(상장폐지/코드 오류 등 가능성).",
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
