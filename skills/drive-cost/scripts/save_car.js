#!/usr/bin/env node
// 사용자의 차량 정보(모델명, 복합연비, 유종)를 리포지토리 밖(사용자 홈 디렉터리)의
// 로컬 파일에 저장한다. lookup_fuel_efficiency.js가 돌려준 원본 응답을 Claude가
// 해석해 확정한 값을 인자로 받아 그대로 저장하기만 한다 (이 스크립트는 연비 API를
// 다시 호출하거나 값을 검증하지 않음).
//
// 사용법: node save_car.js "<차종>" "<연비 km/L>" "<유종: 휘발유|경유|LPG>"

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const CONFIG_DIR = path.join(REPO_ROOT, ".private", "drive-cost");
const CONFIG_PATH = path.join(CONFIG_DIR, "car.json");

function main() {
  const [model, effRaw, fuelType] = process.argv.slice(2);
  if (!model || !effRaw || !fuelType) {
    console.error(JSON.stringify({ error: true, message: '사용법: node save_car.js "<차종>" "<연비 km/L>" "<유종: 휘발유|경유|LPG>"' }));
    process.exit(1);
  }

  const fuelEfficiencyKmPerL = Number(effRaw);
  if (!Number.isFinite(fuelEfficiencyKmPerL) || fuelEfficiencyKmPerL <= 0) {
    console.error(JSON.stringify({ error: true, message: `연비 값이 올바르지 않습니다: "${effRaw}"` }));
    process.exit(1);
  }

  const car = {
    model,
    fuelEfficiencyKmPerL,
    fuelType,
    savedAt: new Date().toISOString(),
  };

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(car, null, 2), "utf-8");

  console.log(JSON.stringify({ error: false, saved: true, path: CONFIG_PATH, car }, null, 2));
}

main();
