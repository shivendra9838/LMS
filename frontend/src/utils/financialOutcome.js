import {businessDay} from './businessDate.js';
export function uncertainFinancialError(error){return !error?.response||error.response.status>=500||[408,425].includes(error.response.status);}
export function collectionByRequest(rows,key){return key&&(Array.isArray(rows)?rows:[]).find(row=>row.idempotencyKey===key);}
export function issuedLoanMatch(rows,payload,startedAt){return (Array.isArray(rows)?rows:[]).find(loan=>new Date(loan.createdAt).getTime()>=startedAt&&Number(loan.loanAmount)===Number(payload.loanAmount)&&Number(loan.interestPercent)===Number(payload.interestPercent)&&Number(loan.durationDays)===Number(payload.durationDays)&&businessDay(loan.loanDate)===payload.loanDate);}
export const uncertainScope=scope=>'royal:unconfirmed:'+scope;
