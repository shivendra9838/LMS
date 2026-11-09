/**
 * Utility to calculate loan mathematics securely on the backend
 */

const calculateLoanDetails = (loanAmount, interestPercent, durationDays) => {
  const {minor,major,MAX_MINOR}=require('./money');
  const principal=minor(loanAmount), rate=String(interestPercent), days=Number(durationDays);
  if (!/^\d{1,4}(\.\d{1,4})?$/.test(rate)||Number(rate)>1000||!Number.isInteger(days)||days<1||days>3660) throw Object.assign(new Error('Use a valid flat interest rate and duration (1–3660 days)'),{status:422});
  const scaledRate=BigInt(Math.round(Number(rate)*10000));
  const interest=Number((BigInt(principal)*scaledRate+500000n)/1000000n);
  if(principal+interest>MAX_MINOR||principal+interest<days)throw Object.assign(new Error('Loan amount or installment duration exceeds supported monetary limits'),{status:422});
  const interestAmount=major(interest),totalPayable=major(principal+interest),dailyInstallment=major(Math.round((principal+interest)/days));

  return {
    interestAmount,
    totalPayable,
    dailyInstallment
  };
};

function installmentAmounts(totalPayable,durationDays) {
  const {legacyMinor,major}=require('./money');const total=legacyMinor(totalPayable),normal=Math.round(total/durationDays);
  const final=total-normal*(durationDays-1);
  if(final>0)return Array.from({length:durationDays},(_,index)=>major(index===durationDays-1?final:normal));
  const base=Math.floor(total/durationDays),remainder=total%durationDays;
  return Array.from({length:durationDays},(_,index)=>major(base+(index<remainder?1:0)));
}

module.exports = {
  calculateLoanDetails, installmentAmounts
};
