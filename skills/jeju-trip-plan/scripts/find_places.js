#!/usr/bin/env node
// 숙소 주소(또는 숙소 이름)를 받아, 그 근처 지역명(읍/면/동)을 뽑아낸 뒤
// 네이버 지역검색 API(sort=comment, 리뷰 많은 순)로 관광지/맛집 후보를
// 조회한다. Tmap/TourAPI는 쓰지 않는다 — "실제 사람들이 많이 가는 곳" 요청에
// 맞춰, 공식 관광지 카탈로그 대신 리뷰 수 기반 인기순 데이터를 쓴다.
//
// 2026년 네이버 검색 오픈API 개편으로 신규 발급은 NAVER Cloud Platform의
// "NAVER API HUB"를 통해서만 가능하다(cafe-with-study 스킬과 동일). 지역검색
// 경로(/search/v1/local)는 공식 확인된 다른 검색 API(뉴스검색)와 같은 패턴으로
// 추정한 것이라 100% 확정은 아니다. 404가 나면 NCP 콘솔에서 지역검색 API를
// 선택했을 때 나오는 예제 코드의 실제 경로를 확인해 아래 API_URL을 고쳐야 한다.
//
// 사용법: node find_places.js "<숙소 주소 또는 숙소 이름>"
//
// 일정을 며칠에 걸쳐 어떻게 배치할지는 이 스크립트가 판단하지 않는다.
// 지역별 인기 후보 목록만 반환하고, 날짜별 배치는 SKILL.md 지침에 따라
// Claude가 판단한다.

const API_URL = "https://naverapihub.apigw.ntruss.com/search/v1/local"; // 추정 경로, 위 주석 참고
const MAX_DISPLAY = 5; // 네이버 지역검색 API 문서상 display 최댓값
const MIN_RESULTS_WANTED = 10; // attractions + restaurants 합계 기준 (부족하면 시/군 단위로 넓혀 재검색)

function getCredentials() {
  const id = process.env.NAVER_HUB_KEY_ID;
  const secret = process.env.NAVER_HUB_KEY;
  if (!id || !secret) {
    console.error(JSON.stringify({
      error: true,
      message: "NAVER_HUB_KEY_ID / NAVER_HUB_KEY 환경변수가 설정되어 있지 않습니다. cafe-with-study 스킬을 이미 쓰고 있다면 같은 키를 재사용하면 됩니다. 없다면 NAVER Cloud Platform(ncloud.com)에 가입한 뒤 콘솔의 Services > AI·NAVER API 메뉴에서 Application을 등록하고 지역검색 API를 선택해 발급받은 Client ID/Secret을 환경변수로 설정하세요.",
    }));
    process.exit(1);
  }
  return { id, secret };
}

function stripHtml(s) {
  return typeof s === "string" ? s.replace(/<[^>]*>/g, "") : s;
}

async function searchNaver(id, secret, query, display, sort = "comment") {
  const url = `${API_URL}?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": id,
      "X-NCP-APIGW-API-KEY": secret,
    },
  });
  const text = await res.text();

  if (res.status === 404) {
    throw new Error(`요청한 경로(${API_URL})를 찾을 수 없습니다(404). 이 경로는 추정값이라 실제와 다를 수 있습니다 — NCP 콘솔에서 지역검색 API를 선택했을 때 나오는 예제 코드의 실제 요청 경로를 확인해서 find_places.js의 API_URL을 고쳐야 합니다.`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`API 응답을 JSON으로 해석할 수 없습니다(쿼리: "${query}"). 응답 앞부분: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(`API 오류 (${res.status}, 쿼리: "${query}"): ${json.errorMessage ?? JSON.stringify(json)}`);
  }

  return (json.items ?? []).map((it) => ({
    title: stripHtml(it.title),
    category: it.category,
    address: it.roadAddress || it.address,
    telephone: it.telephone || null,
    link: it.link || null,
  }));
}

// 제주 주소에서 "제주시/서귀포시"와 그 다음 읍/면/동(리) 단위를 뽑아낸다.
// 예: "제주특별자치도 제주시 애월읍 곽지리 123-4" -> { city: "제주시", area: "애월읍" }
function extractRegion(addr) {
  if (!addr) return null;
  const m = addr.match(/(제주시|서귀포시)\s*([가-힣0-9]+(?:읍|면|동))/);
  if (!m) return null;
  return { city: m[1], area: m[2] };
}

// 제주시/서귀포시 원도심 지역은 도로명주소에 읍/면/동이 아예 안 나오는
// 경우가 흔하다(예: "서귀포시 칠십리로 242"). 그런 경우 시/군 단위까지만
// 확보한다.
function extractCity(addr) {
  if (!addr) return null;
  const m = addr.match(/(제주시|서귀포시)/);
  return m ? m[1] : null;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = `${it.title}|${it.address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

async function runQueries(id, secret, queries) {
  const results = await Promise.all(queries.map((q) => searchNaver(id, secret, q, MAX_DISPLAY)));
  return dedupe(results.flat());
}

async function main() {
  const [input] = process.argv.slice(2);
  if (!input) {
    console.error(JSON.stringify({ error: true, message: '사용법: node find_places.js "<숙소 주소 또는 숙소 이름>"' }));
    process.exit(1);
  }

  const { id, secret } = getCredentials();

  // 1) 입력에서 바로 지역명을 뽑아본다. 실패하면(주소가 아니라 숙소 이름 등)
  //    네이버 지역검색으로 숙소 자체를 찾아 주소를 얻은 뒤 다시 시도한다.
  let region = extractRegion(input);
  let cityOnly = false;
  let resolvedLodgingAddress = null;

  if (!region) {
    const city = extractCity(input);
    if (city) {
      region = { city, area: null };
      cityOnly = true;
    }
  }

  if (!region) {
    // 숙소 자체를 찾는 단계이므로 리뷰 많은 순(comment)이 아니라 정확도순
    // (random)으로 검색해야 한다 — comment로 하면 입력한 이름과 무관하게
    // 리뷰 많은 엉뚱한 곳이 1위로 잡힐 수 있다.
    const lodgingCandidates = await searchNaver(id, secret, input, 1, "random");
    resolvedLodgingAddress = lodgingCandidates[0]?.address || null;
    region = extractRegion(resolvedLodgingAddress);
    if (!region) {
      const city = extractCity(resolvedLodgingAddress);
      if (city) {
        region = { city, area: null };
        cityOnly = true;
      }
    }
  }

  if (!region) {
    console.log(JSON.stringify({
      error: false,
      needMoreInfo: true,
      message: `입력("${input}")에서 제주시/서귀포시를 찾지 못했습니다. 사용자에게 숙소가 제주시 쪽인지 서귀포시 쪽인지(가능하면 읍/면/동까지) 확인해달라고 요청하세요.`,
      resolvedLodgingAddress,
    }, null, 2));
    return;
  }

  const { city, area } = region;

  let attractions = [];
  let restaurants = [];
  let broadened = cityOnly;

  if (!cityOnly) {
    // 읍/면/동 이름만 넘기면 전국에 동명 지역(예: 경북 청송군에도 "안덕면"이
    // 있음)이 있어 엉뚱한 곳이 잡힐 수 있다. 반드시 "제주시/서귀포시"를
    // 붙여서 쿼리해야 한다.
    attractions = await runQueries(id, secret, [`${city} ${area} 관광지`, `${city} ${area} 가볼만한곳`]);
    restaurants = await runQueries(id, secret, [`${city} ${area} 맛집`]);
  }

  if (cityOnly || attractions.length + restaurants.length < MIN_RESULTS_WANTED) {
    broadened = true;
    const [moreAttractions, moreRestaurants] = await Promise.all([
      runQueries(id, secret, [`${city} 관광지`, `${city} 가볼만한곳`]),
      runQueries(id, secret, [`${city} 맛집`, `${city} 맛집 추천`]),
    ]);
    attractions = dedupe([...attractions, ...moreAttractions]);
    restaurants = dedupe([...restaurants, ...moreRestaurants]);
  }

  console.log(JSON.stringify({
    error: false,
    needMoreInfo: false,
    region: { city, area },
    resolvedLodgingAddress,
    broadenedToCityLevel: broadened,
    note: "sort=comment(리뷰 많은 순)로 조회한 결과입니다. category 필드를 보고 관광지/맛집과 무관한 항목(예: 병원, 부동산)이 섞여 있으면 제외하고 사용하세요.",
    attractions,
    restaurants,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
