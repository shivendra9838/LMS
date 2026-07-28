const { calculateLoanDetails } = require('./src/utils/loanCalculator');

const runTests = () => {
  const tests = [
    {
      case: 1,
      input: { amount: 100000, interest: 7, duration: 120 },
      expected: { interestAmount: 7000, totalPayable: 107000, dailyInstallment: 891.67 }
    },
    {
      case: 2,
      input: { amount: 50000, interest: 5, duration: 100 },
      expected: { interestAmount: 2500, totalPayable: 52500, dailyInstallment: 525 }
    },
    {
      case: 3,
      input: { amount: 250000, interest: 8, duration: 200 },
      expected: { interestAmount: 20000, totalPayable: 270000, dailyInstallment: 1350 }
    }
  ];

  let allPassed = true;

  tests.forEach((t) => {
    const result = calculateLoanDetails(t.input.amount, t.input.interest, t.input.duration);
    
    const passInterest = result.interestAmount === t.expected.interestAmount;
    const passTotal = result.totalPayable === t.expected.totalPayable;
    const passInstallment = result.dailyInstallment === t.expected.dailyInstallment;

    if (passInterest && passTotal && passInstallment) {
      console.log(`Test Case ${t.case}: PASS ✅`);
    } else {
      console.log(`Test Case ${t.case}: FAIL ❌`);
      console.log(`  Expected:`, t.expected);
      console.log(`  Got:     `, result);
      allPassed = false;
    }
  });

  if (allPassed) {
    console.log('\nCalculator 100% pass hona chahiye. -> CONFIRMED ✅');
  } else {
    console.log('\nSome tests failed.');
  }
};

runTests();
