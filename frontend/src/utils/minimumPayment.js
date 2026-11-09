export function paymentAmountError(value,minimum=0,outstanding){
  if(value==='')return '';
  const money=amount=>Number(amount).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(!/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(String(value))||Number(value)<=0)return 'Enter a positive amount with at most two decimal places.';
  const paise=Math.round(Number(value)*100);
  if(paise<Math.round(minimum*100))return `Minimum payment required is ₹${money(minimum)}. Please enter this amount or more.`;
  if(outstanding!==undefined&&paise>Math.round(outstanding*100))return 'Payment exceeds the total outstanding loan balance';
  return '';
}
