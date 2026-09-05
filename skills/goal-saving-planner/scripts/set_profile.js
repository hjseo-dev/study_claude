#!/usr/bin/env node
// 월급 · 고정비 · 기존 진행 중인 저축상품 정보를 저장한다.
// 사용법: node set_profile.js <입력JSON파일경로>
//
// 리포 루트의 .private/(← .gitignore로 커밋 제외)에 저장하는 이유: 이 플러그인은
// GitHub에 공개되는 리포지토리 안에 있으므로, 월급/고정비 같은 개인 재무정보가
// 실수로도 커밋/push되면 안 된다.

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const CONFIG_DIR = path.join(REPO_ROOT, ".private", "goal-saving-planner");
const CONFIG_PATH = path.join(CONFIG_DIR, "profile.json");

const FIXED_COST_KEYS = ["고정비", "즉시지출", "생활비", "부가세모으기"];

function fail(message) {
  console.error(JSON.stringify({ error: true, message }));
  process.exit(1);
}

function validateSavingItem(item, idx) {
  const label = `existingSavings[${idx}]`;
  if (!item || typeof item !== "object") fail(`${label}가 객체가 아닙니다.`);
  if (typeof item.name !== "string" || !item.name) fail(`${label}.name이 필요합니다.`);
  if (item.kind !== "lumpsum" && item.kind !== "installment") {
    fail(`${label}.kind는 'lumpsum' 또는 'installment'여야 합니다.`);
  }
  if (item.kind === "lumpsum" && !(Number.isFinite(item.principal) && item.principal > 0)) {
    fail(`${label}.principal(양수)이 필요합니다 (거치식).`);
  }
  if (item.kind === "installment" && !(Number.isFinite(item.monthlyAmount) && item.monthlyAmount > 0)) {
    fail(`${label}.monthlyAmount(양수)이 필요합니다 (적립식).`);
  }
  if (!(Number.isFinite(item.annualRatePercent) && item.annualRatePercent >= 0)) {
    fail(`${label}.annualRatePercent(0 이상)이 필요합니다.`);
  }
  if (!(Number.isInteger(item.termMonths) && item.termMonths > 0)) {
    fail(`${label}.termMonths(1 이상 정수, 남은 개월수)가 필요합니다.`);
  }
  if (item.compounding !== "simple" && item.compounding !== "compound") {
    fail(`${label}.compounding은 'simple' 또는 'compound'여야 합니다.`);
  }
}

function main() {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath) fail("사용법: node set_profile.js <입력JSON파일경로>");

  let input;
  try {
    input = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  } catch (err) {
    fail(`입력 JSON을 읽을 수 없습니다 (${inputPath}): ${err.message}`);
  }

  if (!(Number.isFinite(input.salary) && input.salary > 0)) {
    fail("salary(양수)가 필요합니다.");
  }
  if (!input.fixedCosts || typeof input.fixedCosts !== "object") {
    fail("fixedCosts 객체가 필요합니다.");
  }
  for (const key of FIXED_COST_KEYS) {
    if (!(Number.isFinite(input.fixedCosts[key]) && input.fixedCosts[key] >= 0)) {
      fail(`fixedCosts.${key}(0 이상)가 필요합니다.`);
    }
  }
  const existingSavings = Array.isArray(input.existingSavings) ? input.existingSavings : [];
  existingSavings.forEach(validateSavingItem);

  const profile = {
    salary: input.salary,
    fixedCosts: {
      고정비: input.fixedCosts.고정비,
      즉시지출: input.fixedCosts.즉시지출,
      생활비: input.fixedCosts.생활비,
      부가세모으기: input.fixedCosts.부가세모으기,
    },
    existingSavings,
    savedAt: new Date().toISOString(),
  };

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(profile, null, 2), "utf-8");

  console.log(JSON.stringify({ error: false, saved: true, path: CONFIG_PATH, profile }, null, 2));
}

main();
