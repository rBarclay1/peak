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
    .map((r) => Math.round(r.sleep_score))

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
        {trend.length >= 2 && <Sparkline data={trend} color={tier.color} height={40} />}
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
          <Sparkline data={trend} color={tier.color} height={42} />
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

function Sparkline({ data, color, height = 32 }) {
  const w = 100
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pad = 3
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = height - pad - ((v - min) / range) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="block"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
