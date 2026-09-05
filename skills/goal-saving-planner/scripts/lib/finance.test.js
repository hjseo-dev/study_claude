"use strict";
// node --test scripts/lib/finance.test.js 로 실행한다 (외부 의존성 없음, Node 내장 테스트러너).
// 각 케이스는 finance.js의 반복 시뮬레이션과, 그와 독립적으로 유도한 닫힌 형태(closed-form)
// 공식을 서로 대조하는 방식으로 검증한다 — references/formula.md 공식 그대로 재유도한 것.

const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateProduct, toYearlySnapshots, requiredMonthlySaving } = require("./finance");

test("거치식 단리: 경과기간 비례 이자가 정확히 계산된다", () => {
  const balances = simulateProduct({
    kind: "lumpsum",
    principal: 10_000_000,
    annualRatePercent: 3,
    termMonths: 360,
    compounding: "simple",
    horizonMonths: 12,
  });
  // 10,000,000 * (1 + 0.03 * 12/12) = 10,300,000
  assert.equal(balances[12], 10_300_000);
});

test("거치식 복리: 월복리 공식과 일치한다", () => {
  const principal = 10_000_000;
  const rate = 3;
  const balances = simulateProduct({
    kind: "lumpsum",
    principal,
    annualRatePercent: rate,
    termMonths: 360,
    compounding: "compound",
    horizonMonths: 12,
  });
  const expected = principal * Math.pow(1 + rate / 100 / 12, 12);
  assert.ok(Math.abs(balances[12] - expected) <= 1, `${balances[12]} vs ${expected}`);
});

test("적립식 단리(표준 적금): 회차별 단리이자 합산과 일치한다", () => {
  const monthlyAmount = 100_000;
  const rate = 6;
  const termMonths = 12;
  const balances = simulateProduct({
    kind: "installment",
    monthlyAmount,
    annualRatePercent: rate,
    termMonths,
    compounding: "simple",
    horizonMonths: 12,
  });

  let expected = 0;
  for (let k = 1; k <= termMonths; k++) {
    const elapsed = 12 - k + 1;
    expected += monthlyAmount * (1 + (rate / 100) * (elapsed / 12));
  }
  assert.ok(Math.abs(balances[12] - expected) <= termMonths, `${balances[12]} vs ${expected}`);
});

test("적립식 복리: 연금(annuity-due) 미래가치 공식과 일치한다", () => {
  const monthlyAmount = 100_000;
  const rate = 6;
  const balances = simulateProduct({
    kind: "installment",
    monthlyAmount,
    annualRatePercent: rate,
    termMonths: 360,
    compounding: "compound",
    horizonMonths: 12,
  });

  const r = rate / 100 / 12;
  const n = 12;
  const expected = monthlyAmount * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  assert.ok(Math.abs(balances[12] - expected) <= 1, `${balances[12]} vs ${expected}`);
});

test("만기 재예치: 이자율 0%면 재예치를 거쳐도 원금이 그대로 유지된다", () => {
  const balances = simulateProduct({
    kind: "lumpsum",
    principal: 500_000,
    annualRatePercent: 0,
    termMonths: 6,
    compounding: "compound",
    horizonMonths: 18,
  });
  assert.equal(balances[6], 500_000);
  assert.equal(balances[12], 500_000);
  assert.equal(balances[18], 500_000);
});

test("만기 재예치: 두 번째 사이클도 같은 복리 공식이 이어서 적용된다", () => {
  const principal = 1_000_000;
  const rate = 12; // 월이율 1%로 계산이 깔끔한 값
  const balances = simulateProduct({
    kind: "lumpsum",
    principal,
    annualRatePercent: rate,
    termMonths: 12,
    compounding: "compound",
    horizonMonths: 24,
  });

  const monthlyRate = rate / 100 / 12;
  const after12 = principal * Math.pow(1 + monthlyRate, 12);
  const after24 = after12 * Math.pow(1 + monthlyRate, 12); // 재예치 후 같은 조건으로 12개월 더
  assert.ok(Math.abs(balances[12] - after12) <= 1, `${balances[12]} vs ${after12}`);
  assert.ok(Math.abs(balances[24] - after24) <= 1, `${balances[24]} vs ${after24}`);
});

test("rolloverTo: 만기 후 다른 조건(예: QQQ 수익률)으로 재예치된다", () => {
  const principal = 1_000_000;
  const originalRate = 5;
  const termMonths = 12;
  const rolloverRate = 10;

  const balances = simulateProduct({
    kind: "lumpsum",
    principal,
    annualRatePercent: originalRate,
    termMonths,
    compounding: "simple",
    horizonMonths: 24,
    rolloverTo: { annualRatePercent: rolloverRate, compounding: "compound" },
  });

  // 12개월까지는 원래 조건(단리 5%)
  const maturityValue = principal * (1 + (originalRate / 100) * (termMonths / 12));
  assert.ok(Math.abs(balances[12] - maturityValue) <= 1, `${balances[12]} vs ${maturityValue}`);

  // 이후 12개월은 rolloverTo 조건(복리 10%)으로 이어진다
  const monthlyRate = rolloverRate / 100 / 12;
  const after24 = maturityValue * Math.pow(1 + monthlyRate, 12);
  assert.ok(Math.abs(balances[24] - after24) <= 1, `${balances[24]} vs ${after24}`);
});

test("rolloverTo 없으면 기존 동작(같은 조건 재예치)과 완전히 같다", () => {
  const params = {
    kind: "lumpsum",
    principal: 1_000_000,
    annualRatePercent: 12,
    termMonths: 12,
    compounding: "compound",
    horizonMonths: 24,
  };
  const withoutRollover = simulateProduct(params);
  const withSameRollover = simulateProduct({
    ...params,
    rolloverTo: { annualRatePercent: 12, compounding: "compound" },
  });
  assert.deepEqual(withSameRollover, withoutRollover);
});

test("requiredMonthlySaving: 목표금액을 목표기간(개월)으로 단순 분할한다", () => {
  assert.equal(requiredMonthlySaving(120_000_000, 10), 1_000_000);
});

test("toYearlySnapshots: 12개월 간격으로 스냅샷을 뽑는다", () => {
  const monthly = Array.from({ length: 25 }, (_, i) => i * 1000); // 0..24개월, 2년치
  const snapshots = toYearlySnapshots(monthly, 2);
  assert.deepEqual(snapshots, [
    { year: 0, balance: 0 },
    { year: 1, balance: 12000 },
    { year: 2, balance: 24000 },
  ]);
});
