import React from 'react';

/**
 * SotaraLogo — renders the official Sotara.png brand mark
 *
 * The PNG has white margins (top 12.8%, bottom 17.3%) that would show
 * against the app's navy background. This component crops them out
 * mathematically using the image's known content bounds:
 *   natural size  : 2172 × 724 px
 *   content top   : y = 93   (first non-white row)
 *   content bottom: y = 599  (last  non-white row)
 *   content height: 506 px
 *
 * Props
 *   width     — rendered width in px (height auto-scales ≈ 23% of width)
 *   subtitle  — optional label below the mark, e.g. "LEAVEHUB"
 *   className — extra CSS classes
 *   variant   — kept for API compat ('teal' | 'white' | 'dark')
 */

const IMG_NATURAL_W  = 2172;
const CONTENT_TOP    = 93;   // px from top  — first dark pixel
const CONTENT_BOTTOM = 599;  // px from top  — last  dark pixel
const CONTENT_H      = CONTENT_BOTTOM - CONTENT_TOP; // 506 px

const SotaraLogo = ({
  width    = 200,
  subtitle = '',
  className = '',
  variant  = 'teal',
}) => {
  const subColor =
    variant === 'dark'
      ? 'rgba(10,40,71,0.5)'
      : 'rgba(45,196,212,0.65)';

  // Scale everything from the image's natural width
  const scale      = width / IMG_NATURAL_W;
  const topCrop    = Math.round(CONTENT_TOP * scale);   // px to hide from top
  const contentH   = Math.round(CONTENT_H  * scale);   // visible height

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
      {/* ── Cropped logo: clip white top & bottom margins ── */}
      <div style={{
        width,
        height: contentH,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <img
          src="/Sotara.png"
          alt="Sotara"
          width={width}
          style={{
            display: 'block',
            marginTop: -topCrop,
            mixBlendMode: 'screen',   // makes dark (navy) bg transparent, teal text stays bright
          }}
          draggable={false}
        />
      </div>

      {/* ── Optional subtitle (e.g. "LEAVEHUB") ── */}
      {subtitle && (
        <span style={{
          fontFamily: "'Nunito', 'Inter', sans-serif",
          fontWeight: 700,
          fontSize: Math.max(8, Math.round(width * 0.063)),
          color: subColor,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          display: 'block',
          marginTop: Math.round(width * 0.04),
        }}>
          {subtitle}
        </span>
      )}
    </div>
  );
};

export default SotaraLogo;
