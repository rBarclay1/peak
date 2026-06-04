import { useEffect, useId, useState } from 'react'
import { Minus, Plus, TrendingDown, TrendingUp } from 'lucide-react'
import CardFrame from './CardFrame.jsx'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useWeight } from '../hooks/useWeight'

const COLOR = '#5ac8fa' // cyan

function fmtDate(dateStr, opts) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', opts)
}

export default function WeightCard({ expandedId, onExpand, onCollapse }) {
  const { entries, addEntry, unit } = useWeight()
  const isExpanded = expandedId === 'weight'

  const hasData = entries.length > 0
  const series = entries.map((e) => e.weight)
  const latest = hasData ? series[series.length - 1] : null
  const net = hasData ? +(latest - series[0]).toFixed(1) : 0

  // Neutral starting point for the stepper before any reading exists. It's an
  // editable input, not a logged value — nothing is stored until "Log".
  const [draft, setDraft] = useState(latest ?? 170)
  useEffect(() => {
    setDraft(latest ?? 170)
  }, [latest, isExpanded])

  const preview = (
    <div className="h-full flex items-center gap-4">
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Weight
        </span>
        {hasData ? (
          <>
            <span className="mt-0.5 font-display text-3xl font-extrabold leading-none tracking-tight text-textPrimary">
              {latest}
              <span className="ml-1 text-base font-semibold text-textMuted">{unit}</span>
            </span>
            <div className="mt-1.5">
              <Delta value={net} unit={unit} label="since start" />
            </div>
          </>
        ) : (
          <span className="mt-0.5 font-display text-3xl font-extrabold leading-none tracking-tight text-textMuted">
            —
          </span>
        )}
      </div>
      {hasData ? (
        <div className="flex-1 self-center">
          <WeightGraph data={series} color={COLOR} height={56} />
        </div>
      ) : (
        <div className="flex-1 self-center text-right text-xs text-textMuted">
          Tap to log your first weigh-in
        </div>
      )}
    </div>
  )

  const expanded = (
    <div>
      <h1 className="text-3xl font-bold text-textPrimary">Weight</h1>

      {hasData ? (
        <>
          <div className="mt-4 flex items-end gap-2">
            <span className="font-display text-6xl font-extrabold leading-none tracking-tight text-textPrimary">
              {latest}
            </span>
            <span className="mb-1 text-lg font-semibold text-textMuted">{unit}</span>
            <div className="mb-1.5 ml-auto">
              <Delta value={net} unit={unit} label="since start" />
            </div>
          </div>

          <div className="mt-6">
            <WeightGraph data={series} color={COLOR} height={170} detailed />
            <div className="mt-1.5 flex justify-between text-[11px] font-medium text-textMuted">
              <span>{fmtDate(entries[0].date, { month: 'short', day: 'numeric' })}</span>
              <span>{fmtDate(entries[entries.length - 1].date, { month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-4 text-[15px] text-textSecondary">No weigh-ins yet. Log your first below.</p>
      )}

      {/* Log today */}
      <div className="mt-9">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">Log today</h2>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Decrease"
            onClick={(e) => {
              e.stopPropagation()
              setDraft((d) => +(d - 0.2).toFixed(1))
            }}
            className="size-12 rounded-full [&_svg]:size-5"
          >
            <Minus />
          </Button>
          <div className="flex-1 text-center">
            <span className="font-display text-4xl font-extrabold tabular-nums text-textPrimary">
              {draft.toFixed(1)}
            </span>
            <span className="ml-1 text-base text-textMuted">{unit}</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Increase"
            onClick={(e) => {
              e.stopPropagation()
              setDraft((d) => +(d + 0.2).toFixed(1))
            }}
            className="size-12 rounded-full [&_svg]:size-5"
          >
            <Plus />
          </Button>
        </div>
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            addEntry(draft)
          }}
          className="mt-4 w-full h-auto rounded-2xl py-3.5 text-base font-semibold"
        >
          Log {draft.toFixed(1)} {unit}
        </Button>
      </div>

      {/* History */}
      {hasData && (
      <div className="mt-9">
        <h2 className="mb-1 text-sm uppercase tracking-widest text-muted-foreground">History</h2>
        <ul className="flex flex-col divide-y divide-border">
          {[...entries].reverse().map((e, i, arr) => {
            const prev = arr[i + 1]
            const d = prev ? +(e.weight - prev.weight).toFixed(1) : 0
            return (
              <li key={e.date} className="flex items-center justify-between py-3">
                <span className="text-[15px] text-textPrimary">
                  {fmtDate(e.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className="flex items-center gap-3">
                  {prev && <Delta value={d} unit={unit} small />}
                  <span className="font-display text-lg font-bold tabular-nums text-textPrimary">
                    {e.weight}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      )}
    </div>
  )

  return (
    <CardFrame
      id="weight"
      expandedId={expandedId}
      onExpand={onExpand}
      onCollapse={onCollapse}
      preview={preview}
      expanded={expanded}
    />
  )
}

// Net-change chip with a trend arrow. Neutral cyan — no good/bad implied.
function Delta({ value, unit, label, small }) {
  const Icon = value < 0 ? TrendingDown : value > 0 ? TrendingUp : null
  return (
    <span
      className={cn('inline-flex items-center gap-1 font-semibold', small ? 'text-xs' : 'text-xs')}
      style={{ color: value === 0 ? '#636366' : COLOR }}
    >
      {Icon && <Icon className="size-3.5" />}
      {value > 0 ? '+' : ''}
      {value} {unit}
      {label && <span className="ml-1 font-medium text-textMuted">· {label}</span>}
    </span>
  )
}

// Gradient area sparkline with an end-point dot. preserveAspectRatio="none"
// stretches the line/area to full width; the dot is overlaid in HTML so it
// stays circular.
function WeightGraph({ data, color, height = 48, detailed = false }) {
  const id = useId()
  const w = 100
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const padY = detailed ? 18 : 6
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = padY + (1 - (v - min) / range) * (height - padY * 2)
    return [x, y]
  })
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${w},${height} L0,${height} Z`
  const lastY = pts[pts.length - 1][1]
  const dot = detailed ? 11 : 8

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        className="block"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={detailed ? 2.5 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute rounded-full"
        style={{
          right: 0,
          top: lastY,
          width: dot,
          height: dot,
          transform: 'translateY(-50%)',
          backgroundColor: color,
          boxShadow: `0 0 0 4px ${color}26`,
        }}
      />
    </div>
  )
}
