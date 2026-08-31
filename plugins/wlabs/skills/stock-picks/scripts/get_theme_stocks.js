#!/usr/bin/env node
// 네이버 금융 테마 상세 페이지에서 그 테마에 속한 종목 코드/이름 목록을 가져온다.
// 로그인/인증키 불필요.
//
// 이 페이지엔 시가총액이 없다(현재가/등락률/거래량/거래대금만 있음). 시가총액
// 순위를 매기려면 이 스크립트가 준 종목코드 목록을 lookup_market_cap.js에
// 넘겨야 한다.
//
// 사용법: node get_theme_stocks.js <테마번호(no)>

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function main() {
  const [no] = process.argv.slice(2);
  if (!no) {
    console.error(JSON.stringify({ error: true, message: "테마번호(no)가 필요합니다. list_naver_themes.js 결과에서 얻으세요." }));
    process.exit(1);
  }

  const url = `https://finance.naver.com/sise/sise_group_detail.naver?type=theme&no=${encodeURIComponent(no)}`;
  let html;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const buf = await res.arrayBuffer();
    html = new TextDecoder("euc-kr").decode(buf);
  } catch (err) {
    console.log(JSON.stringify({ error: false, fetchFailed: true, no, message: err.message }));
    return;
  }

  const re = /\/item\/main\.naver\?code=(\d+)">([^<]+)<\/a>/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(html))) {
    seen.set(m[1], m[2].trim());
  }

  const stocks = Array.from(seen.entries()).map(([code, name]) => ({ code, name }));

  console.log(JSON.stringify({
    error: false,
    fetchFailed: false,
    no,
    count: stocks.length,
    stocks,
    note: stocks.length === 0
      ? "종목이 하나도 안 잡혔습니다 — 테마번호가 잘못되었거나 페이지 구조가 바뀌었을 수 있습니다."
      : "이 목록엔 시가총액이 없습니다. lookup_market_cap.js에 이 종목코드들을 넘겨서 시가총액을 조회하세요. 종목 수가 많으면(수십 개) 상위 3개만 뽑을 목적이라도 전부 넘겨서 정확히 비교하세요 — 일부만 넘기면 진짜 1~3위가 아닐 수 있습니다.",
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
