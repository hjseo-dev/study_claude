#!/usr/bin/env node
// 자취방 -> 본가 자차 이동 시간을, 지금부터 30/60/90분 뒤 출발하는 경우 각각
// 예측해서 알려준다. 무료도로 우선(톨게이트 회피) 옵션으로 조회한다.
// Tmap(SK 오픈API) 미래예측(타임머신) 자동차 길 안내 API 사용.
//
// 주소는 이 스크립트가 직접 묻지 않는다. set_locations.js로 미리 저장된
// 리포 밖 로컬 설정 파일(사용자 홈 디렉터리)을 읽기만 한다. 설정이 없으면
// needSetup:true를 반환하니, 호출한 쪽(SKILL.md 지침)이 주소를 물어보고
// set_locations.js를 먼저 실행한 뒤 이 스크립트를 다시 실행해야 한다.

const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_PATH = path.join(os.homedir(), ".claude", "skill-data", "home-eta", "locations.json");
const DEPART_OFFSETS_MIN = [0, 30, 60, 90];
const SEARCH_OPTION_FREE_ROAD = "01"; // 교통최적 + 무료우선(톨게이트 회피)

function getAppKey() {
  const key = process.env.TMAP_API_KEY;
  if (!key) {
    console.error(JSON.stringify({
      error: true,
      message: "TMAP_API_KEY 환경변수가 설정되어 있지 않습니다. openapi.sk.com에서 가입 후 발급받은 appKey를 TMAP_API_KEY 환경변수에 설정하세요.",
    }));
    process.exit(1);
  }
  return key;
}

function loadLocations() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// 시스템 타임존과 무관하게 항상 KST(UTC+9) 기준으로 계산한다.
function nowKst() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60000);
}

function fmtHM(d) {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

// predictionTime에 넣을 ISO-8601(+0900) 문자열. d는 nowKst() 기준(UTC 필드에 KST 값이 들어있음).
function fmtIso(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+0900`;
}

async function predictRoute(appKey, origin, destination, departAtKst) {
  const body = {
    routesInfo: {
      departure: { name: "출발지", lon: origin.lon, lat: origin.lat },
      destination: { name: "도착지", lon: destination.lon, lat: destination.lat },
      predictionType: "departure",
      predictionTime: fmtIso(departAtKst),
      searchOption: SEARCH_OPTION_FREE_ROAD,
      tollgateCarType: "car",
    },
  };

  const res = await fetch("https://apis.openapi.sk.com/tmap/routes/prediction?version=1", {
    method: "POST",
    headers: { appKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`미래예측 경로 응답을 JSON으로 해석할 수 없습니다. 응답 앞부분: ${text.slice(0, 200)}`);
  }

  if (json?.error) {
    throw new Error(`미래예측 경로 API 오류: ${json.error.code ?? "?"} ${json.error.message ?? "알 수 없는 오류"}`);
  }

  const features = json?.features ?? [];
  const summary = features.map((f) => f.properties).find((p) => p && p.totalTime != null);

  if (!summary) {
    throw new Error(`미래예측 경로 응답에서 totalTime을 찾지 못했습니다. 원본 응답: ${JSON.stringify(json).slice(0, 300)}`);
  }

  return { totalTimeSec: Number(summary.totalTime), totalDistanceM: Number(summary.totalDistance ?? 0) };
}

async function main() {
  const locations = loadLocations();
  if (!locations) {
    console.log(JSON.stringify({
      error: false,
      needSetup: true,
      message: "자취방/본가 주소가 아직 설정되지 않았습니다. 사용자에게 두 주소를 물어본 뒤 set_locations.js로 저장하세요.",
    }));
    return;
  }

  const appKey = getAppKey();
  const { origin, destination } = locations;
  const kst = nowKst();

  const results = [];
  for (const offsetMin of DEPART_OFFSETS_MIN) {
    const departAt = new Date(kst.getTime() + offsetMin * 60000);
    const { totalTimeSec, totalDistanceM } = await predictRoute(appKey, origin, destination, departAt);
    const durationMin = Math.round(totalTimeSec / 60);
    const arriveAt = new Date(departAt.getTime() + totalTimeSec * 1000);

    results.push({
      departAfterMin: offsetMin,
      departAt: fmtHM(departAt),
      arriveEta: fmtHM(arriveAt),
      durationMin,
      distanceKm: Math.round((totalDistanceM / 1000) * 10) / 10,
    });
  }

  console.log(JSON.stringify({
    error: false,
    needSetup: false,
    origin: origin.address,
    destination: destination.address,
    searchOption: "무료도로 우선(톨게이트 회피)",
    results,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
