// Date helpers that work on local calendar dates as 'YYYY-MM-DD' strings.

const pad = (n) => String(n).padStart(2, '0');

export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthOf = (dateStr) => dateStr.slice(0, 7);
export const yearOf = (dateStr) => dateStr.slice(0, 4);

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}

export function addMonths(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function addDays(dateStr, delta) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + delta);
  return isoDate(d);
}

// Oldest first, ending with `endMonth`.
export const monthRange = (endMonth, count) => Array.from({ length: count }, (_, i) => addMonths(endMonth, i - count + 1));

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

// Bounds of a goal period plus how far `today` is through it (0..1).
export function periodInfo(periodType, period, today) {
  let start, end;
  if (periodType === 'monthly') {
    start = `${period}-01`;
    end = `${period}-${pad(daysInMonth(period))}`;
  } else {
    start = `${period}-01-01`;
    end = `${period}-12-31`;
  }
  const total = daysBetween(start, end) + 1;
  let phase;
  let elapsed;
  if (today < start) {
    phase = 'future';
    elapsed = 0;
  } else if (today > end) {
    phase = 'past';
    elapsed = total;
  } else {
    phase = 'current';
    elapsed = daysBetween(start, today) + 1;
  }
  return { start, end, total, elapsed, fraction: elapsed / total, phase };
}

export const inRange = (dateStr, start, end) => dateStr >= start && dateStr <= end;
