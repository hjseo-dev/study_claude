#!/usr/bin/env node
// 독산1동 오늘 날씨 조회 스크립트.
// 기상청 단기예보 조회서비스 2.0 (apis.data.go.kr/1360000/VilageFcstInfoService_2.0)
// - getVilageFcst: 발표 회차(0200/0500/0800/1100/1400/1700/2000/2300)별 최대 3일치 예보.
//   오늘의 TMN(최저기온)은 0200 회차에만, TMX(최고기온)는 0500 회차에만 포함되므로
//   현재 시각/하늘상태/강수확률과는 별도로 각각 조회해야 한다. 자세한 내용은
//   references/api-fields.md 참고.

const NX = 58; // 독산1동주민센터(37.4702776, 126.8970762) 기준 LCC DFS 격자값 (umbrella와 동일)
const NY = 125;
const LOCATION_NAME = "서울특별시 금천구 독산1동";

const BASE_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
const ANNOUNCE_HOURS = [23, 20, 17, 14, 11, 8, 5, 2]; // 내림차순, 발표 후 10분부터 제공

function getServiceKey() {
  const raw = process.env.KMA_API_KEY;
  if (!raw) {
    console.error(JSON.stringify({
      error: true,
      message: "KMA_API_KEY 환경변수가 설정되어 있지 않습니다. 공공데이터포털(data.go.kr)에서 '기상청_단기예보 조회서비스' 활용신청 후 발급받은 인증키를 KMA_API_KEY 환경변수에 설정하세요.",
    }));
    process.exit(1);
  }
  return raw;
}

// data.go.kr 인증키는 이미 URL 인코딩된 형태로 발급되는 경우가 많다.
function encodeServiceKey(key) {
  return key.includes("%") ? key : encodeURIComponent(key);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// 시스템 타임존과 무관하게 항상 KST(UTC+9) 기준으로 계산 (umbrella와 동일 방식).
function nowKst() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60000);
}

function fmtDate(d) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function addHours(d, h) {
  return new Date(d.getTime() + h * 60 * 60000);
}

// 가장 최근에 이미 발표된(10분 유예 포함) 회차의 base_date/base_time을 구한다.
function latestBaseDateTime(kst) {
  for (const h of ANNOUNCE_HOURS) {
    const candidate = new Date(kst.getTime());
    candidate.setUTCHours(h, 10, 0, 0); // 발표 후 10분부터 제공
    if (kst >= candidate) {
      return { base_date: fmtDate(kst), base_time: `${pad2(h)}00` };
    }
  }
  // 오늘 02:10 이전이면 전날 23시 회차를 쓴다.
  const yesterday = addHours(kst, -24);
  return { base_date: fmtDate(yesterday), base_time: "2300" };
}

// 오늘 날짜의 특정 회차(hour)가 이미 발표됐으면 그 base_date/base_time을, 아직이면 null을 반환.
function todaysAnnouncedTime(kst, hour) {
  const candidate = new Date(kst.getTime());
  candidate.setUTCHours(hour, 10, 0, 0);
  if (kst >= candidate) {
    return { base_date: fmtDate(kst), base_time: `${pad2(hour)}00` };
  }
  return null;
}

async function callApi(params) {
  const key = encodeServiceKey(getServiceKey());
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/getVilageFcst?serviceKey=${key}&${qs}`;

  const res = await fetch(url);
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`API 응답을 JSON으로 해석할 수 없습니다. 응답 앞부분: ${text.slice(0, 200)}`);
  }

  const header = json?.response?.header;
  if (!header || header.resultCode !== "00") {
    throw new Error(`API 오류: ${header?.resultCode ?? "?"} ${header?.resultMsg ?? "알 수 없는 오류"}`);
  }

  return json.response.body?.items?.item ?? [];
}

async function fetchVilageFcst(base_date, base_time) {
  return callApi({
    dataType: "JSON",
    numOfRows: 1000,
    pageNo: 1,
    base_date,
    base_time,
    nx: NX,
    ny: NY,
  });
}

const SKY_TEXT = { "1": "맑음", "3": "구름많음", "4": "흐림" };
const PTY_TEXT = {
  "0": "없음", "1": "비", "2": "비/눈", "3": "눈",
  "4": "소나기", "5": "빗방울", "6": "빗방울눈날림", "7": "눈날림",
};

async function main() {
  const kst = nowKst();
  const todayDate = fmtDate(kst);

  const latest = latestBaseDateTime(kst);
  const items = await fetchVilageFcst(latest.base_date, latest.base_time);

  // 오늘 날짜 + 현재 시각에 가장 가까운(다음) 시간대 슬롯을 고른다.
  const todayItems = items.filter((it) => it.fcstDate === todayDate);
  const byTime = new Map();
  for (const it of todayItems) {
    if (!byTime.has(it.fcstTime)) byTime.set(it.fcstTime, {});
    byTime.get(it.fcstTime)[it.category] = it.fcstValue;
  }
  const currentHour = `${pad2(kst.getUTCHours())}00`;
  const sortedTimes = [...byTime.keys()].sort();
  // 자정 임박 시각에는 최신 발표 회차(예: 23시)가 이미 다음날 시간대만 담고 있어
  // 오늘 날짜에 남은 시간대가 하나도 없을 수 있다. 이 경우 current를 null로 명시한다.
  const todayForecastEnded = sortedTimes.length === 0;
  const nearestTime = sortedTimes.find((t) => t >= currentHour) ?? sortedTimes[0];
  const current = nearestTime ? byTime.get(nearestTime) : {};

  // TMN(오늘 최저, 0200 회차 전용)
  let tmn = null;
  const tmnSlot = todaysAnnouncedTime(kst, 2);
  if (tmnSlot) {
    const tmnItems = tmnSlot.base_time === latest.base_time && tmnSlot.base_date === latest.base_date
      ? items
      : await fetchVilageFcst(tmnSlot.base_date, tmnSlot.base_time);
    const found = tmnItems.find((it) => it.category === "TMN" && it.fcstDate === todayDate);
    if (found) tmn = found.fcstValue;
  }

  // TMX(오늘 최고, 0500 회차 전용)
  let tmx = null;
  const tmxSlot = todaysAnnouncedTime(kst, 5);
  if (tmxSlot) {
    const tmxItems = tmxSlot.base_time === latest.base_time && tmxSlot.base_date === latest.base_date
      ? items
      : await fetchVilageFcst(tmxSlot.base_date, tmxSlot.base_time);
    const found = tmxItems.find((it) => it.category === "TMX" && it.fcstDate === todayDate);
    if (found) tmx = found.fcstValue;
  }

  console.log(JSON.stringify({
    error: false,
    location: LOCATION_NAME,
    announcedAt: `${latest.base_date} ${latest.base_time}`,
    todayForecastEnded, // true면 오늘 남은 시간대 예보가 없음(자정 임박) — current는 null
    current: todayForecastEnded ? null : {
      time: nearestTime,
      tmp: current.TMP ?? null,
      sky: current.SKY ?? null,
      skyText: SKY_TEXT[current.SKY] ?? null,
      pty: current.PTY ?? "0",
      ptyText: PTY_TEXT[current.PTY ?? "0"],
      pop: current.POP ?? null,
      reh: current.REH ?? null,
      wsd: current.WSD ?? null,
    },
    todayLow: tmn, // null이면 "아직 발표 전"
    todayHigh: tmx, // null이면 "아직 발표 전"
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  // process.exit(1)로 즉시 강제 종료하면 아직 정리 중인 fetch 소켓 핸들과 충돌해
  // Windows에서 libuv assertion 크래시가 날 수 있다. exitCode만 지정하고 이벤트
  // 루프가 자연스럽게 비워지도록 둔다.
  process.exitCode = 1;
});
