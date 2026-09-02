#!/usr/bin/env node
// 관심종목 리스트를 로컬(리포 밖)에 저장한다.
//
// usage:
//   node set_watchlist.js "삼성전자,005930" "SK하이닉스,000660"
//   node set_watchlist.js --show
//   node set_watchlist.js --clear

const fs = require("fs");
const path = require("path");
const os = require("os");

const DATA_DIR = path.join(os.homedir(), ".claude", "skill-data", "stock-screener");
const WATCHLIST_FILE = path.join(DATA_DIR, "watchlist.json");

function loadWatchlist() {
  if (!fs.existsSync(WATCHLIST_FILE)) return [];
  return JSON.parse(fs.readFileSync(WATCHLIST_FILE, "utf8"));
}

function saveWatchlist(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(list, null, 2));
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--show")) {
    console.log(JSON.stringify({ error: false, watchlist: loadWatchlist() }, null, 2));
    return;
  }
  if (args.includes("--clear")) {
    saveWatchlist([]);
    console.log(JSON.stringify({ error: false, message: "관심종목을 모두 삭제했습니다.", watchlist: [] }, null, 2));
    return;
  }
  if (args.length === 0) {
    console.log(JSON.stringify({ error: true, message: '인자가 필요합니다. 예: node set_watchlist.js "삼성전자,005930"' }));
    process.exit(1);
  }

  const existing = loadWatchlist();
  const byCode = new Map(existing.map((e) => [e.code, e]));

  for (const arg of args) {
    const parts = arg.split(",").map((s) => s.trim());
    const namePart = parts[0];
    const codePart = parts[1];
    if (!namePart || !codePart || !/^\d{6}$/.test(codePart)) {
      console.log(JSON.stringify({ error: true, message: `형식이 잘못됐습니다: "${arg}" (예: "삼성전자,005930")` }));
      process.exit(1);
    }
    byCode.set(codePart, { name: namePart, code: codePart });
  }

  const merged = Array.from(byCode.values());
  saveWatchlist(merged);
  console.log(JSON.stringify({ error: false, watchlist: merged }, null, 2));
}

main();
