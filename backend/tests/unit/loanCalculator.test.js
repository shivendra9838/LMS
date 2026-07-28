const { calculateLoanDetails } = require('../../src/utils/loanCalculator');

describe('Loan Calculator', () => {
  test('calculates flat interest, total payable, and daily installment', () => {
    const result = calculateLoanDetails(100000, 7, 120);

    expect(result).toEqual({
      interestAmount: 7000,
      totalPayable: 107000,
      dailyInstallment: 891.67
    });
  });

  test('rounds decimal calculations to two places', () => {
    const result = calculateLoanDetails(9999, 2.5, 30);

    expect(result.interestAmount).toBe(249.98);
    expect(result.totalPayable).toBe(10248.98);
    expect(result.dailyInstallment).toBe(341.63);
  });
});
