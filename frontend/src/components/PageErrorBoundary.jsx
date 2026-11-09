import {Component} from 'react';
export function PageLoadRecovery({reload=()=>window.location.reload()}){return <main role="alert" className="min-h-dvh flex items-center justify-center bg-[#141310] text-[#f7edcf] p-5"><section className="w-full max-w-md rounded-2xl border border-[#a98a45] bg-[#201f1b] p-6 space-y-4"><p className="text-sm tracking-wide text-[#d6b76c]">ROYAL ENTERPRISES</p><h1 className="text-xl font-semibold">This page could not load</h1><p className="text-sm leading-relaxed">The application may have been updated or the connection interrupted. Reload the page to load the latest version.</p><p className="text-sm leading-relaxed">If you were recording a payment, check its receipt or payment history before submitting it again.</p><button className="min-h-11 w-full rounded-lg bg-[#d6b76c] text-black font-semibold p-3" onClick={reload}>Reload page</button></section></main>;}
export default class PageErrorBoundary extends Component{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<PageLoadRecovery/>:this.props.children;}
}
