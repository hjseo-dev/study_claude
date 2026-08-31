#!/usr/bin/env node
// 네이버 지역검색 API로 카페 후보 목록을 조회해서 raw JSON을 그대로 출력한다.
// 리뷰 태그 추출 등 분석은 하지 않는다.
//
// 2026년 네이버 검색 오픈API 개편으로 예전 개발자센터(openapi.naver.com,
// "검색" 카테고리)는 신규 발급이 막혔고, 신규 신청은 네이버클라우드 플랫폼의
// "NAVER API HUB"를 통해서만 가능해졌다. base URL과 인증 헤더가 바뀌었다
// (Client ID/Secret -> X-NCP-APIGW-API-KEY-ID/X-NCP-APIGW-API-KEY).
//
// 지역검색 경로(/search/v1/local)는 뉴스검색(/search/v1/news, 공식 확인됨)과
// 같은 패턴으로 추정한 것이라 100% 확정은 아니다. 404 등으로 실패하면 NCP
// 콘솔에서 지역검색 API를 선택했을 때 나오는 예제 코드의 실제 경로를 확인해서
// 아래 API_URL을 그 값으로 고쳐야 한다.
//
// 사용법: node search_naver_places.js "<검색어>" [display]
//   검색어  예: "강남역 카페", "홍대 스터디카페" (지역+카페 형태로 직접 넘길 것)
//   display 반환 개수 (기본 5). 네이버 지역검색 API는 display 최대값이 5로
//           고정되어 있어(다른 검색 API처럼 100까지 안 됨), 그 이상 요청해도
//           5개로 잘린다.
//
// 발급: NAVER Cloud Platform(ncloud.com) 가입 -> 콘솔에서 Services >
// AI·NAVER API 메뉴 -> Application 등록 -> 지역검색 API 선택 -> 발급받은
// Client ID/Secret을 NAVER_HUB_KEY_ID / NAVER_HUB_KEY 환경변수로 설정.

const API_URL = "https://naverapihub.apigw.ntruss.com/search/v1/local"; // 추정 경로, 위 주석 참고
const MAX_DISPLAY = 5; // 네이버 지역검색 API 문서상 display 최댓값

function getCredentials() {
  const id = process.env.NAVER_HUB_KEY_ID;
  const secret = process.env.NAVER_HUB_KEY;
  if (!id || !secret) {
    console.error(JSON.stringify({
      error: true,
      message: "NAVER_HUB_KEY_ID / NAVER_HUB_KEY 환경변수가 설정되어 있지 않습니다. NAVER Cloud Platform(ncloud.com)에 가입한 뒤 콘솔의 Services > AI·NAVER API 메뉴에서 Application을 등록하고 지역검색 API를 선택해 발급받은 Client ID/Secret을 환경변수로 설정하세요.",
    }));
    process.exit(1);
  }
  return { id, secret };
}

function stripHtml(s) {
  return typeof s === "string" ? s.replace(/<[^>]*>/g, "") : s;
}

async function main() {
  const [query, displayArg] = process.argv.slice(2);
  if (!query) {
    console.error(JSON.stringify({ error: true, message: "검색어가 필요합니다. 예: node search_naver_places.js \"강남역 카페\"" }));
    process.exit(1);
  }
  const display = Math.min(Number(displayArg) > 0 ? Number(displayArg) : MAX_DISPLAY, MAX_DISPLAY);

  const { id, secret } = getCredentials();
  const url = `${API_URL}?query=${encodeURIComponent(query)}&display=${display}&sort=comment`;

  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": id,
      "X-NCP-APIGW-API-KEY": secret,
    },
  });
  const text = await res.text();

  if (res.status === 404) {
    console.error(JSON.stringify({
      error: true,
      message: `요청한 경로(${API_URL})를 찾을 수 없습니다(404). 이 경로는 추정값이라 실제와 다를 수 있습니다 — NCP 콘솔에서 지역검색 API를 선택했을 때 나오는 예제 코드의 실제 요청 경로를 확인해서 이 스크립트의 API_URL을 고쳐야 합니다.`,
    }));
    process.exit(1);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error(JSON.stringify({ error: true, message: `API 응답을 JSON으로 해석할 수 없습니다. 응답 앞부분: ${text.slice(0, 200)}` }));
    process.exit(1);
  }

  if (!res.ok) {
    console.error(JSON.stringify({ error: true, message: `API 오류 (${res.status}): ${json.errorMessage ?? JSON.stringify(json)}` }));
    process.exit(1);
  }

  const items = (json.items ?? []).map((it) => ({
    title: stripHtml(it.title),
    category: it.category,
    address: it.address,
    roadAddress: it.roadAddress,
    telephone: it.telephone || null,
    link: it.link || null,
    mapx: it.mapx,
    mapy: it.mapy,
  }));

  console.log(JSON.stringify({
    error: false,
    query,
    total: json.total,
    returned: items.length,
    note: "네이버 지역검색 API는 페이지네이션 없이 최대 5개까지만 반환합니다. 더 많은 후보가 필요하면 검색어를 바꿔(예: 동네명을 다르게, '스터디카페' 추가 등) 여러 번 호출하고 중복(title+address 기준)을 제거하세요. link는 카페 자체 홈페이지/블로그일 수도 있고 네이버 플레이스 페이지가 아닐 수도 있습니다 — fetch_place_page.js로 확인하세요.",
    items,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
