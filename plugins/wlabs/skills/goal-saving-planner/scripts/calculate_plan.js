#!/usr/bin/env node
// 저장된 프로필(월급/고정비/기존저축)과 이번 실행의 목표/신규배분 입력을 합쳐
// 카드값 한도와 30년 자산 시뮬레이션을 계산한다.
// 사용법: node calculate_plan.js <입력JSON파일경로>
// 공식 근거: ../references/formula.md

const fs = require("fs");
const path = require("path");
const { simulateProduct, toYearlySnapshots, requiredMonthlySaving } = require("./lib/finance");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const CONFIG_DIR = path.join(REPO_ROOT, ".private", "goal-saving-planner");
const CONFIG_PATH = path.join(CONFIG_DIR, "profile.json");

const HORIZON_MONTHS = 360; // 30년
const HORIZON_YEARS = 30;
const EXAMPLE_RATE_PERCENT = 3.3;

function fail(message) {
  console.error(JSON.stringify({ error: true, message }));
  process.exit(1);
}

function validateAllocation(item, idx, label) {
  const tag = `${label}[${idx}]`;
  if (!item || typeof item !== "object") fail(`${tag}가 객체가 아닙니다.`);
  if (typeof item.name !== "string" || !item.name) fail(`${tag}.name이 필요합니다.`);
  if (item.kind !== "lumpsum" && item.kind !== "installment") {
    fail(`${tag}.kind는 'lumpsum' 또는 'installment'여야 합니다.`);
  }
  if (item.kind === "lumpsum" && !(Number.isFinite(item.principal) && item.principal > 0)) {
    fail(`${tag}.principal(양수)이 필요합니다 (거치식).`);
  }
  if (item.kind === "installment" && !(Number.isFinite(item.monthlyAmount) && item.monthlyAmount > 0)) {
    fail(`${tag}.monthlyAmount(양수)이 필요합니다 (적립식).`);
  }
  if (!(Number.isFinite(item.annualRatePercent) && item.annualRatePercent >= 0)) {
    fail(`${tag}.annualRatePercent(0 이상)이 필요합니다.`);
  }
  if (!(Number.isInteger(item.termMonths) && item.termMonths > 0 && item.termMonths <= HORIZON_MONTHS)) {
    fail(`${tag}.termMonths는 1~${HORIZON_MONTHS} 사이 정수여야 합니다 (계속 적립하려면 ${HORIZON_MONTHS}).`);
  }
  if (item.compounding !== "simple" && item.compounding !== "compound") {
    fail(`${tag}.compounding은 'simple' 또는 'compound'여야 합니다.`);
  }
}

function simulateItem(item) {
  const monthly = simulateProduct({
    kind: item.kind,
    principal: item.principal || 0,
    monthlyAmount: item.monthlyAmount || 0,
    annualRatePercent: item.annualRatePercent,
    termMonths: item.termMonths,
    compounding: item.compounding,
    horizonMonths: HORIZON_MONTHS,
    rolloverTo: item.rolloverTo,
  });
  return { name: item.name, yearly: toYearlySnapshots(monthly, HORIZON_YEARS) };
}

function main() {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath) fail("사용법: node calculate_plan.js <입력JSON파일경로>");

  if (!fs.existsSync(CONFIG_PATH)) {
    console.log(JSON.stringify({ error: false, needSetup: true, message: "저장된 프로필이 없습니다. set_profile.js로 먼저 저장하세요." }));
    return;
  }

  const profile = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

  let input;
  try {
    input = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  } catch (err) {
    fail(`입력 JSON을 읽을 수 없습니다 (${inputPath}): ${err.message}`);
  }

  if (!(Number.isFinite(input.goalAmount) && input.goalAmount > 0)) fail("goalAmount(양수)가 필요합니다.");
  if (!(Number.isFinite(input.goalYears) && input.goalYears > 0)) fail("goalYears(양수)가 필요합니다.");
  const newAllocations = Array.isArray(input.newAllocations) ? input.newAllocations : [];
  newAllocations.forEach((item, idx) => validateAllocation(item, idx, "newAllocations"));

  const fixedCostsSum = Object.values(profile.fixedCosts).reduce((a, b) => a + b, 0);
  const existingMonthlyOutflow = profile.existingSavings
    .filter((s) => s.kind === "installment" && !s.excludeFromOutflow)
    .reduce((sum, s) => sum + s.monthlyAmount, 0);

  const disposableIncome = profile.salary - fixedCostsSum - existingMonthlyOutflow;
  const reqMonthly = requiredMonthlySaving(input.goalAmount, input.goalYears);
  const cardLimit = disposableIncome - reqMonthly;

  const existingProjections = profile.existingSavings.map(simulateItem);
  const newProjections = newAllocations.map(simulateItem);

  const totalAssetByYear = [];
  for (let y = 0; y <= HORIZON_YEARS; y++) {
    const total = [...existingProjections, ...newProjections].reduce(
      (sum, p) => sum + p.yearly[y].balance,
      0
    );
    totalAssetByYear.push({ year: y, balance: total });
  }

  const exampleTermMonths = Math.min(Math.round(input.goalYears * 12), HORIZON_MONTHS);
  const exampleScenario = simulateItem({
    name: `예시: 목표저축액 전액을 연 ${EXAMPLE_RATE_PERCENT}% 적금에 넣었을 때`,
    kind: "installment",
    monthlyAmount: reqMonthly,
    annualRatePercent: EXAMPLE_RATE_PERCENT,
    termMonths: exampleTermMonths,
    compounding: "simple",
  });

  const newAllocationsMonthlySum = newAllocations
    .filter((a) => a.kind === "installment")
    .reduce((sum, a) => sum + a.monthlyAmount, 0);
  const warnings = [];
  if (newAllocations.length > 0 && Math.abs(newAllocationsMonthlySum - reqMonthly) > 1000) {
    warnings.push(
      `신규 배분(월적립 합계 ${newAllocationsMonthlySum.toLocaleString()}원)이 목표달성 필요 월저축액(${reqMonthly.toLocaleString()}원)과 차이가 있습니다.`
    );
  }

  console.log(
    JSON.stringify(
      {
        error: false,
        needSetup: false,
        input: {
          salary: profile.salary,
          fixedCosts: profile.fixedCosts,
          fixedCostsSum,
          existingMonthlyOutflow,
          goalAmount: input.goalAmount,
          goalYears: input.goalYears,
        },
        disposableIncome,
        requiredMonthlySaving: reqMonthly,
        cardLimit,
        warnings,
        existingSavingsProjection: existingProjections,
        newAllocationsProjection: newProjections,
        totalAssetByYear,
        exampleScenario: { ratePercent: EXAMPLE_RATE_PERCENT, ...exampleScenario },
      },
      null,
      2
    )
  );
}

main();
