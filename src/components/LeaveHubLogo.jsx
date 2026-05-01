import React from 'react';

const LeaveHubLogo = ({ width = 180, className = '' }) => (
  <svg
    width={width}
    viewBox="0 0 180 52"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="LeaveHub"
  >
    {/* Icon mark — overlapping rounded squares */}
    <rect x="0" y="6" width="22" height="22" rx="5" fill="#4A9EDB" opacity="0.9" />
    <rect x="8" y="14" width="22" height="22" rx="5" fill="#2176C7" opacity="0.85" />
    {/* L letter inside icon */}
    <text x="11" y="30" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="13" fill="white" opacity="0.95">L</text>

    {/* LEAVEHUB wordmark */}
    <text
      x="38"
      y="18"
      fontFamily="Inter, 'Segoe UI', sans-serif"
      fontWeight="700"
      fontSize="8"
      letterSpacing="2.5"
      fill="rgba(180,210,255,0.75)"
      textAnchor="start"
    >
      POWERED BY SOTARA
    </text>
    <text
      x="38"
      y="34"
      fontFamily="Inter, 'Segoe UI', sans-serif"
      fontWeight="800"
      fontSize="16"
      letterSpacing="1.5"
      fill="white"
      textAnchor="start"
    >
      LEAVEHUB
    </text>
  </svg>
);

export default LeaveHubLogo;
