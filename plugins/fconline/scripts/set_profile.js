#!/usr/bin/env node
// FC 온라인 닉네임을 넥슨 오픈API로 ouid(계정 식별자)로 변환해서 저장한다.
// 사용법: node set_profile.js "<닉네임>"
//
// 저장 위치를 리포 밖(os.homedir())에 두는 이유: 이 플러그인은 GitHub에 올라가는
// 리포지토리 안에 있으므로, 게임 닉네임 같은 개인정보는 절대 리포 안 파일에 쓰면 안 된다.

const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".claude", "skill-data", "fconline");
const CONFIG_PATH = path.join(CONFIG_DIR, "profile.json");
const API_BASE = "https://open.api.nexon.com/fconline/v1";

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

async function resolveOuid(apiKey, nickname) {
  const url = `${API_BASE}/id?nickname=${encodeURIComponent(nickname)}`;
  const res = await fetch(url, { headers: { "x-nxopen-api-key": apiKey, accept: "application/json" } });
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`닉네임 조회 응답을 JSON으로 해석할 수 없습니다 ("${nickname}"). 응답 앞부분: ${text.slice(0, 200)}`);
  }

  if (json?.error) {
    throw new Error(`닉네임 조회 오류 ("${nickname}"): ${json.error.name ?? json.error.code ?? "?"} ${json.error.message ?? "알 수 없는 오류"}`);
  }
  if (!json?.ouid) {
    throw new Error(`"${nickname}" 닉네임으로 ouid를 찾지 못했습니다. 닉네임 철자를 확인해주세요. 원본 응답: ${JSON.stringify(json).slice(0, 300)}`);
  }

  return json.ouid;
}

async function main() {
  const [nickname] = process.argv.slice(2);
  if (!nickname) {
    console.error(JSON.stringify({ error: true, message: '사용법: node set_profile.js "<닉네임>"' }));
    process.exit(1);
  }

  const apiKey = getApiKey();
  const ouid = await resolveOuid(apiKey, nickname);

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ nickname, ouid }, null, 2), "utf-8");

  console.log(JSON.stringify({ error: false, saved: true, path: CONFIG_PATH, nickname, ouid }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exit(1);
});
