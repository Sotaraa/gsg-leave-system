import React from 'react';

/**
 * SotaraLogo — faithful SVG recreation of the Sotara brand mark
 *
 * Props:
 *   width        — rendered width (height scales proportionally)
 *   variant      — 'teal' (default, teal text on transparent)
 *                  'white' (white text, for use on very dark backgrounds)
 *                  'dark'  (navy text, for use on light backgrounds)
 *   showBadge    — wrap in the dark-navy pill/badge (like the source logo)
 *   subtitle     — optional subtitle beneath the mark (e.g. "LEAVEHUB")
 */
const SotaraLogo = ({
  width = 180,
  variant = 'teal',
  showBadge = false,
  subtitle = '',
  className = '',
}) => {
  const teal   = '#2DC4D4';
  const navy   = '#0A2847';

  const textColor = variant === 'white' ? '#ffffff'
    : variant === 'dark'  ? navy
    : teal;

  const subColor = variant === 'dark'
    ? 'rgba(10,40,71,0.45)'
    : 'rgba(45,196,212,0.6)';

  // ViewBox: 260 wide × 52 tall (no subtitle), or 260 × 72 (with subtitle)
  const vbH = subtitle ? 72 : 52;

  return (
    <svg
      width={width}
      viewBox={`0 0 260 ${vbH}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={subtitle ? `Sotara ${subtitle}` : 'Sotara'}
      role="img"
    >
      {showBadge && (
        <rect x="0" y="0" width="260" height={vbH} rx="10" fill={navy} />
      )}

      {/* ── "SOTAR" wordmark ── */}
      <text
        x={showBadge ? 14 : 0}
        y="44"
        fontFamily="Inter, 'Segoe UI', Arial, sans-serif"
        fontWeight="900"
        fontSize="48"
        letterSpacing="-1"
        fill={textColor}
      >
        SOTAR
      </text>

      {/*
        ── Stylised "A↗" ──
        Left leg:  (192,44) → (210,4)
        Right leg: (228,44) → (210,4)
        Crossbar:  (199,28) → (221,28)
        Arrow shaft from apex: (210,4) → (244,0) — goes up-right
        Arrowhead at tip
      */}
      {(() => {
        const ox = showBadge ? 14 : 0; // horizontal offset when badge shown
        const lx = 192 + ox;           // left leg base x
        const ax = 210 + ox;           // apex x
        const rx = 228 + ox;           // right leg base x
        const arrowTipX = 248 + ox;
        return (
          <g>
            {/* Left leg */}
            <line x1={lx} y1="44" x2={ax} y2="4"
              stroke={textColor} strokeWidth="7.5" strokeLinecap="round" />
            {/* Right leg */}
            <line x1={rx} y1="44" x2={ax} y2="4"
              stroke={textColor} strokeWidth="7.5" strokeLinecap="round" />
            {/* Crossbar */}
            <line x1={lx + 8} y1="28" x2={rx - 8} y2="28"
              stroke={textColor} strokeWidth="5.5" strokeLinecap="round" />
            {/* Arrow shaft from apex going upper-right */}
            <line x1={ax} y1="4" x2={arrowTipX} y2="0"
              stroke={textColor} strokeWidth="5" strokeLinecap="round" />
            {/* Arrowhead */}
            <polygon
              points={`${arrowTipX - 8},0 ${arrowTipX},0 ${arrowTipX},8`}
              fill={textColor}
            />
          </g>
        );
      })()}

      {/* ── Optional subtitle (e.g. "LEAVEHUB") ── */}
      {subtitle && (
        <text
          x={showBadge ? 14 : 0}
          y="65"
          fontFamily="Inter, 'Segoe UI', Arial, sans-serif"
          fontWeight="700"
          fontSize="13"
          letterSpacing="3"
          fill={subColor}
        >
          {subtitle.toUpperCase()}
        </text>
      )}
    </svg>
  );
};

export default SotaraLogo;
