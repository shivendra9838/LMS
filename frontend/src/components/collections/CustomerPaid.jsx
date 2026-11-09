const money=n=>Number(n||0).toLocaleString('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2});

// Each receipt is presented as new money only on its stored starting installment.
// Later rows show their allocation and source, never another full receipt amount.
export default function CustomerPaid({row}){
 const receipts=row.receiptSummaries||[];
 if(!receipts.length)return <span className="text-sm">{row.paidAmount>0?`Allocated ${money(row.paidAmount)} · receipt details unavailable`:money(0)}</span>;
 const entries=receipts.map(p=>p.isPrimaryInstallment?<div key={p._id} className="space-y-1"><strong className="text-base whitespace-nowrap">{money(p.receiptTotal)}</strong><p className="text-xs">{p.collectionNumber}</p><p className="text-xs">Day {row.dayNumber}: {money(p.allocatedAmount)}</p>{p.otherAllocations?.map(a=><p className="text-xs" key={a.scheduleId}>Day {a.dayNumber??'not recorded'}{a.paidEarly?' advance':''}: {money(a.amount)}</p>)}</div>:<div key={p._id} className="space-y-1 text-xs"><p>{p.allocationTiming==='PAID_EARLY'?'Advance received':'Received allocation'}: <strong>{money(p.allocatedAmount)}</strong></p><p>Source: {p.collectionNumber}</p></div>);
 return <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">{entries.length>1?<details><summary className="cursor-pointer min-h-11 py-2 text-sm">Payment Breakdown · {entries.length} receipts</summary><div className="space-y-3">{entries}</div></details>:entries}</div>;
}
