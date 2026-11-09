import { useEffect, useRef } from 'react';

export default function useMobileNavigation(open, close, lockPosition = false) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const scrollY = window.scrollY;
    const previousPosition = Object.fromEntries(['position','top','left','right','width'].map(key=>[key,document.body.style[key]]));
    document.body.style.overflow = 'hidden';
    // Fixed body locking also prevents background rubber-band scrolling on iOS.
    if(lockPosition)Object.assign(document.body.style,{position:'fixed',top:`-${scrollY}px`,left:'0',right:'0',width:'100%'});
    const panel = panelRef.current;
    const focusable = () => [...panel.querySelectorAll('a[href], button:not(:disabled)')].filter(element => element.getClientRects().length);
    const focusFrame=window.requestAnimationFrame(()=>focusable()[0]?.focus({preventScroll:true}));
    const onKey = event => {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const onResize = () => { if (window.innerWidth >= 1024) close(); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      if(lockPosition){Object.assign(document.body.style,previousPosition);window.scrollTo(0,scrollY);}
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      if(previous?.isConnected)previous.focus({preventScroll:true});
    };
  }, [open, close, lockPosition]);
  return panelRef;
}
