// src/utils/datehelpers.js

export const calculateDays = (start, end, isHalfDay) => {
  if (isHalfDay) return 0.5;
  if (!start || !end) return 0;
  
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = Math.abs(e - s);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};
