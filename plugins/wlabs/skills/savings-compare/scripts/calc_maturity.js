#!/usr/bin/env node
// 예금/적금 만기 세후 수령액 계산. 공식은 ../references/interest-calc.md 참고.
//
// 사용법:
//   예금: node calc_maturity.js deposit <원금> <개월수> <연이율(%)> <단리|복리>
//   적금: node calc_maturity.js saving <월납입액> <개월수> <연이율(%)> <단리|복리>

const TAX_RATE = 0.154; // 이자소득세 15.4% (일반과세 기준)

function main() {
  const [, , type, amountStr, monthsStr, rateStr, rateType] = process.argv;
  if (!["deposit", "saving"].includes(type)) {
    throw new Error("첫 번째 인자는 deposit 또는 saving 이어야 합니다.");
  }
  const amount = Number(amountStr);
  const months = Number(monthsStr);
  const annualRate = Number(rateStr) / 100;
  const isCompound = rateType === "복리";

  let preTaxInterest;
  let principal;

  if (type === "deposit") {
    principal = amount;
    preTaxInterest = isCompound
      ? amount * (Math.pow(1 + annualRate / 12, months) - 1)
      : amount * annualRate * (months / 12);
  } else {
    principal = amount * months;
    // 정액적립 단리 공식. 복리는 이 공식으로 근사(주의사항은 SKILL.md/참고문서에서 안내).
    preTaxInterest = amount * annualRate * (months * (months + 1)) / (2 * 12);
  }

  const afterTaxInterest = preTaxInterest * (1 - TAX_RATE);
  const totalReceived = principal + afterTaxInterest;

  console.log(JSON.stringify({
    error: false,
    type,
    principal: Math.round(principal),
    preTaxInterest: Math.round(preTaxInterest),
    afterTaxInterest: Math.round(afterTaxInterest),
    totalReceived: Math.round(totalReceived),
    isApproximation: type === "saving" && isCompound, // 복리 적금은 근사치임을 표시
  }, null, 2));
}

try {
  main();
} catch (err) {
  console.error(JSON.stringify({ error: true, message: err.message }));
  process.exitCode = 1;
}
