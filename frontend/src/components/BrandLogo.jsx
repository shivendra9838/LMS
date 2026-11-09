import logo from '../assets/branding/royal-enterprises-logo.webp';
import emblem from '../assets/branding/royal-enterprises-emblem.webp';

/** Original company artwork, contained at its natural aspect ratio in every placement. */
export default function BrandLogo({ variant = 'compact', className = '' }) {
  if (variant === 'full') {
    return <div className={`rounded-2xl bg-[#111111] p-3 sm:p-4 ring-1 ring-[#b99548]/25 ${className}`}>
      <img src={logo} width="733" height="647" alt="Royal Enterprises — A Tradition of TRUST" className="block h-auto w-full object-contain" fetchPriority="high" />
    </div>;
  }

  if (variant === 'clean') {
    return <img src={logo} width="733" height="647" alt="Royal Enterprises — A Tradition of TRUST" className={`block h-auto w-full object-contain ${className}`} fetchPriority="high" />;
  }

  const header = variant === 'header';
  return <div className={`flex min-w-0 items-center ${header ? 'gap-2' : 'gap-2.5'} ${className}`}>
    <span className={`flex ${header ? 'h-10 w-10' : 'h-11 w-14'} shrink-0 items-center justify-center rounded-lg bg-[#111111] p-1.5 ring-1 ring-[#b99548]/30`}>
      <img src={emblem} width="224" height="143" alt="Royal Enterprises emblem" className="block h-full w-full object-contain" />
    </span>
    <span className={header ? "hidden sm:block min-w-0" : "min-w-0"}>
      <span className={`block whitespace-nowrap font-serif ${header ? 'text-[12px] sm:text-[13px]' : 'text-[13px]'} font-bold leading-tight tracking-[0.02em] text-[#211b10]`}>ROYAL ENTERPRISES</span>
      <span className="mt-0.5 block whitespace-nowrap text-[11px] leading-tight text-[#725824]">A Tradition of TRUST</span>
    </span>
  </div>;
}
