#!/usr/bin/env node
// 관심종목(또는 인자로 받은 종목명/코드)에 대해
//  - DART 재무제표(fnlttSinglAcntAll.json) 원본 계정과목 배열
//  - 공공데이터포털 "금융위원회_주식시세정보" 원본 시세 한 건
// 을 그대로 모아 반환한다. ROE/PER/PBR/PEG 등 계산은 하지 않는다 — 계정과목
// 명이 회사·보고서마다 다를 수 있어, 호출한 SKILL(Claude)이 raw 데이터를
// 보고 판단해야 한다.
//
// usage:
//   node fetch_screening.js                   (저장된 관심종목 전체)
//   node fetch_screening.js 삼성전자 000660     (이름/코드 혼용 가능)

const fs = require("fs");
const path = require("path");
const { ensureCorpMap, findByCode, findByName } = require("./ensure_corp_map");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const DATA_DIR = path.join(REPO_ROOT, ".private", "stock-screener");
const WATCHLIST_FILE = path.join(DATA_DIR, "watchlist.json");

const DART_BASE = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";
const STOCK_API_URL = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo";
const MAX_DAYS_BACK = 10;

function requireEnv(name, hint) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} 환경변수가 설정되어 있지 않습니다. ${hint}`);
  return v;
}

function loadWatchlist() {
  if (!fs.existsSync(WATCHLIST_FILE)) return [];
  return JSON.parse(fs.readFileSync(WATCHLIST_FILE, "utf8"));
}

function resolveTargets(args, corpMapEntries) {
  const resolved = [];
  const errors = [];
  const inputs =
    args.length > 0
      ? args.map((a) => ({ raw: a }))
      : loadWatchlist().map((w) => ({ raw: w.code, presetName: w.name }));

  if (inputs.length === 0) {
    return {
      resolved,
      errors: [
        {
          raw: null,
          message:
            "관심종목이 비어 있고 인자도 없습니다. set_watchlist.js로 먼저 등록하거나 종목명/코드를 인자로 넘기세요.",
        },
      ],
    };
  }

  for (const input of inputs) {
    const raw = input.raw.trim();
    let match = null;
    if (/^\d{6}$/.test(raw)) {
      match = findByCode(corpMapEntries, raw);
    } else {
      const candidates = findByName(corpMapEntries, raw);
      if (candidates.length === 1) {
        match = candidates[0];
      } else if (candidates.length > 1) {
        errors.push({
          raw,
          message: "이름이 여러 종목에 매칭됩니다. 정확한 종목코드를 확인해서 다시 시도하세요.",
          candidates: candidates.slice(0, 10).map((c) => ({ name: c.corp_name, code: c.stock_code })),
        });
        continue;
      }
    }
    if (!match) {
      errors.push({ raw, message: "매핑되는 종목을 찾지 못했습니다 (상장폐지/이름 오타 가능)." });
      continue;
    }
    resolved.push({
      input: raw,
      name: input.presetName || match.corp_name,
      code: match.stock_code,
      corp_code: match.corp_code,
    });
  }
  return { resolved, errors };
}

async function fetchDartFinancials(apiKey, corpCode) {
  const currentYear = new Date().getFullYear();
  const attempts = [];
  for (const yearOffset of [1, 2, 3]) {
    const bsnsYear = String(currentYear - yearOffset);
    for (const fsDiv of ["CFS", "OFS"]) {
      const url = `${DART_BASE}?crtfc_key=${encodeURIComponent(apiKey)}&corp_code=${corpCode}&bsns_year=${bsnsYear}&reprt_code=11011&fs_div=${fsDiv}`;
      const res = await fetch(url);
      const json = await res.json();
      attempts.push({ bsnsYear, fsDiv, status: json.status, message: json.message });
      if (json.status === "000" && Array.isArray(json.list) && json.list.length > 0) {
        return { ok: true, bsnsYear, fsDiv, list: json.list };
      }
    }
  }
  return { ok: false, attempts };
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

async function fetchStockPriceDay(apiKey, basDt) {
  const url = `${STOCK_API_URL}?serviceKey=${encodeURIComponent(apiKey)}&resultType=json&numOfRows=4000&pageNo=1&basDt=${basDt}`;
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, raw: text.slice(0, 300) };
  }
  const items = json?.response?.body?.items?.item;
  const resultCode = json?.response?.header?.resultCode;
  const arr = Array.isArray(items) ? items : items ? [items] : [];
  if (resultCode !== "00" || arr.length === 0) return { ok: false, resultCode };
  return { ok: true, items: arr };
}

async function fetchAllStockPrices(apiKey) {
  for (let back = 0; back < MAX_DAYS_BACK; back++) {
    const d = new Date();
    d.setDate(d.getDate() - back);
    if (isWeekend(d)) continue;
    const basDt = ymd(d);
    const result = await fetchStockPriceDay(apiKey, basDt);
    if (result.ok) return { ok: true, basDt, items: result.items };
  }
  return { ok: false };
}

async function main() {
  const args = process.argv.slice(2);

  let dartKey, stockKey;
  try {
    dartKey = requireEnv("DART_API_KEY", "opendart.fss.or.kr에서 발급 후 등록하세요.");
    stockKey = requireEnv("STOCK_API_KEY", "data.go.kr '금융위원회_주식시세정보' 서비스 활용신청 후 등록하세요.");
  } catch (err) {
    console.log(JSON.stringify({ error: true, message: err.message }));
    process.exit(1);
  }

  let corpMap;
  try {
    corpMap = await ensureCorpMap();
  } catch (err) {
    console.log(JSON.stringify({ error: true, message: `DART corp_code 매핑 준비 실패: ${err.message}` }));
    process.exit(1);
  }

  const { resolved, errors } = resolveTargets(args, corpMap.entries);

  if (resolved.length === 0) {
    console.log(
      JSON.stringify(
        { error: true, message: "조회할 종목을 하나도 확정하지 못했습니다.", resolveErrors: errors },
        null,
        2
      )
    );
    process.exit(1);
  }

  const priceResult = await fetchAllStockPrices(stockKey);
  const priceByCode = new Map();
  if (priceResult.ok) {
    for (const item of priceResult.items) {
      priceByCode.set(item.srtnCd, item);
    }
  }

  const results = [];
  for (const target of resolved) {
    const dart = await fetchDartFinancials(dartKey, target.corp_code);
    const price = priceByCode.get(target.code) || null;
    results.push({
      name: target.name,
      code: target.code,
      corp_code: target.corp_code,
      dart,
      price,
    });
  }

  console.log(
    JSON.stringify(
      {
        error: false,
        priceDataDate: priceResult.ok ? priceResult.basDt : null,
        priceDataAvailable: priceResult.ok,
        resolveErrors: errors,
        results,
        note:
          "dart.list는 계정과목(account_nm) raw 배열이다. 정확한 문구는 회사/보고서마다 다를 수 있으니 먼저 유니크한 account_nm 목록을 확인한 뒤 매출액/영업이익/당기순이익/자산총계/부채총계/자본총계/영업활동현금흐름 등을 찾아 계산할 것. price는 공공데이터포털 응답 원본이며 clpr=종가, mrktTotAmt=시가총액, lstgStCnt=상장주식수로 알려져 있으나 최초 실행 시 실제 필드를 확인해서 검증할 것.",
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.log(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
