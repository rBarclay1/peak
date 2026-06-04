// Subtle wavy topographic contour lines behind the dashboard. Static, decorative,
// non-interactive. Drawn once at module load; scales to fill via slice.
const W = 390
const H = 844

const LINES = (() => {
  const out = []
  const count = 22
  const steps = 60
  for (let i = 0; i < count; i++) {
    const baseY = (i / (count - 1)) * (H + 160) - 80
    const amp = 14 + (i % 4) * 9
    const phase = i * 0.8
    let d = ''
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const x = t * W
      const y =
        baseY +
        Math.sin(phase + t * Math.PI * 2.5) * amp +
        Math.sin(phase * 1.7 + t * Math.PI * 6) * amp * 0.22
      d += `${s === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `
    }
    out.push(d.trim())
  }
  return out
})()

export default function TopoBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="block"
      >
        {LINES.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={i % 2 ? 0.06 : 0.038}
            strokeWidth="1"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  )
}
