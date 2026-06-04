import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Moon, RefreshCw } from 'lucide-react'
import CardFrame, { EDGE_BACK_ZONE } from './CardFrame.jsx'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dayKey } from '../lib/date'
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

// Display values for one Garmin row's sleep; null when the day has no sleep.
function deriveSleep(row) {
  if (!row || row.sleep_score == null) return null
  const sleepScore = Math.round(row.sleep_score)
  const hrv = row.hrv_score != null ? Math.round(row.hrv_score) : null
  const stages = stagesFromRow(row)
  const totalMin = stages
    ? stages.reduce((s, x) => s + x.min, 0)
    : row.sleep_duration_hours != null
      ? Math.round(row.sleep_duration_hours * 60)
      : null
  const recovery = hrv != null ? computeRecovery(hrv, sleepScore) : null
  const tier = sleepTier(sleepScore)
  return { sleepScore, hrv, stages, totalMin, recovery, tier }
}

// Round chevron used to step the expanded Sleep view one day at a time.
function DayNavButton({ children, disabled, onClick, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-8 place-content-center rounded-full bg-secondary/80 text-foreground transition',
        'hover:bg-secondary disabled:opacity-30 disabled:hover:bg-secondary/80 [&_svg]:size-5',
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export default function RecoveryCard({ expandedId, onExpand, onCollapse }) {
  const { rows, refetch } = useGarmin()
  const isExpanded = expandedId === 'recovery'

  // Day browsing in the expanded view. 0 = today; reset on collapse.
  const [dayOffset, setDayOffset] = useState(0)
  useEffect(() => {
    if (!isExpanded) setDayOffset(0)
  }, [isExpanded])

  const today = new Date()
  const viewDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset)
  const blockStart = new Date(today.getFullYear(), 5, 3) // Jun 3
  const atStart = viewDate <= blockStart
  const shiftDay = (delta) => {
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset + delta)
    if (next < blockStart || next > today) return
    setDayOffset((o) => o + delta)
  }
  const dayLabel =
    dayOffset === 0
      ? 'Today'
      : dayOffset === -1
        ? 'Yesterday'
        : viewDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  // Horizontal swipe changes the day; the far-left edge is left to the card's
  // back gesture, and mostly-vertical drags (scrolling) are ignored.
  const touch = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = t.clientX <= EDGE_BACK_ZONE ? null : { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftDay(dx < 0 ? 1 : -1)
  }

  const sleepRows = rows.filter((r) => r.sleep_score != null)
  const previewData = sleepRows.length ? deriveSleep(sleepRows[sleepRows.length - 1]) : null
  const cur = deriveSleep(rows.find((r) => r.date === dayKey(viewDate)) || null)
  const trend = sleepRows
    .slice(-7)
    .map((r) => ({ score: Math.round(r.sleep_score), day: weekdayLabel(r.date) }))

  if (!previewData) {
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-textPrimary">Sleep</h1>
          <GarminSync onSynced={refetch} label="Sync now" />
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <Moon className="size-10 text-textMuted" />
          <p className="text-base font-medium text-textSecondary">No sleep data yet</p>
          <p className="max-w-[18rem] text-sm text-textMuted">
            Sync your Garmin to see sleep, HRV, and recovery here.
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

  const { sleepScore, hrv, stages, totalMin, recovery, tier } = previewData

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
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-textPrimary">Sleep</h1>
        <GarminSync onSynced={refetch} />
      </div>

      {/* Day navigation */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <DayNavButton
          aria-label="Previous day"
          disabled={atStart}
          onClick={(e) => {
            e.stopPropagation()
            shiftDay(-1)
          }}
        >
          <ChevronLeft />
        </DayNavButton>
        <button
          type="button"
          disabled={dayOffset === 0}
          onClick={(e) => {
            e.stopPropagation()
            setDayOffset(0)
          }}
          className="text-sm font-semibold text-textSecondary transition hover:text-textPrimary disabled:text-textMuted"
        >
          {dayLabel}
        </button>
        <DayNavButton
          aria-label="Next day"
          disabled={dayOffset >= 0}
          onClick={(e) => {
            e.stopPropagation()
            shiftDay(1)
          }}
        >
          <ChevronRight />
        </DayNavButton>
      </div>

      {cur ? (
        <>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-display text-7xl font-extrabold leading-none tracking-tight text-textPrimary">
              {cur.sleepScore}
            </span>
            <div className="mb-1.5">
              <div className="text-lg font-semibold" style={{ color: cur.tier.color }}>
                {cur.tier.label}
              </div>
              {cur.totalMin != null && (
                <div className="text-sm text-textMuted">{fmtDur(cur.totalMin)} in bed</div>
              )}
            </div>
          </div>

          {/* Sleep stages */}
          {cur.stages && cur.totalMin ? (
            <div className="mt-7">
              <StagesBar stages={cur.stages} total={cur.totalMin} className="h-4" />
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                {cur.stages.map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.key] }} />
                    <span className="flex-1 text-sm text-textSecondary">{s.key}</span>
                    <span className="stat text-sm text-textPrimary">{fmtDur(s.min)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Secondary stats */}
          <div className="mt-9 grid grid-cols-2 gap-3">
            {cur.recovery != null && <StatCard label="Recovery" value={String(cur.recovery)} />}
            {cur.hrv != null && <StatCard label="HRV" value={`${cur.hrv}ms`} />}
          </div>
        </>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <Moon className="size-10 text-textMuted" />
          <p className="text-base font-medium text-textSecondary">No sleep logged</p>
          <p className="text-sm text-textMuted">
            Nothing for {dayLabel.toLowerCase()} — swipe to another day or sync.
          </p>
        </div>
      )}

      {/* 7-night trend */}
      {trend.length >= 2 && (
        <div className="mt-9">
          <h2 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">
            Last 7 nights
          </h2>
          <SleepTrend data={trend} color={tier.color} />
        </div>
      )}

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

// Manually trigger the Garmin sync (in addition to the scheduled cron), then
// reload the card's data once it finishes.
function GarminSync({ onSynced, label = 'Sync' }) {
  const [state, setState] = useState('idle') // idle | syncing | done | error

  const run = async (e) => {
    e.stopPropagation()
    if (state === 'syncing') return
    setState('syncing')
    try {
      const res = await fetch('/api/garmin-sync', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data.error || `Error ${res.status}`)
      await onSynced?.()
      setState('done')
    } catch {
      setState('error')
    }
    setTimeout(() => setState('idle'), 2500)
  }

  const text = { idle: label, syncing: 'Syncing…', done: 'Synced', error: 'Failed' }[state]

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={run}
      disabled={state === 'syncing'}
      className="rounded-full bg-secondary/80 text-foreground hover:bg-secondary [&_svg]:size-4"
    >
      <RefreshCw className={cn(state === 'syncing' && 'animate-spin')} /> {text}
    </Button>
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
