#!/usr/bin/env node
// 독산1동 우산 필요 여부 판단 스크립트.
// 기상청 단기예보 조회서비스 2.0 (apis.data.go.kr/1360000/VilageFcstInfoService_2.0)
// - getUltraSrtNcst (초단기실황): 현재 관측값 (가장 정확, 매시 40분 이후 제공)
// - getUltraSrtFcst (초단기예보): 향후 최대 6시간, 1시간 간격 (매시 45분 이후 제공)
// KMA는 15분 단위 예보를 제공하지 않으므로, "지금 실황"과 "향후 1~2시간 예보"를
// 함께 봐서 가장 가까운 미래의 강수 가능성을 판단하는 방식으로 정확도를 높인다.

const NX = 58; // 독산1동주민센터(37.4702776, 126.8970762) 기준 LCC DFS 격자 변환값
const NY = 125;
const LOCATION_NAME = "서울특별시 금천구 독산1동";

const BASE_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

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
// 이미 인코딩된 키(% 포함)는 그대로 붙이고, 아닌 경우에만 encodeURIComponent 적용해
// 이중 인코딩으로 인한 인증 실패를 방지한다.
function encodeServiceKey(key) {
  return key.includes("%") ? key : encodeURIComponent(key);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// 시스템 타임존과 무관하게 항상 KST(UTC+9) 기준으로 계산한다.
// Date.getTime()은 시스템 타임존과 무관하게 항상 UTC epoch 기준이므로, 여기서
// UTC+9h만 더하고 이후에는 반드시 getUTC*/setUTC* 계열로만 읽고 써야 한다.
// (로컬 get*/set*를 쓰면 시스템 로컬 타임존이 이미 KST인 경우 9시간이 이중으로
// 적용되어 시간이 어긋난다.)
function nowKst() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60000);
}

function fmtDate(d) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

// 초단기실황: 매시 정각 발표, API는 매시 40분부터 제공. 40분 이전이면 전 시각 사용.
function ncstBaseDateTime(kst) {
  const d = new Date(kst.getTime());
  if (d.getUTCMinutes() < 40) {
    d.setUTCHours(d.getUTCHours() - 1);
  }
  d.setUTCMinutes(0, 0, 0);
  return { base_date: fmtDate(d), base_time: `${pad2(d.getUTCHours())}00` };
}

// 초단기예보: 매시 30분 발표, API는 매시 45분부터 제공. 45분 이전이면 전 시각 사용.
function fcstBaseDateTime(kst) {
  const d = new Date(kst.getTime());
  if (d.getUTCMinutes() < 45) {
    d.setUTCHours(d.getUTCHours() - 1);
  }
  d.setUTCMinutes(30, 0, 0);
  return { base_date: fmtDate(d), base_time: `${pad2(d.getUTCHours())}30` };
}

async function callApi(endpoint, params) {
  const key = encodeServiceKey(getServiceKey());
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/${endpoint}?serviceKey=${key}&${qs}`;

  const res = await fetch(url);
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`API 응답을 JSON으로 해석할 수 없습니다 (${endpoint}). 응답 앞부분: ${text.slice(0, 200)}`);
  }

  const header = json?.response?.header;
  if (!header || header.resultCode !== "00") {
    throw new Error(`API 오류 (${endpoint}): ${header?.resultCode ?? "?"} ${header?.resultMsg ?? "알 수 없는 오류"}`);
  }

  const items = json.response.body?.items?.item ?? [];
  return items;
}

async function fetchNcst(kst) {
  const { base_date, base_time } = ncstBaseDateTime(kst);
  const items = await callApi("getUltraSrtNcst", {
    dataType: "JSON",
    numOfRows: 100,
    pageNo: 1,
    base_date,
    base_time,
    nx: NX,
    ny: NY,
  });
  const byCategory = {};
  for (const it of items) byCategory[it.category] = it.obsrValue;
  return { base_date, base_time, values: byCategory };
}

async function fetchFcst(kst) {
  const { base_date, base_time } = fcstBaseDateTime(kst);
  const items = await callApi("getUltraSrtFcst", {
    dataType: "JSON",
    numOfRows: 1000,
    pageNo: 1,
    base_date,
    base_time,
    nx: NX,
    ny: NY,
  });

  // fcstDate+fcstTime별로 category -> value 묶기
  const byTime = new Map();
  for (const it of items) {
    const key = `${it.fcstDate}${it.fcstTime}`;
    if (!byTime.has(key)) byTime.set(key, { fcstDate: it.fcstDate, fcstTime: it.fcstTime, values: {} });
    byTime.get(key).values[it.category] = it.fcstValue;
  }
  return { base_date, base_time, slots: [...byTime.values()].sort((a, b) => (a.fcstDate + a.fcstTime).localeCompare(b.fcstDate + b.fcstTime)) };
}

const PTY_TEXT = {
  "0": "없음",
  "1": "비",
  "2": "비/눈",
  "3": "눈",
  "5": "빗방울",
  "6": "빗방울눈날림",
  "7": "눈날림",
};

function ptyText(code) {
  return PTY_TEXT[String(code)] ?? `알수없음(${code})`;
}

function fmtTime(fcstDate, fcstTime) {
  return `${fcstDate.slice(4, 6)}/${fcstDate.slice(6, 8)} ${fcstTime.slice(0, 2)}:${fcstTime.slice(2, 4)}`;
}

async function main() {
  const kst = nowKst();

  const [ncst, fcst] = await Promise.all([fetchNcst(kst), fetchFcst(kst)]);

  const curPty = ncst.values.PTY ?? "0";
  const curRn1 = ncst.values.RN1 ?? "0";

  // 예보는 현재 시각 기준 가장 가까운 2개 슬롯(대략 향후 1~2시간)만 판단에 사용.
  const upcoming = fcst.slots.slice(0, 2).map((s) => ({
    time: fmtTime(s.fcstDate, s.fcstTime),
    pty: s.values.PTY ?? "0",
    ptyText: ptyText(s.values.PTY ?? "0"),
    pop: s.values.POP ?? null, // 강수확률(%)
    sky: s.values.SKY ?? null,
  }));

  let verdict = "not_needed";
  let reason;

  if (curPty !== "0") {
    verdict = "umbrella_needed";
    reason = `지금(${ncst.base_time.slice(0, 2)}:${ncst.base_time.slice(2, 4)} 관측 기준) ${ptyText(curPty)}이(가) 내리고 있어요.`;
  } else {
    const soonPrecip = upcoming.find((s) => s.pty !== "0");
    const highPop = upcoming.find((s) => s.pop !== null && Number(s.pop) >= 60);
    const midPop = upcoming.find((s) => s.pop !== null && Number(s.pop) >= 30);

    if (soonPrecip) {
      verdict = "umbrella_needed";
      reason = `${soonPrecip.time} 무렵 ${soonPrecip.ptyText} 예보가 있어요 (강수확률 ${soonPrecip.pop ?? "?"}%).`;
    } else if (highPop) {
      verdict = "umbrella_needed";
      reason = `${highPop.time} 강수확률이 ${highPop.pop}%로 높아요.`;
    } else if (midPop) {
      verdict = "maybe";
      reason = `${midPop.time} 강수확률이 ${midPop.pop}%예요. 챙기면 안심이에요.`;
    } else {
      verdict = "not_needed";
      reason = "지금도 비/눈이 없고, 앞으로 1~2시간 안에도 강수 예보가 없어요.";
    }
  }

  console.log(JSON.stringify({
    error: false,
    location: LOCATION_NAME,
    observedAt: `${ncst.base_date} ${ncst.base_time}`,
    current: { pty: curPty, ptyText: ptyText(curPty), rn1_mm: curRn1 },
    upcoming,
    verdict, // "umbrella_needed" | "maybe" | "not_needed"
    reason,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
