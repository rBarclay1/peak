import { useEffect, useRef, useState } from 'react'
import { Check, Moon } from 'lucide-react'
import CardFrame from './CardFrame.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  getPhase,
  getSession,
  getProgramWeek,
  getPhaseProgress,
  getChecklist,
  getDayFocus,
  formatMediumDate,
} from '../lib/training'
import { useTrainingSession } from '../hooks/useTrainingSession'
import { dayKey } from '../lib/date'

export default function ActivityCard({ date, expandedId, onExpand, onCollapse }) {
  const phase = getPhase(date)
  const session = getSession(date)
  const week = getProgramWeek(date)
  const checklist = getChecklist({ session, phase, date })
  const phaseProgress = getPhaseProgress(date, phase)
  const dateKey = dayKey(date)

  const { completedItems, completed, toggleItem, markComplete } = useTrainingSession(
    dateKey,
    session.type,
  )

  const keys = checklist.kind === 'list' ? checklist.items.map((i) => i.key) : []
  const total = keys.length
  const done = keys.filter((k) => completedItems.includes(k)).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const isRest = session.type === 'rest'
  const focus = getDayFocus({ session, phase })

  const preview = (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activity
        </span>
        <span className="text-xs font-medium text-textMuted">Week {week}</span>
      </div>

      <h2 className="mt-1 font-display text-[1.75rem] font-bold leading-tight tracking-tight text-textPrimary">
        {session.label}
      </h2>
      <p className="mt-0.5 text-[13px] font-medium leading-snug text-textSecondary">{focus}</p>

      {total > 0 ? (
        <>
          <div className="flex-1 flex flex-col justify-center gap-2.5 overflow-hidden py-2">
            {checklist.items.map((item) => (
              <CheckRow
                key={item.key}
                label={item.label}
                checked={completedItems.includes(item.key)}
                onToggle={() => toggleItem(item.key)}
              />
            ))}
          </div>

          <div>
            <CompletionBar pct={pct} done={done} />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-textMuted">Phase {phase.id}</span>
              <span className="text-xs font-medium text-textMuted">
                {done} of {total}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-textMuted">
          <Moon className="size-8" />
        </div>
      )}
    </div>
  )

  const expanded = (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Badge className="font-semibold">Phase {phase.id}</Badge>
        <span className="text-sm text-muted-foreground">
          Week {week} · {formatMediumDate(date)}
        </span>
      </div>
      <h1 className="font-display text-5xl font-extrabold tracking-tight text-textPrimary">
        {session.label}
      </h1>
      <p className="mt-1.5 text-[15px] font-medium text-textSecondary">{focus}</p>

      {total > 0 && (
        <div className="mt-5 mb-7">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {done} of {total} complete
            </span>
            <span className="text-sm font-semibold text-green">{pct}%</span>
          </div>
          <CompletionBar pct={pct} done={done} className="h-2" />
        </div>
      )}

      {checklist.kind === 'text' && (
        <p className="text-muted-foreground text-2xl text-center py-16 leading-relaxed">
          {checklist.text}
        </p>
      )}

      {checklist.kind === 'list' && (
        <ul className="flex flex-col divide-y divide-border">
          {checklist.items.map((item) => (
            <CheckRow
              key={item.key}
              as="li"
              size="lg"
              label={item.label}
              detail={item.detail}
              checked={completedItems.includes(item.key)}
              onToggle={() => toggleItem(item.key)}
            />
          ))}
        </ul>
      )}

      {!isRest && (
        <div className="mt-8">
          <Button
            type="button"
            size="lg"
            onClick={(e) => {
              e.stopPropagation()
              markComplete()
            }}
            disabled={completed}
            className={cn(
              'w-full h-auto py-3.5 text-base font-semibold rounded-2xl',
              completed && 'bg-green text-background disabled:opacity-100',
            )}
          >
            {completed ? (
              <>
                <Check className="size-5" /> Session complete
              </>
            ) : (
              'Mark Complete'
            )}
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <CardFrame
      id="activity"
      expandedId={expandedId}
      onExpand={onExpand}
      onCollapse={onCollapse}
      preview={preview}
      expanded={expanded}
    />
  )
}

// Slim completion bar, green fill (reads as "done").
function CompletionBar({ pct, done, className }) {
  return (
    <Progress
      value={pct}
      className={cn(
        'h-1.5 bg-secondary',
        done > 0 && '[&>[data-slot=progress-indicator]]:bg-green',
        className,
      )}
    />
  )
}

// Reminders-style row: a circular check that fills + pops when tapped.
// `detail` is only rendered in the expanded (lg) view, never the preview.
function CheckRow({ label, detail, checked, onToggle, size = 'sm', as = 'button' }) {
  const big = size === 'lg'
  const inner = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn('w-full flex items-center text-left', big ? 'gap-3.5 py-3.5' : 'gap-2.5')}
    >
      <CheckCircle checked={checked} size={size} />
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            'truncate text-textPrimary transition-all duration-200',
            big ? 'text-[17px] font-medium' : 'text-sm',
            checked && (big ? 'text-textMuted line-through' : 'line-through opacity-40'),
          )}
        >
          {label}
        </span>
        {big && detail && (
          <span className={cn('mt-0.5 text-[13px] text-textMuted', checked && 'line-through opacity-60')}>
            {detail}
          </span>
        )}
      </span>
    </button>
  )
  return as === 'li' ? <li>{inner}</li> : inner
}

function CheckCircle({ checked, size = 'sm' }) {
  const big = size === 'lg'
  const [pop, setPop] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (checked) {
      setPop(true)
      const t = setTimeout(() => setPop(false), 200)
      return () => clearTimeout(t)
    }
  }, [checked])

  return (
    <span
      className={cn(
        'flex-shrink-0 grid place-content-center rounded-full border-2',
        big ? 'size-[26px]' : 'size-[22px]',
        checked ? 'border-green bg-green text-background' : 'border-textMuted',
      )}
      style={{
        transform: pop ? 'scale(1.18)' : 'scale(1)',
        transition:
          'transform .2s cubic-bezier(0.34,1.56,0.64,1), background-color .2s ease, border-color .2s ease',
      }}
    >
      {checked && <Check className={cn(big ? 'size-4' : 'size-3', 'stroke-[3.5]')} />}
    </span>
  )
}
