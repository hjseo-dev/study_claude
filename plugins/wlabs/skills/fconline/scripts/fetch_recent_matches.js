#!/usr/bin/env node
// 저장된 FC 온라인 닉네임(ouid)의 최근 경기 목록 + 각 경기 상세 데이터를
// 넥슨 오픈API로 조회해서 raw JSON을 그대로 출력한다.
//
// 이 스크립트는 데이터를 분석/요약하지 않는다. 필드명이 실제 API 응답과
// 다를 수 있으므로, 분석은 이 스크립트를 호출한 쪽(SKILL.md 지침에 따라
// 동작하는 에이전트)이 raw JSON 구조를 직접 확인하며 수행해야 한다.
//
// 사용법: node fetch_recent_matches.js [limit] [matchtype]
//   limit     조회할 최근 경기 수 (기본 10)
//   matchtype 넥슨 매치 타입 코드 (기본 50 = 공식경기)

const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_PATH = path.join(os.homedir(), ".claude", "skill-data", "fconline", "profile.json");
const API_BASE = "https://open.api.nexon.com/fconline/v1";
const DEFAULT_LIMIT = 10;
const DEFAULT_MATCHTYPE = 50; // 공식경기

// 선수 이름 / 포지션 코드 메타데이터. open.api.nexon.com/static/fconline/meta/
// 아래 경로에서 실제 동작 확인됨 (2026-08-29, curl로 직접 검증):
//   spid.json         -> [{ id, name }]           선수 spId -> 이름
//   spposition.json   -> [{ spposition, desc }]   포지션 코드 -> 표준 약어(GK/RB/CDM/ST 등)
//   matchtype.json    -> [{ matchtype, desc }]    매치타입 코드 -> 이름 (50=공식경기 확인됨)
// 예전에 쓰던 static.api.nexon.co.kr 호스트는 이 환경에서 DNS 조회 자체가
// 실패해 항상 spidMeta: null로 빠졌었다. open.api.nexon.com 쪽 /static/...
// 경로가 실제로 동작하는 것으로 확인되어 이걸로 교체한다.
const META_BASE = "https://open.api.nexon.com/static/fconline/meta";
const SPID_META_URL_CANDIDATES = [`${META_BASE}/spid.json`];
const SPPOSITION_META_URL = `${META_BASE}/spposition.json`;

function getApiKey() {
  const key = process.env.FCONLINE_KEY;
  if (!key) {
    console.error(JSON.stringify({
      error: true,
      message: "FCONLINE_KEY 환경변수가 설정되어 있지 않습니다. openapi.nexon.com에서 발급받은 API 키를 FCONLINE_KEY 환경변수에 설정하세요.",
    }));
    process.exit(1);
  }
  return key;
}

function loadProfile() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

async function apiGet(apiKey, url) {
  const res = await fetch(url, { headers: { "x-nxopen-api-key": apiKey, accept: "application/json" } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`API 응답을 JSON으로 해석할 수 없습니다 (${url}). 응답 앞부분: ${text.slice(0, 200)}`);
  }
  if (json?.error) {
    throw new Error(`API 오류 (${url}): ${json.error.name ?? json.error.code ?? "?"} ${json.error.message ?? "알 수 없는 오류"}`);
  }
  return json;
}

async function fetchMatchIds(apiKey, ouid, matchtype, limit) {
  const url = `${API_BASE}/user/match?ouid=${encodeURIComponent(ouid)}&matchtype=${matchtype}&offset=0&limit=${limit}`;
  const json = await apiGet(apiKey, url);
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.matches)) return json.matches;
  throw new Error(`경기 목록 응답 형식을 예상하지 못했습니다. 원본 응답: ${JSON.stringify(json).slice(0, 300)}`);
}

async function fetchMatchDetail(apiKey, matchId) {
  const url = `${API_BASE}/match-detail?matchid=${encodeURIComponent(matchId)}`;
  return apiGet(apiKey, url);
}

async function tryFetchMeta(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json && (Array.isArray(json) || typeof json === "object")) {
      return { source: url, data: json };
    }
  } catch {
    // 실패 시 null 반환 (분석은 원본 코드값만으로도 진행 가능하도록)
  }
  return null;
}

async function tryFetchSpidMeta() {
  for (const url of SPID_META_URL_CANDIDATES) {
    const result = await tryFetchMeta(url);
    if (result) return result;
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [limitArg, matchtypeArg] = process.argv.slice(2);
  const limit = Number(limitArg) > 0 ? Number(limitArg) : DEFAULT_LIMIT;
  const matchtype = Number(matchtypeArg) > 0 ? Number(matchtypeArg) : DEFAULT_MATCHTYPE;

  const profile = loadProfile();
  if (!profile?.ouid) {
    console.log(JSON.stringify({
      error: false,
      needSetup: true,
      message: "FC 온라인 닉네임이 아직 설정되지 않았습니다. 사용자에게 게임 닉네임을 물어본 뒤 set_profile.js로 저장하세요.",
    }));
    return;
  }

  const apiKey = getApiKey();
  const matchIds = await fetchMatchIds(apiKey, profile.ouid, matchtype, limit);

  const matches = [];
  for (const matchId of matchIds) {
    try {
      const detail = await fetchMatchDetail(apiKey, matchId);
      matches.push({ matchId, detail });
    } catch (err) {
      matches.push({ matchId, error: err.message });
    }
    await sleep(150); // 넥슨 오픈API 요청 빈도 제한 대비
  }

  const spidMeta = await tryFetchSpidMeta();
  const sppositionMeta = await tryFetchMeta(SPPOSITION_META_URL);

  console.log(JSON.stringify({
    error: false,
    needSetup: false,
    nickname: profile.nickname,
    ouid: profile.ouid,
    matchType: matchtype,
    requestedCount: limit,
    fetchedCount: matches.length,
    matches,
    spidMeta: spidMeta ? { source: spidMeta.source, data: spidMeta.data } : null,
    sppositionMeta: sppositionMeta ? { source: sppositionMeta.source, data: sppositionMeta.data } : null,
    note: "spidMeta/sppositionMeta는 조회에 성공한 경우에만 채워집니다. spidMeta가 null이면 spId 숫자만으로, sppositionMeta가 null이면 spPosition 숫자만으로 분석하세요. sppositionMeta.data는 [{spposition, desc}] 형태로 spPosition 코드를 GK/RB/CDM/ST 같은 표준 포지션 약어로 매핑합니다 (예: 넥슨 API는 팀당 '포메이션 이름' 필드를 별도로 주지 않으므로, 이 매핑으로 변환한 11명 선발의 spPosition 조합을 보고 포메이션 형태를 직접 판단하세요). 각 match의 detail 필드는 넥슨 API 원본 응답 그대로이므로, 분석 전에 실제 키 구조를 먼저 확인하세요.",
  }));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
