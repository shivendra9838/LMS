/**
 * Utility to calculate loan mathematics securely on the backend
 */

const calculateLoanDetails = (loanAmount, interestPercent, durationDays) => {
  // Simple flat interest calculation: Amount * (Rate / 100)
  const interestAmount = parseFloat((loanAmount * (interestPercent / 100)).toFixed(2));
  
  const totalPayable = parseFloat((loanAmount + interestAmount).toFixed(2));
  
  // Daily installment
  const dailyInstallment = parseFloat((totalPayable / durationDays).toFixed(2));

  return {
    interestAmount,
    totalPayable,
    dailyInstallment
  };
};

module.exports = {
  calculateLoanDetails
};
