import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Bike,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Footprints,
  Moon,
  Mountain,
  Plus,
  TreePine,
  Waves,
  X,
} from 'lucide-react'
import CardFrame, { EDGE_BACK_ZONE } from './CardFrame.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  getPhase,
  getSession,
  getProgramWeek,
  getChecklist,
  getDayFocus,
  formatMediumDate,
} from '../lib/training'
import { useTrainingSession } from '../hooks/useTrainingSession'
import { useActivities } from '../hooks/useActivities'
import { dayKey } from '../lib/date'

// Quick-tap activities for the logger; also drives the per-type list icons.
const QUICK_ACTIVITIES = [
  { type: 'run', label: 'Run', icon: Footprints },
  { type: 'climb', label: 'Climb', icon: Mountain },
  { type: 'gym', label: 'Gym', icon: Dumbbell },
  { type: 'bike', label: 'Bike', icon: Bike },
  { type: 'hike', label: 'Hike', icon: TreePine },
  { type: 'swim', label: 'Swim', icon: Waves },
]
const ICON_BY_TYPE = Object.fromEntries(QUICK_ACTIVITIES.map((q) => [q.type, q.icon]))

export default function ActivityCard({ date, expandedId, onExpand, onCollapse }) {
  const isExpanded = expandedId === 'activity'

  // Day browsing: 0 = today. Swipe (or the chevrons) shifts which day the
  // expanded view shows. Reset to today whenever the card closes so it always
  // reopens on the current day.
  const [offsetDays, setOffsetDays] = useState(0)
  useEffect(() => {
    if (!isExpanded) setOffsetDays(0)
  }, [isExpanded])

  // The block runs Jun 3 – Aug 10; clamp browsing to those bounds.
  const blockStart = new Date(date.getFullYear(), 5, 3)
  const blockEnd = new Date(date.getFullYear(), 7, 10)
  const viewDate = useMemo(
    () => new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays),
    [date, offsetDays],
  )
  const atStart = viewDate <= blockStart
  const atEnd = viewDate >= blockEnd

  const shiftDay = (delta) => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays + delta)
    if (next < blockStart || next > blockEnd) return
    setOffsetDays((o) => o + delta)
  }

  // Horizontal swipe → change day; ignore mostly-vertical drags (scrolling).
  const touch = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    // Leave the far-left edge to the card's back-swipe gesture.
    touch.current = t.clientX <= EDGE_BACK_ZONE ? null : { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      shiftDay(dx < 0 ? 1 : -1) // swipe left → next day, right → previous
    }
  }

  const phase = getPhase(viewDate)
  const session = getSession(viewDate)
  const week = getProgramWeek(viewDate)
  const checklist = getChecklist({ session, phase, date: viewDate })
  const dateKey = dayKey(viewDate)

  const { completedItems, completed, toggleItem, markComplete } = useTrainingSession(
    dateKey,
    session.type,
  )
  const { activities, addActivity, removeActivity } = useActivities(dateKey)

  const keys = checklist.kind === 'list' ? checklist.items.map((i) => i.key) : []
  const total = keys.length
  const done = keys.filter((k) => completedItems.includes(k)).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const isRest = session.type === 'rest'
  const focus = getDayFocus({ session, phase })
  const dayLabel =
    offsetDays === 0 ? 'Today' : offsetDays === -1 ? 'Yesterday' : formatMediumDate(viewDate)

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
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="select-none">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge className="font-semibold">Phase {phase.id}</Badge>
          <span className="truncate text-sm text-muted-foreground">
            Week {week} · {formatMediumDate(viewDate)}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {offsetDays !== 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOffsetDays(0)
              }}
              className="mr-1 rounded-full px-2.5 py-1 text-xs font-semibold text-textMuted transition hover:text-textPrimary"
            >
              Today
            </button>
          )}
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
          <DayNavButton
            aria-label="Next day"
            disabled={atEnd}
            onClick={(e) => {
              e.stopPropagation()
              shiftDay(1)
            }}
          >
            <ChevronRight />
          </DayNavButton>
        </div>
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

      {/* Manually-logged activities (e.g. an unplanned run) */}
      <div className="mt-9">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Logged</h2>
          <ActivityLogger dayLabel={dayLabel} onAdd={addActivity} />
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-textMuted">No extra activities logged.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {activities.map((a) => {
              const Icon = ICON_BY_TYPE[a.type] || Activity
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 flex-shrink-0 place-content-center rounded-full bg-secondary text-textSecondary">
                      <Icon className="size-4" />
                    </span>
                    <span className="truncate text-[15px] text-textPrimary">{a.name}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove activity"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeActivity(a.id)
                    }}
                    className="rounded-full p-1.5 text-textMuted transition-colors hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
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

// Add-activity sheet: quick-tap common options + a free-text entry.
function ActivityLogger({ onAdd, dayLabel }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const add = (activity) => {
    onAdd(activity)
    setText('')
    setOpen(false)
  }
  const addCustom = (e) => {
    e.stopPropagation()
    const name = text.trim()
    if (name) add({ name, type: 'other' })
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className="rounded-full bg-secondary/80 text-foreground hover:bg-secondary [&_svg]:size-4"
      >
        <Plus /> Add
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-border bg-card max-h-[88dvh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <SheetHeader className="px-5">
            <SheetTitle className="text-xl font-bold text-textPrimary">Log activity</SheetTitle>
            <SheetDescription className="text-textMuted">{dayLabel}</SheetDescription>
          </SheetHeader>

          <div className="px-5 pt-2">
            <h3 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">Quick add</h3>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIVITIES.map((q) => (
                <button
                  key={q.type}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    add({ name: q.label, type: q.type })
                  }}
                  className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-textPrimary transition hover:bg-accent [&_svg]:size-4"
                >
                  <q.icon /> {q.label}
                </button>
              ))}
            </div>

            <h3 className="mb-2 mt-7 text-sm uppercase tracking-widest text-muted-foreground">
              Or type it in
            </h3>
            <div className="mb-8 flex gap-2">
              <input
                type="text"
                value={text}
                placeholder='e.g. "Trail run · 5 mi"'
                onChange={(e) => setText(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustom(e)
                }}
                className="min-w-0 flex-1 rounded-xl bg-secondary px-3.5 py-3 text-base font-medium text-textPrimary outline-none placeholder:text-textMuted"
              />
              <Button
                type="button"
                onClick={addCustom}
                disabled={!text.trim()}
                className="shrink-0 rounded-xl px-5 font-semibold"
              >
                Add
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

// Round chevron used to step the expanded Activity view one day at a time.
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
