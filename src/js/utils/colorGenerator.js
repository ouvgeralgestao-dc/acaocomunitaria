export const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#d946ef', '#22c55e', '#eab308', '#a855f7'
];

export function generateColor(seedString) {
  let hash = 0;
  for (let i = 0; i < String(seedString).length; i++) {
    hash = String(seedString).charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}
