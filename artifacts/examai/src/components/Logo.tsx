export default function Logo({ size = 36 }: { size?: number }) {
  const id = "logo_v2";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={`${id}_bg`} x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0A84FF" />
          <stop offset="55%" stopColor="#5E5CE6" />
          <stop offset="100%" stopColor="#BF5AF2" />
        </linearGradient>
        <linearGradient id={`${id}_book_l`} x1="8" y1="15" x2="18" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.70)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.88)" />
        </linearGradient>
        <linearGradient id={`${id}_book_r`} x1="18" y1="15" x2="28" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.90)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.78)" />
        </linearGradient>
        <filter id={`${id}_glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.9" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background — rounded square, blue → violet diagonal */}
      <rect x="0" y="0" width="36" height="36" rx="9" fill={`url(#${id}_bg)`} />

      {/* ── AI network (upper third) ─────────────────── */}
      {/* Connection lines */}
      <line x1="18" y1="8.5"  x2="10.5" y2="5"    stroke="white" strokeWidth="0.65" opacity="0.55" />
      <line x1="18" y1="8.5"  x2="25.5" y2="5"    stroke="white" strokeWidth="0.65" opacity="0.55" />
      <line x1="10.5" y1="5"  x2="6"    y2="9.5"  stroke="white" strokeWidth="0.5"  opacity="0.38" />
      <line x1="25.5" y1="5"  x2="30"   y2="9.5"  stroke="white" strokeWidth="0.5"  opacity="0.38" />
      <line x1="10.5" y1="5"  x2="25.5" y2="5"    stroke="white" strokeWidth="0.45" opacity="0.22" />

      {/* Nodes */}
      <circle cx="18"   cy="8.5" r="2.5" fill="white" opacity="1"    filter={`url(#${id}_glow)`} />
      <circle cx="10.5" cy="5"   r="1.6" fill="white" opacity="0.88" filter={`url(#${id}_glow)`} />
      <circle cx="25.5" cy="5"   r="1.6" fill="white" opacity="0.88" filter={`url(#${id}_glow)`} />
      <circle cx="6"    cy="9.5" r="1.1" fill="white" opacity="0.58" />
      <circle cx="30"   cy="9.5" r="1.1" fill="white" opacity="0.58" />

      {/* ── Open book (lower two-thirds) ──────────────── */}
      {/* Left page */}
      <path d="M8.5 17 L18 14.5 L18 27 L8.5 26 Z" fill={`url(#${id}_book_l)`} />
      {/* Right page */}
      <path d="M27.5 17 L18 14.5 L18 27 L27.5 26 Z" fill={`url(#${id}_book_r)`} />
      {/* Spine */}
      <line x1="18" y1="14.5" x2="18" y2="27" stroke="white" strokeWidth="0.7" opacity="0.35" />
      {/* Bottom cover strip */}
      <rect x="7.5" y="26.5" width="21" height="2.8" rx="1.3" fill="white" opacity="0.92" />
      {/* Text lines — left page */}
      <line x1="11"  y1="20"   x2="16.5" y2="19.2" stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.38" />
      <line x1="11"  y1="22.5" x2="16.5" y2="21.7" stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.38" />
      {/* Text lines — right page */}
      <line x1="19.5" y1="19.2" x2="25"  y2="20"   stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.38" />
      <line x1="19.5" y1="21.7" x2="25"  y2="22.5" stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.38" />
    </svg>
  );
}
