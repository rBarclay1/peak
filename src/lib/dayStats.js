// Small pure helpers for rendering day stats. Per-day sleep/fuel now come from
// real data (Garmin + nutrition logs); there is no placeholder generator.

export function sleepQuality(score) {
  if (score >= 85) return { label: 'Optimal', color: '#30d158' }
  if (score >= 70) return { label: 'Good', color: '#5ac8fa' }
  if (score >= 50) return { label: 'Fair', color: '#ffd60a' }
  return { label: 'Poor', color: '#ff453a' }
}

export function fmtDur(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}
