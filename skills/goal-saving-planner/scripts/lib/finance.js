"use strict";
// 상품 하나(예금/적금/투자)를 월 단위로 시뮬레이션한다. 만기가 되면 그 시점 평가액을
// 새 원금 삼아 거치식으로 재예치한다고 가정한다 — rolloverTo가 없으면 같은 조건
// (연이율/복리여부)으로, 있으면 rolloverTo에 지정된 조건으로 재예치한다(최초 만기
// 1회만 전환, 그 뒤로는 전환된 조건이 계속 유지된다).
// 공식 근거: ../references/formula.md

function round(n) {
  return Math.round(n);
}

function simulateProduct({
  kind, // 'lumpsum' | 'installment'
  principal = 0,
  monthlyAmount = 0,
  annualRatePercent,
  termMonths,
  compounding, // 'simple' | 'compound'
  horizonMonths,
  rolloverTo, // 선택: { annualRatePercent, compounding } — 만기 후 다른 조건으로 재예치
}) {
  if (kind !== "lumpsum" && kind !== "installment") {
    throw new Error(`kind는 'lumpsum' 또는 'installment'여야 합니다: ${kind}`);
  }
  if (compounding !== "simple" && compounding !== "compound") {
    throw new Error(`compounding은 'simple' 또는 'compound'여야 합니다: ${compounding}`);
  }
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) {
    throw new Error(`annualRatePercent가 올바르지 않습니다: ${annualRatePercent}`);
  }
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error(`termMonths는 1 이상의 정수여야 합니다: ${termMonths}`);
  }
  if (!Number.isInteger(horizonMonths) || horizonMonths < 0) {
    throw new Error(`horizonMonths는 0 이상의 정수여야 합니다: ${horizonMonths}`);
  }
  if (rolloverTo !== undefined) {
    if (!Number.isFinite(rolloverTo.annualRatePercent) || rolloverTo.annualRatePercent < 0) {
      throw new Error(`rolloverTo.annualRatePercent가 올바르지 않습니다: ${rolloverTo.annualRatePercent}`);
    }
    if (rolloverTo.compounding !== "simple" && rolloverTo.compounding !== "compound") {
      throw new Error(`rolloverTo.compounding은 'simple' 또는 'compound'여야 합니다: ${rolloverTo.compounding}`);
    }
  }

  const balances = new Array(horizonMonths + 1).fill(0);
  balances[0] = kind === "lumpsum" ? round(principal) : 0;

  let cycleStartMonth = 0;
  let cyclePrincipal = kind === "lumpsum" ? principal : 0;
  let cycleKind = kind;
  let currentRate = annualRatePercent;
  let currentCompounding = compounding;
  let hasRolledOver = false;
  let contributions = []; // installment(simple)에서만 사용: 회차별 납입월 기록

  for (let m = 1; m <= horizonMonths; m++) {
    const t = m - cycleStartMonth;
    let balance;

    if (cycleKind === "lumpsum") {
      if (currentCompounding === "compound") {
        const r = currentRate / 100 / 12;
        balance = cyclePrincipal * Math.pow(1 + r, t);
      } else {
        balance = cyclePrincipal * (1 + (currentRate / 100) * (t / 12));
      }
    } else {
      const contributesThisMonth = t <= termMonths;
      if (contributesThisMonth) contributions.push({ month: m });

      if (currentCompounding === "compound") {
        const r = currentRate / 100 / 12;
        const prevBalance = balances[m - 1];
        const contributed = contributesThisMonth ? monthlyAmount : 0;
        balance = (prevBalance + contributed) * (1 + r);
      } else {
        balance = contributions.reduce((sum, c) => {
          const elapsed = m - c.month + 1;
          return sum + monthlyAmount * (1 + (currentRate / 100) * (elapsed / 12));
        }, 0);
      }
    }

    balances[m] = round(balance);

    if (t === termMonths) {
      cyclePrincipal = balance;
      cycleStartMonth = m;
      cycleKind = "lumpsum";
      contributions = [];
      if (rolloverTo !== undefined && !hasRolledOver) {
        currentRate = rolloverTo.annualRatePercent;
        currentCompounding = rolloverTo.compounding;
        hasRolledOver = true;
      }
    }
  }

  return balances;
}

function toYearlySnapshots(monthlyBalances, years = 30) {
  const lastIdx = monthlyBalances.length - 1;
  const out = [];
  for (let y = 0; y <= years; y++) {
    const idx = Math.min(y * 12, lastIdx);
    out.push({ year: y, balance: monthlyBalances[idx] });
  }
  return out;
}

function requiredMonthlySaving(goalAmount, goalYears) {
  if (!Number.isFinite(goalAmount) || goalAmount < 0) {
    throw new Error(`goalAmount가 올바르지 않습니다: ${goalAmount}`);
  }
  if (!Number.isFinite(goalYears) || goalYears <= 0) {
    throw new Error(`goalYears는 0보다 커야 합니다: ${goalYears}`);
  }
  return round(goalAmount / (goalYears * 12));
}

module.exports = { simulateProduct, toYearlySnapshots, requiredMonthlySaving, round };
