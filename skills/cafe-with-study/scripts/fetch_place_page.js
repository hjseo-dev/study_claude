#!/usr/bin/env node
// 카페 링크(네이버 지역검색 결과의 link, 보통 네이버 플레이스 또는 지도 URL)를
// 받아 raw 페이지를 가져온다. 네이버 플레이스는 클라이언트 렌더링(SPA) 페이지라
// 리뷰 키워드 태그가 정적 HTML에 그대로 없을 수 있다 — 이 스크립트는 그 구조를
// 사전에 확정하지 않고, 원본 HTML과 함께 흔히 쓰이는 임베디드 상태 스크립트
// (__NEXT_DATA__, __APOLLO_STATE__ 등)를 찾아 있으면 파싱해서 같이 넘긴다.
// 실제 리뷰 태그 추출은 이 raw 데이터를 본 SKILL(호출한 쪽)이 직접 판단한다.
//
// 사용법: node fetch_place_page.js "<url>"

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function tryExtractEmbeddedState(html) {
  const candidates = [];

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      candidates.push({ source: "__NEXT_DATA__", data: JSON.parse(nextDataMatch[1]) });
    } catch {
      // 파싱 실패 시 무시하고 다음 후보 시도
    }
  }

  const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (apolloMatch) {
    try {
      candidates.push({ source: "__APOLLO_STATE__", data: JSON.parse(apolloMatch[1]) });
    } catch {
      // 파싱 실패 시 무시
    }
  }

  return candidates;
}

async function main() {
  const [url] = process.argv.slice(2);
  if (!url) {
    console.error(JSON.stringify({ error: true, message: "url이 필요합니다. 예: node fetch_place_page.js \"https://...\"" }));
    process.exit(1);
  }

  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" } });
  } catch (err) {
    console.log(JSON.stringify({ error: false, fetchFailed: true, url, message: err.message }));
    return;
  }

  const html = await res.text();
  const embeddedState = tryExtractEmbeddedState(html);

  console.log(JSON.stringify({
    error: false,
    fetchFailed: false,
    url,
    status: res.status,
    htmlLength: html.length,
    // 본문 전체를 다 넘기면 너무 커질 수 있어 앞부분만 미리보기로 남기고,
    // 실제 리뷰 태그 검색은 필요시 이 스크립트를 수정하거나 embeddedState를 활용.
    htmlPreview: html.slice(0, 3000),
    embeddedState,
    note: "embeddedState가 비어 있으면 이 페이지에서 흔히 쓰는 상태 스크립트 패턴(__NEXT_DATA__/__APOLLO_STATE__)이 없다는 뜻입니다 — htmlPreview나 다른 패턴을 직접 확인하거나, 이 카페는 리뷰 태그 확인 불가로 처리하세요. 네이버 플레이스 구조는 사전 확정되지 않았으므로 결과가 카페마다 다를 수 있습니다.",
  }));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
