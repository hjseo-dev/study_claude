#!/usr/bin/env node
// 자취방/본가 주소를 지오코딩해서 리포지토리 밖(사용자 홈 디렉터리)의 로컬 파일에 저장한다.
// 사용법: node set_locations.js "<자취방 주소>" "<본가 주소>"
//
// 저장 위치를 리포 밖(os.homedir())에 두는 이유: 이 플러그인은 GitHub에 올라가는
// 리포지토리 안에 있으므로, 주소 같은 개인정보는 절대 리포 안 파일에 쓰면 안 된다.

const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".claude", "skill-data", "home-eta");
const CONFIG_PATH = path.join(CONFIG_DIR, "locations.json");

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

async function geocode(appKey, address) {
  const url = `https://apis.openapi.sk.com/tmap/geo/fullAddrGeo?version=1&format=json&coordType=WGS84GEO&addressFlag=F00&fullAddr=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { appKey, accept: "application/json" } });
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`지오코딩 응답을 JSON으로 해석할 수 없습니다 ("${address}"). 응답 앞부분: ${text.slice(0, 200)}`);
  }

  if (json?.error) {
    throw new Error(`지오코딩 오류 ("${address}"): ${json.error.code ?? "?"} ${json.error.message ?? "알 수 없는 오류"}`);
  }

  const info = json?.coordinateInfo;
  const match = info?.coordinate?.[0];

  const lon = match?.newLon || match?.lon || info?.newLon || info?.lon;
  const lat = match?.newLat || match?.lat || info?.newLat || info?.lat;

  if (!lon || !lat || Number(lon) === 0 || Number(lat) === 0) {
    throw new Error(`"${address}" 주소로 좌표를 찾지 못했습니다. 더 구체적인 주소(도로명 또는 지번, 동/호수 제외)로 다시 시도해 주세요. 원본 응답: ${JSON.stringify(json).slice(0, 300)}`);
  }

  return { address, lon: String(lon), lat: String(lat) };
}

async function main() {
  const [originAddr, destAddr] = process.argv.slice(2);
  if (!originAddr || !destAddr) {
    console.error(JSON.stringify({ error: true, message: "사용법: node set_locations.js \"<자취방 주소>\" \"<본가 주소>\"" }));
    process.exit(1);
  }

  const appKey = getAppKey();
  const [origin, destination] = await Promise.all([
    geocode(appKey, originAddr),
    geocode(appKey, destAddr),
  ]);

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ origin, destination }, null, 2), "utf-8");

  console.log(JSON.stringify({ error: false, saved: true, path: CONFIG_PATH, origin, destination }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
