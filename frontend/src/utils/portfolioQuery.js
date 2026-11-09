// React Router's search-param updater is not a queued React state setter.
// Keep the latest intended query so consecutive clear/filter/sort actions do
// not rebuild their URL from the same stale render snapshot.
export function changePortfolioQuery(ref,key,value){
 const next=new URLSearchParams(ref.current);
 if(value)next.set(key,value);else next.delete(key);
 if(key!=='page')next.set('page','1');
 ref.current=next;
 return next;
}
