import React from 'react';

/**
 * LeaveHub SVG Logo
 * variant="light"  → white wordmark, for use on dark backgrounds (login screen)
 * variant="dark"   → dark wordmark, for use on light backgrounds
 * (default is "light" to match sidebar)
 */
const LeaveHubLogo = ({ width = 180, variant = 'light', className = '' }) => {
  const isLight = variant !== 'dark';
  const wordmarkColor   = isLight ? 'white'                    : '#001f4d';
  const subtitleColor   = isLight ? 'rgba(180,210,255,0.65)'   : 'rgba(0,31,77,0.45)';
  const iconA           = isLight ? '#4A9EDB'                  : '#2176C7';
  const iconB           = isLight ? '#2176C7'                  : '#0052a3';

  return (
    <svg
      width={width}
      viewBox="0 0 200 54"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="LeaveHub"
      role="img"
    >
      {/* Icon mark — three overlapping rounded squares */}
      <rect x="0"  y="4"  width="22" height="22" rx="5" fill={iconA} opacity="0.9" />
      <rect x="8"  y="12" width="22" height="22" rx="5" fill={iconB} opacity="0.85" />
      <rect x="16" y="20" width="16" height="16" rx="4" fill={iconA} opacity="0.75" />

      {/* Wordmark */}
      <text
        x="46" y="17"
        fontFamily="Inter, 'Segoe UI', sans-serif"
        fontWeight="600"
        fontSize="7.5"
        letterSpacing="2"
        fill={subtitleColor}
      >
        POWERED BY SOTARA
      </text>
      <text
        x="46" y="34"
        fontFamily="Inter, 'Segoe UI', sans-serif"
        fontWeight="800"
        fontSize="17"
        letterSpacing="1.5"
        fill={wordmarkColor}
      >
        LEAVEHUB
      </text>
    </svg>
  );
};

export default LeaveHubLogo;
