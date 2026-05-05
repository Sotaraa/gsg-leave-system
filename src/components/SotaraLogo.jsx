import React from 'react';

/**
 * SotaraLogo — precise SVG recreation of the Sotara wordmark
 *
 * "SOTAR" in Nunito Black (forced width)  +  custom "A" with the
 * Sotara upward-right arrow — the brand signature.
 *
 * Props
 *   width     — rendered px width (height ≈ 20% of width)
 *   variant   — 'teal' | 'white' | 'dark'
 *   subtitle  — label below, e.g. "LEAVEHUB"
 *   className — extra CSS classes
 *
 * ── SVG coordinate system  viewBox "0 0 510 92" ──────────────────
 *  baseline  y = 84     cap-top  y = 5     cap-height = 79 u
 *
 *  "SOTAR"  textLength = 295  →  x 0 … 295  (1 letter ≈ 59 u)
 *
 *  Custom "A"  (one letter wide, x 296 … 355):
 *    left leg  : (296,84) → (323,5)     diagonal foot → apex
 *    crossbar  : (307,52) → (375,52)    at ~40% height, bridges to arrow
 *    arrow     : M(355,84) C(355,35)(474,15)(490,3)
 *                  C1 straight-up  →  C2 sets 37° exit ✓
 *    arrowhead : "490,3  478,23  468,11"
 *
 * Stroke-width = 10 u  ≡  ~4.3 px at 220 px render  ≡  Nunito Black weight ✓
 * ──────────────────────────────────────────────────────────────────
 */
const SotaraLogo = ({
  width    = 200,
  variant  = 'teal',
  subtitle = '',
  className = '',
}) => {
  const teal = '#2DC4D4';
  const navy = '#0A2847';

  const fill =
    variant === 'white' ? '#ffffff' :
    variant === 'dark'  ? navy      :
    teal;

  const subFill =
    variant === 'dark'
      ? 'rgba(10,40,71,0.5)'
      : 'rgba(45,196,212,0.65)';

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {/* ══ Wordmark SVG ══════════════════════════════════════════ */}
      <svg
        width={width}
        viewBox="0 0 510 92"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
        aria-label={subtitle ? `Sotara ${subtitle}` : 'Sotara'}
        role="img"
      >
        {/* ── "SOTAR" — Nunito Black, forced to exactly 295 units ── */}
        <text
          x="0"
          y="84"
          fontFamily="'Nunito', 'Poppins', 'Inter', sans-serif"
          fontWeight="900"
          fontSize="84"
          fill={fill}
          textLength="295"
          lengthAdjust="spacingAndGlyphs"
        >
          SOTAR
        </text>

        {/* ── A: left leg — diagonal from right foot to apex ── */}
        <line
          x1="296" y1="84"
          x2="323"  y2="5"
          stroke={fill} strokeWidth="10" strokeLinecap="round"
        />

        {/* ── A: crossbar — bridges left-leg to where arrow passes ── */}
        <line
          x1="307" y1="52"
          x2="375" y2="52"
          stroke={fill} strokeWidth="8" strokeLinecap="round"
        />

        {/*
          ── Arrow ───────────────────────────────────────────────────
          M(355,84)  — A right foot
          C(355,35)  — control 1: rises straight up (dx=0, dy=-49)
           (474,15)  — control 2: sets ~37° exit angle
          (490,3)    — arrow tip

          Verified:
            start direction : straight up          ✓
            end direction   : atan(12/16) = 36.9°  ✓
            midpoint t=0.5  : (417, 30)  — above crossbar, below cap ✓
        ─────────────────────────────────────────────────────────── */}
        <path
          d="M 355 84 C 355 35, 474 15, 490 3"
          stroke={fill} strokeWidth="10" fill="none"
          strokeLinecap="round" strokeLinejoin="round"
        />

        {/* ── Arrowhead — tip at (490,3), pointing 37° above horiz ── */}
        <polygon points="490,3 478,23 468,11" fill={fill} />
      </svg>

      {/* ── Optional subtitle (e.g. "LEAVEHUB") ── */}
      {subtitle && (
        <span style={{
          fontFamily: "'Nunito', 'Inter', sans-serif",
          fontWeight: 700,
          fontSize: Math.max(8, Math.round(width * 0.063)),
          color: subFill,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          display: 'block',
          marginTop: Math.round(width * 0.038),
        }}>
          {subtitle}
        </span>
      )}
    </div>
  );
};

export default SotaraLogo;
