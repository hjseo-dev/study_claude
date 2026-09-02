#!/usr/bin/env node
// DART corpCode.xml(전체 법인 고유번호 매핑)을 내려받아, 종목코드(6자리)가
// 있는 상장 법인만 걸러 로컬 캐시로 저장한다. corp_code는 종목코드와 다른
// DART 내부 고유번호이며, 재무제표 조회(fnlttSinglAcntAll.json) 시 필수다.
//
// 캐시가 CACHE_MAX_AGE_DAYS 이내면 재사용하고, 오래됐거나 없으면 다시 받는다.
//
// usage (CLI):
//   node ensure_corp_map.js            -> 캐시 보장 후 요약 출력
//   node ensure_corp_map.js --force    -> 캐시 무시하고 강제 갱신
// usage (require):
//   const { ensureCorpMap, findByCode, findByName } = require("./ensure_corp_map");

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const CACHE_DIR = path.join(os.homedir(), ".claude", "skill-data", "stock-screener");
const CACHE_FILE = path.join(CACHE_DIR, "corp_map_cache.json");
const CACHE_MAX_AGE_DAYS = 7;

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function isCacheFresh() {
  if (!fs.existsSync(CACHE_FILE)) return false;
  const ageDays = (Date.now() - fs.statSync(CACHE_FILE).mtimeMs) / (1000 * 60 * 60 * 24);
  return ageDays < CACHE_MAX_AGE_DAYS;
}

function getApiKey() {
  const key = process.env.DART_API_KEY;
  if (!key) {
    throw new Error("DART_API_KEY 환경변수가 설정되어 있지 않습니다. opendart.fss.or.kr에서 발급 후 등록하세요.");
  }
  return key;
}

async function downloadAndParse(apiKey) {
  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());

  // 정상 응답은 zip 파일이다("PK" 매직바이트). 키 오류 등이면 XML/텍스트
  // 에러 메시지가 오므로 그걸 그대로 노출한다(추측해서 가공하지 않는다).
  const isZip = buf.length > 2 && buf[0] === 0x50 && buf[1] === 0x4b;
  if (!isZip) {
    throw new Error(`corpCode.xml 응답이 zip이 아닙니다(키 오류 가능): ${buf.toString("utf8").slice(0, 300)}`);
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const zipPath = path.join(CACHE_DIR, "_corpCode.zip");
  const extractDir = path.join(CACHE_DIR, "_corpCode_extract");
  fs.writeFileSync(zipPath, buf);
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });

  execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractDir}" -Force`,
  ]);

  const xmlPath = path.join(extractDir, "CORPCODE.xml");
  const xml = fs.readFileSync(xmlPath, "utf8");

  // 실제 응답 구조(2026-09-02 라이브 검증): <corp_name>과 <stock_code> 사이에
  // <corp_eng_name>이 하나 더 있다(공식 문서에 명시 안 됨).
  const entries = [];
  const re = /<list>\s*<corp_code>([^<]*)<\/corp_code>\s*<corp_name>([^<]*)<\/corp_name>\s*<corp_eng_name>[^<]*<\/corp_eng_name>\s*<stock_code>([^<]*)<\/stock_code>\s*<modify_date>([^<]*)<\/modify_date>\s*<\/list>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const stockCode = m[3].trim();
    if (stockCode.length === 6) {
      entries.push({ corp_code: m[1].trim(), corp_name: decodeXmlEntities(m[2].trim()), stock_code: stockCode });
    }
  }

  fs.rmSync(zipPath, { force: true });
  fs.rmSync(extractDir, { recursive: true, force: true });

  const payload = { generatedAt: new Date().toISOString(), count: entries.length, entries };
  fs.writeFileSync(CACHE_FILE, JSON.stringify(payload));
  return payload;
}

async function ensureCorpMap({ force = false } = {}) {
  if (!force && isCacheFresh()) {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  }
  const apiKey = getApiKey();
  return downloadAndParse(apiKey);
}

function findByCode(entries, code) {
  return entries.find((e) => e.stock_code === code) || null;
}

function findByName(entries, name) {
  const needle = name.trim();
  const exact = entries.filter((e) => e.corp_name === needle);
  if (exact.length) return exact;
  return entries.filter((e) => e.corp_name.includes(needle));
}

module.exports = { ensureCorpMap, findByCode, findByName, CACHE_FILE };

if (require.main === module) {
  const force = process.argv.includes("--force");
  ensureCorpMap({ force })
    .then((payload) => {
      console.log(JSON.stringify({ error: false, cachedAt: payload.generatedAt, count: payload.count }, null, 2));
    })
    .catch((err) => {
      console.log(JSON.stringify({ error: true, message: err.message }));
      process.exit(1);
    });
}
