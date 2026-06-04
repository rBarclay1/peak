import { useEffect, useRef, useState } from 'react'
import { Moon } from 'lucide-react'
import CardFrame from './CardFrame.jsx'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { computeRecovery } from '../lib/training'
import { useGarmin } from '../hooks/useGarmin'

const STAGE_COLORS = { Deep: '#5e5ce6', Core: '#0a84ff', REM: '#5ac8fa', Awake: '#ff9f0a' }

function fmtDur(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

// Sleep quality tier from the 0–100 score.
function sleepTier(score) {
  if (score >= 85) return { label: 'Optimal', color: '#30d158' }
  if (score >= 70) return { label: 'Good', color: '#5ac8fa' }
  if (score >= 50) return { label: 'Fair', color: '#ffd60a' }
  return { label: 'Poor', color: '#ff453a' }
}

function stagesFromRow(row) {
  const mins = {
    Deep: row.sleep_deep_min,
    Core: row.sleep_light_min,
    REM: row.sleep_rem_min,
    Awake: row.sleep_awake_min,
  }
  const stages = Object.entries(mins)
    .filter(([, m]) => m != null)
    .map(([key, min]) => ({ key, min }))
  return stages.length ? stages : null
}

export default function RecoveryCard({ expandedId, onExpand, onCollapse }) {
  const rows = useGarmin()
  const latest = rows.length ? rows[rows.length - 1] : null
  const isLive = !!(latest && latest.sleep_score != null)

  if (!isLive) {
    const empty = (
      <div className="h-full flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sleep
        </span>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <Moon className="size-7 text-textMuted" />
          <span className="text-sm font-medium text-textMuted">No sleep data yet</span>
        </div>
      </div>
    )
    const emptyExpanded = (
      <div>
        <h1 className="text-3xl font-bold text-textPrimary">Sleep</h1>
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <Moon className="size-10 text-textMuted" />
          <p className="text-base font-medium text-textSecondary">No sleep data yet</p>
          <p className="max-w-[18rem] text-sm text-textMuted">
            Sync your Garmin to see sleep, HRV, and recovery here. Run{' '}
            <span className="font-mono text-textSecondary">scripts/garmin_sync.py</span>.
          </p>
        </div>
      </div>
    )
    return (
      <CardFrame
        id="recovery"
        expandedId={expandedId}
        onExpand={onExpand}
        onCollapse={onCollapse}
        preview={empty}
        expanded={emptyExpanded}
      />
    )
  }

  const sleepScore = Math.round(latest.sleep_score)
  const hrv = latest.hrv_score != null ? Math.round(latest.hrv_score) : null
  const stages = stagesFromRow(latest)
  const totalMin = stages
    ? stages.reduce((s, x) => s + x.min, 0)
    : latest.sleep_duration_hours != null
      ? Math.round(latest.sleep_duration_hours * 60)
      : null
  const recovery = hrv != null ? computeRecovery(hrv, sleepScore) : null
  const tier = sleepTier(sleepScore)
  const trend = rows
    .filter((r) => r.sleep_score != null)
    .slice(-7)
    .map((r) => ({ score: Math.round(r.sleep_score), day: weekdayLabel(r.date) }))

  const preview = (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sleep
        </span>
        {totalMin != null && <span className="text-xs font-medium text-textMuted">{fmtDur(totalMin)}</span>}
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-[2.5rem] font-extrabold leading-none tracking-tight text-textPrimary">
          {sleepScore}
        </span>
        <span className="text-sm font-semibold" style={{ color: tier.color }}>
          {tier.label}
        </span>
      </div>

      {stages && totalMin ? (
        <div className="mt-3">
          <StagesBar stages={stages} total={totalMin} className="h-2" />
        </div>
      ) : null}

      <div className="flex-1 flex items-center min-h-0 mt-3">
        {trend.length >= 2 && <SleepTrend data={trend} color={tier.color} compact />}
      </div>

      <div className="flex items-center gap-4 pt-1 text-xs text-textMuted">
        {recovery != null && (
          <span>
            Recovery <span className="font-semibold text-textSecondary">{recovery}</span>
          </span>
        )}
        {hrv != null && (
          <span>
            HRV <span className="font-semibold text-textSecondary">{hrv}</span>
          </span>
        )}
      </div>
    </div>
  )

  const expanded = (
    <div>
      <h1 className="text-3xl font-bold text-textPrimary">Sleep</h1>

      <div className="mt-4 flex items-end gap-3">
        <span className="font-display text-7xl font-extrabold leading-none tracking-tight text-textPrimary">
          {sleepScore}
        </span>
        <div className="mb-1.5">
          <div className="text-lg font-semibold" style={{ color: tier.color }}>
            {tier.label}
          </div>
          {totalMin != null && <div className="text-sm text-textMuted">{fmtDur(totalMin)} in bed</div>}
        </div>
      </div>

      {/* Sleep stages */}
      {stages && totalMin ? (
        <div className="mt-7">
          <StagesBar stages={stages} total={totalMin} className="h-4" />
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
            {stages.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.key] }} />
                <span className="flex-1 text-sm text-textSecondary">{s.key}</span>
                <span className="stat text-sm text-textPrimary">{fmtDur(s.min)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 7-night trend */}
      {trend.length >= 2 && (
        <div className="mt-9">
          <h2 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">
            Last 7 nights
          </h2>
          <SleepTrend data={trend} color={tier.color} />
        </div>
      )}

      {/* Secondary stats */}
      <div className="mt-9 grid grid-cols-2 gap-3">
        {recovery != null && <StatCard label="Recovery" value={String(recovery)} />}
        {hrv != null && <StatCard label="HRV" value={`${hrv}ms`} />}
      </div>

      <p className="mt-9 text-xs text-textMuted">Synced from Garmin Connect</p>
    </div>
  )

  return (
    <CardFrame
      id="recovery"
      expandedId={expandedId}
      onExpand={onExpand}
      onCollapse={onCollapse}
      preview={preview}
      expanded={expanded}
    />
  )
}

// Proportional Deep/Core/REM/Awake bar.
function StagesBar({ stages, total, className }) {
  return (
    <div className={cn('flex w-full overflow-hidden rounded-full bg-secondary', className)}>
      {stages.map((s) => (
        <div
          key={s.key}
          style={{ width: `${(s.min / total) * 100}%`, backgroundColor: STAGE_COLORS[s.key] }}
        />
      ))}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <Card className="bg-background gap-0 py-4 px-3 flex flex-col items-center">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="stat text-3xl mt-1 text-textPrimary">{value}</span>
    </Card>
  )
}

// Short weekday label ("Thu") from a 'YYYY-MM-DD' string. Parsed as a local
// date (not UTC) so the weekday matches the calendar day the row is keyed to.
function weekdayLabel(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
}

// Tracks the rendered pixel width so chart points are computed in real space —
// keeps dots circular instead of stretched by an SVG viewBox.
function useMeasuredWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// Sleep-score trend with a soft area-gradient fill, line, and (in full mode)
// a dot, value, and weekday label at every night. `compact` is the preview
// glance version: just the filled line with the latest night marked.
function SleepTrend({ data, color, compact = false }) {
  const [ref, w] = useMeasuredWidth()
  const H = compact ? 44 : 150
  const padX = compact ? 4 : 16
  const padTop = compact ? 6 : 22
  const padBottom = compact ? 6 : 24

  const scores = data.map((d) => d.score)
  const max = Math.max(...scores)
  const min = Math.min(...scores)
  const range = max - min || 1
  const innerW = Math.max(1, w - padX * 2)
  const plotH = Math.max(1, H - padTop - padBottom)
  const baseY = padTop + plotH

  const px = (i) => padX + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const py = (s) => padTop + (1 - (s - min) / range) * plotH
  const pts = data.map((d, i) => ({ x: px(i), y: py(d.score), ...d }))

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const area = `${line} L${last.x.toFixed(1)},${baseY} L${pts[0].x.toFixed(1)},${baseY} Z`
  const gid = `sleepgrad-${compact ? 'c' : 'f'}-${color.replace('#', '')}`

  return (
    <div ref={ref} className="w-full">
      {w > 0 && (
        <svg width={w} height={H} className="block overflow-visible">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {!compact && (
            <line x1={padX} x2={w - padX} y1={baseY} y2={baseY} stroke="var(--color-border)" strokeWidth="1" />
          )}

          <path d={area} fill={`url(#${gid})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={compact ? 1.75 : 2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {compact ? (
            <circle cx={last.x} cy={last.y} r="2.75" fill={color} />
          ) : (
            pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="3.5" fill={color} stroke="var(--color-card)" strokeWidth="2" />
                <text
                  x={p.x}
                  y={p.y - 9}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--color-textSecondary)"
                >
                  {p.score}
                </text>
                <text x={p.x} y={baseY + 16} textAnchor="middle" fontSize="10" fill="var(--color-textMuted)">
                  {p.day}
                </text>
              </g>
            ))
          )}
        </svg>
      )}
    </div>
  )
}
