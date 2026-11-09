// One action at a time per notification surface; retries become available even
// after a failed request. This is UI coordination, not financial idempotency.
export async function notificationAction(gate,key,setPending,work){
 if(gate.current)return;
 gate.current=true;setPending(key);
 try{return await work();}finally{gate.current=false;setPending(null);}
}
