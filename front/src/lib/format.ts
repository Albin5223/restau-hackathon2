/**
 * Format a duration given in seconds into a human-readable string.
 *
 * Examples:
 *   45     → "45 s"
 *   120    → "2 min"
 *   90     → "1 min 30 s"
 *   3600   → "1 h 00 min"
 *   5490   → "1 h 31 min 30 s"
 */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    const mStr = m.toString().padStart(2, "0");
    return s > 0 ? `${h} h ${mStr} min ${s} s` : `${h} h ${mStr} min`;
  }
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}
