#!/usr/bin/env node
// 차종(모델명)으로 한국에너지공단 "자동차 표시연비 목록 조회" 공공데이터 API를 호출해
// 모델명이 검색어를 포함하는 항목들을 찾아 돌려준다.
//
// 이 API는 XML만 응답하고(type=json 파라미터를 무시함), 서버 측 모델명 검색
// 파라미터가 없으며 페이지당 최대 100건으로 고정되어 있다(실제 호출로 확인됨,
// 2026-08-30). 그래서 전체 목록(약 3700여건)을 페이지네이션으로 순회하며
// 클라이언트에서 MODEL_NM에 검색어가 포함되는 항목만 걸러낸다.
//
// 사용법: node lookup_fuel_efficiency.js "<차종 검색어>"
//
// 필요한 환경변수:
// - FUEL_API_KEY: data.go.kr에서 발급받은 서비스키. data.go.kr 마이페이지의
//   키는 이미 URL-인코딩된 형태로 제공되므로(예: "%2B", "%2F" 포함), 이 값을
//   그대로 쿼리에 붙인다 (다시 encodeURIComponent 하면 이중 인코딩되어
//   SERVICE_KEY_IS_NOT_REGISTERED_ERROR가 난다 — 실제로 겪은 문제).

const FUEL_API_BASE_URL = "https://apis.data.go.kr/B553530/CAREFF/CAREFF_LIST";
const ROWS_PER_PAGE = 100;
const MAX_PAGES = 50; // 안전장치: 전체 데이터가 늘어나도 무한 루프하지 않도록

function getEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(JSON.stringify({
      error: true,
      message: `${name} 환경변수가 설정되어 있지 않습니다. data.go.kr에서 "한국에너지공단_자동차 표시연비 목록 조회 서비스"를 활용신청한 뒤, 발급된 서비스키를 FUEL_API_KEY 환경변수로 설정하세요.`,
    }));
    process.exit(1);
  }
  return v;
}

function serviceKeyParam(rawKey) {
  return rawKey.includes("%") ? rawKey : encodeURIComponent(rawKey);
}

function tag(itemXml, name) {
  const m = itemXml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return m ? m[1].trim() : null;
}

function toNumberOrNull(v) {
  if (v == null || v === "NULL" || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseItems(xml) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return blocks.map((b) => ({
    model: tag(b, "MODEL_NM"),
    company: tag(b, "COMP_NM"),
    year: toNumberOrNull(tag(b, "YEAR")),
    carKind: tag(b, "CAR_KIND"),
    fuelType: tag(b, "FUEL_NM"),
    displayEff: toNumberOrNull(tag(b, "DISPLAY_EFF")),
    highwayEff: toNumberOrNull(tag(b, "HIGHWAY_EFF")),
    urbanEff: toNumberOrNull(tag(b, "URBAN_EFF")),
  }));
}

function parseHeader(xml) {
  const resultCode = xml.match(/<resultCode>(.*?)<\/resultCode>/)?.[1];
  const resultMsg = xml.match(/<resultMsg>(.*?)<\/resultMsg>/)?.[1];
  const errMsg = xml.match(/<errMsg>(.*?)<\/errMsg>/)?.[1];
  const returnAuthMsg = xml.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/)?.[1];
  const totalCount = toNumberOrNull(xml.match(/<totalCount>(\d+)<\/totalCount>/)?.[1]);
  return { resultCode, resultMsg, errMsg, returnAuthMsg, totalCount };
}

async function fetchPage(serviceKey, pageNo) {
  const url = `${FUEL_API_BASE_URL}?serviceKey=${serviceKeyParam(serviceKey)}&numOfRows=${ROWS_PER_PAGE}&pageNo=${pageNo}`;
  const res = await fetch(url);
  return res.text();
}

async function main() {
  const [query] = process.argv.slice(2);
  if (!query) {
    console.error(JSON.stringify({ error: true, message: '사용법: node lookup_fuel_efficiency.js "<차종 검색어>"' }));
    process.exit(1);
  }

  const serviceKey = getEnv("FUEL_API_KEY");
  const needle = query.toUpperCase();

  const firstPage = await fetchPage(serviceKey, 1);
  const header = parseHeader(firstPage);

  if (header.errMsg || (header.resultCode && header.resultCode !== "00")) {
    console.log(JSON.stringify({
      error: true,
      message: `API 오류: ${header.errMsg ?? header.resultMsg ?? "알 수 없는 오류"} (${header.returnAuthMsg ?? ""})`,
    }));
    return;
  }

  const totalCount = header.totalCount ?? ROWS_PER_PAGE;
  const totalPages = Math.min(MAX_PAGES, Math.ceil(totalCount / ROWS_PER_PAGE));

  const matches = [];
  let pagesScanned = 0;
  for (let page = 1; page <= totalPages; page++) {
    const xml = page === 1 ? firstPage : await fetchPage(serviceKey, page);
    pagesScanned++;
    for (const item of parseItems(xml)) {
      if (item.model && item.model.toUpperCase().includes(needle)) {
        matches.push(item);
      }
    }
  }

  console.log(JSON.stringify({
    error: false,
    query,
    totalCount,
    pagesScanned,
    matchCount: matches.length,
    matches: matches.slice(0, 30),
    note: matches.length === 0
      ? "일치하는 모델을 찾지 못했습니다. 검색어를 다르게(정식 모델명 일부) 시도하거나, 사용자에게 연비/유종을 직접 물어보세요."
      : "matches에서 사용자가 원하는 정확한 모델(연식/등급 포함)을 골라 확인받은 뒤 save_car.js로 저장하세요. displayEff가 복합연비(km/L, 전기차는 km/kWh)입니다.",
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
