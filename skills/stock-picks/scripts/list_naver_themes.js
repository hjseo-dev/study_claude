#!/usr/bin/env node
// 네이버 금융 "테마별 시세" 페이지에서 전체 테마 목록(테마명 + 번호)을 가져온다.
// 로그인/인증키 불필요. 페이지가 EUC-KR 인코딩이라 TextDecoder로 직접 디코딩한다.
//
// 이 스크립트는 어떤 테마가 사용자 키워드와 맞는지 판단하지 않는다(판단은
// 이 스크립트를 호출하는 SKILL이 담당). 그냥 전체 목록을 그대로 반환한다.
//
// 사용법: node list_naver_themes.js

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_PAGES = 15; // 안전장치 — 이 이상은 없을 것으로 추정(실측 시점 기준 7페이지 이상 존재)

async function fetchPage(page) {
  const res = await fetch(`https://finance.naver.com/sise/theme.naver?page=${page}`, {
    headers: { "User-Agent": UA },
  });
  const buf = await res.arrayBuffer();
  return new TextDecoder("euc-kr").decode(buf);
}

function extractThemes(html) {
  const re = /sise_group_detail\.naver\?type=theme&no=(\d+)"[^>]*>([^<]+)<\/a>/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    out.push({ no: m[1], name: m[2].trim() });
  }
  return out;
}

async function main() {
  const seen = new Map();
  for (let page = 1; page <= MAX_PAGES; page++) {
    let html;
    try {
      html = await fetchPage(page);
    } catch (err) {
      break; // 네트워크 오류면 지금까지 모은 것으로 마무리
    }
    const themes = extractThemes(html);
    if (themes.length === 0) break; // 더 이상 페이지 없음
    const beforeSize = seen.size;
    for (const t of themes) seen.set(t.no, t.name);
    if (seen.size === beforeSize) break; // 새 테마가 없으면(마지막 페이지 반복) 중단
  }

  console.log(JSON.stringify({
    error: false,
    total: seen.size,
    themes: Array.from(seen.entries()).map(([no, name]) => ({ no, name })),
    note: "이 목록에서 사용자 키워드와 의미상 가장 가까운 테마명을 골라야 한다. 정확히 일치하는 이름이 없을 수 있으니 유사어/포함관계로 판단할 것 (예: '2차전지' 키워드는 '2차전지(생산)'류 이름과 매칭).",
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
