#!/usr/bin/env node
// 출발지 -> 목적지를 자차로 왕복할 때 드는 통행료(톨비)와 기름값을 계산한다.
// 사용법: node check_drive_cost.js "<출발지>" "<목적지>"
//
// 1) Tmap 지오코딩(주소 우선, 실패 시 장소명 POI 검색으로 폴백)으로 두 지점의 좌표를 구한다.
// 2) Tmap 자동차 경로 안내 API(유료도로 포함, 추천 경로)로 편도 거리/통행료를 구한다.
// 3) 경로상의 지점 이름/설명에서 "요금소"/"IC"/"톨게이트" 문자열을 휴리스틱으로 찾아
//    통과 게이트 이름 목록을 만든다 (Tmap이 게이트별 금액을 주지 않으므로 이름만, best-effort).
// 4) 차량 정보(car.json)가 저장돼 있으면 오피넷 전국 평균 유가로 왕복 기름값을 계산한다.
//    없으면 needCarSetup:true로 표시하고 기름값은 생략한다 (거리/톨비는 그대로 반환).

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const CAR_CONFIG_PATH = path.join(REPO_ROOT, ".private", "drive-cost", "car.json");
const SEARCH_OPTION_RECOMMENDED = "0"; // 추천 경로 (유료도로 포함)

function getTmapKey() {
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

function loadCar() {
  if (!fs.existsSync(CAR_CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CAR_CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

async function geocodeByAddress(appKey, address) {
  const url = `https://apis.openapi.sk.com/tmap/geo/fullAddrGeo?version=1&format=json&coordType=WGS84GEO&addressFlag=F00&fullAddr=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { appKey, accept: "application/json" } });
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (json?.error) return null;

  const info = json?.coordinateInfo;
  const match = info?.coordinate?.[0];
  const lon = match?.newLon || match?.lon || info?.newLon || info?.lon;
  const lat = match?.newLat || match?.lat || info?.newLat || info?.lat;

  if (!lon || !lat || Number(lon) === 0 || Number(lat) === 0) return null;
  return { lon: String(lon), lat: String(lat) };
}

async function geocodeByPoi(appKey, keyword) {
  const url = `https://apis.openapi.sk.com/tmap/pois?version=1&searchKeyword=${encodeURIComponent(keyword)}&resCoordType=WGS84GEO&reqCoordType=WGS84GEO&count=1&page=1`;
  const res = await fetch(url, { headers: { appKey, accept: "application/json" } });
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }

  const poi = json?.searchPoiInfo?.pois?.poi?.[0];
  if (!poi) return null;

  const lon = poi.noorLon || poi.frontLon || poi.newLon;
  const lat = poi.noorLat || poi.frontLat || poi.newLat;
  if (!lon || !lat || Number(lon) === 0 || Number(lat) === 0) return null;
  return { lon: String(lon), lat: String(lat) };
}

async function geocode(appKey, place) {
  const byAddress = await geocodeByAddress(appKey, place);
  if (byAddress) return { ...byAddress, method: "address" };

  const byPoi = await geocodeByPoi(appKey, place);
  if (byPoi) return { ...byPoi, method: "poi" };

  throw new Error(`"${place}"의 좌표를 찾지 못했습니다. 정확한 도로명 주소이거나 잘 알려진 장소명(역, 건물명 등)인지 확인해 주세요.`);
}

async function fetchRoute(appKey, origin, destination) {
  const body = {
    startX: origin.lon,
    startY: origin.lat,
    endX: destination.lon,
    endY: destination.lat,
    reqCoordType: "WGS84GEO",
    resCoordType: "WGS84GEO",
    searchOption: SEARCH_OPTION_RECOMMENDED,
    tollgateCarType: "car",
  };

  const res = await fetch("https://apis.openapi.sk.com/tmap/routes?version=1", {
    method: "POST",
    headers: { appKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`경로 응답을 JSON으로 해석할 수 없습니다. 응답 앞부분: ${text.slice(0, 200)}`);
  }
  if (json?.error) {
    throw new Error(`경로 API 오류: ${json.error.code ?? "?"} ${json.error.message ?? "알 수 없는 오류"}`);
  }

  const features = json?.features ?? [];
  const summary = features.map((f) => f.properties).find((p) => p && p.totalDistance != null);
  if (!summary) {
    throw new Error(`경로 응답에서 totalDistance를 찾지 못했습니다. 원본 응답: ${JSON.stringify(json).slice(0, 300)}`);
  }

  const gatePattern = /(요금소|톨게이트|[가-힣A-Za-z0-9]+ ?IC$)/;
  const gates = [];
  for (const f of features) {
    const p = f.properties;
    if (!p) continue;
    for (const text of [p.name, p.description]) {
      if (typeof text !== "string") continue;
      const m = text.match(gatePattern);
      if (m && !gates.includes(m[0])) gates.push(m[0]);
    }
  }

  return {
    totalDistanceM: Number(summary.totalDistance),
    totalTollFareWon: Number(summary.totalFare ?? 0),
    gatesPassed: gates,
  };
}

async function fetchFuelPricePerLiter(fuelType) {
  const certkey = process.env.OPINET_API_KEY;
  if (!certkey) {
    return { price: null, reason: "OPINET_API_KEY 환경변수가 설정되어 있지 않습니다." };
  }

  const res = await fetch(`https://www.opinet.co.kr/api/avgAllPrice.do?out=json&certkey=${encodeURIComponent(certkey)}`);
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { price: null, reason: `오피넷 응답을 JSON으로 해석할 수 없습니다. 응답 앞부분: ${text.slice(0, 200)}` };
  }

  const rows = json?.RESULT?.OIL ?? json?.OIL ?? [];
  const row = rows.find((r) => typeof r.PRODNM === "string" && r.PRODNM.includes(fuelType));
  if (!row) {
    return { price: null, reason: `오피넷 응답에서 "${fuelType}" 유종을 찾지 못했습니다. 원본: ${JSON.stringify(rows).slice(0, 300)}` };
  }

  return { price: Number(row.PRICE), reason: null };
}

async function main() {
  const [originPlace, destPlace] = process.argv.slice(2);
  if (!originPlace || !destPlace) {
    console.error(JSON.stringify({ error: true, message: '사용법: node check_drive_cost.js "<출발지>" "<목적지>"' }));
    process.exit(1);
  }

  const appKey = getTmapKey();
  const [origin, destination] = await Promise.all([
    geocode(appKey, originPlace),
    geocode(appKey, destPlace),
  ]);

  const route = await fetchRoute(appKey, origin, destination);
  const oneWayKm = Math.round((route.totalDistanceM / 1000) * 10) / 10;
  const roundTripKm = Math.round(oneWayKm * 2 * 10) / 10;
  const roundTripTollWon = route.totalTollFareWon * 2;

  const car = loadCar();
  let fuel = null;
  let needCarSetup = false;

  if (!car) {
    needCarSetup = true;
  } else {
    const { price, reason } = await fetchFuelPricePerLiter(car.fuelType);
    if (price == null) {
      fuel = { error: true, message: reason };
    } else {
      const oneWayLiters = oneWayKm / car.fuelEfficiencyKmPerL;
      const roundTripFuelWon = Math.round(oneWayLiters * 2 * price);
      fuel = {
        error: false,
        fuelType: car.fuelType,
        pricePerLiterWon: price,
        fuelEfficiencyKmPerL: car.fuelEfficiencyKmPerL,
        roundTripFuelWon,
      };
    }
  }

  const totalCostWon = fuel && !fuel.error ? roundTripTollWon + fuel.roundTripFuelWon : null;

  console.log(JSON.stringify({
    error: false,
    needCarSetup,
    origin: originPlace,
    destination: destPlace,
    oneWayKm,
    roundTripKm,
    roundTripTollWon,
    tollGatesPassed: route.gatesPassed,
    tollGatesNote: "게이트별 금액은 제공되지 않으며, 통과하는 요금소/IC 이름은 경로 안내 텍스트에서 추출한 참고용(불완전할 수 있음) 목록입니다.",
    fuel,
    totalCostWon,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
