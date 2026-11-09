const { businessDay } = require('./businessDay');
function timing(received, due) {
  const a = businessDay(received), b = businessDay(due);
  return a < b ? 'PAID_EARLY' : a > b ? 'PAID_LATE' : 'PAID_ON_TIME';
}
const labels = {PAID_EARLY:'Paid in Advance (Paid Early)',PAID_ON_TIME:'Paid On Time',PAID_LATE:'Overdue Paid',PARTIAL:'Partially Paid',PARTIAL_EARLY:'Partially Paid in Advance',PENDING:'Pending',OVERDUE:'Overdue',PAID:'Paid'};
function present(row, now = new Date()) {
  const due = row.dueDate || row.date;
  const overdue = Number(row.paidAmount || 0) < row.amount && businessDay(due) < businessDay(now);
  const paid = Number(row.paidAmount || 0) >= row.amount;
  const displayStatus = paid ? (row.paidDate ? timing(row.paidDate,due) : 'PAID') : row.paidAmount > 0 ? (businessDay(due)>businessDay(now)?'PARTIAL_EARLY':'PARTIAL') : overdue ? 'OVERDUE' : 'PENDING';
  return {...row,overdue,displayStatus,statusLabel:labels[displayStatus],remainingAmount:Math.max(0,Math.round((row.amount-(row.paidAmount||0))*100)/100)};
}
module.exports = {timing,present,labels};
