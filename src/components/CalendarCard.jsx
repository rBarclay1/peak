import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Moon,
  NotebookPen,
  Pencil,
  RotateCcw,
  Scale,
} from 'lucide-react'
import CardFrame from './CardFrame.jsx'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { supabase } from '../lib/supabase'
import {
  getPhase,
  getProgramWeek,
  getSession,
  getChecklist,
  getDayFocus,
  formatLongDate,
  getDayOverride,
  getDefaultDayCode,
  getDayCode,
  dayTypeLabel,
  DAY_TYPES,
  WEEKDAYS,
  PHASE_LIST,
  getPhasePattern,
  isPhasePatternCustom,
} from '../lib/training'
import { sleepQuality, fmtDur } from '../lib/dayStats'
import { dayKey } from '../lib/date'
import { useJournal } from '../hooks/useJournal'
import { useWeight } from '../hooks/useWeight'
import { useSchedule } from '../hooks/useSchedule'
import { GOALS } from '../hooks/useNutrition'

// Distinct accent per session type, used by the schedule editors.
const TYPE_COLOR = {
  C: '#0a84ff',
  CH: '#5e5ce6',
  CP: '#bf5af2',
  G: '#ff9f0a',
  R: '#30d158',
  X: '#98989f',
}

const PLACEHOLDER_USER = 'placeholder-user'
// The block runs Wed → Tue, so the grid columns read W T F S S M T.
const WEEK_LABELS = ['W', 'T', 'F', 'S', 'S', 'M', 'T']
const PHASE_DIVIDERS = {
  1: 'Phase I · Base',
  4: 'Phase II · Strength',
  8: 'Phase III · Sends',
}

const atMid = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const STATUS = {
  today: { label: 'Today', color: '#0a84ff' },
  completed: { label: 'Completed', color: '#30d158' },
  rest: { label: 'Rest day', color: '#98989f' },
  future: { label: 'Upcoming', color: '#636366' },
}

export default function CalendarCard({ expandedId, onExpand, onCollapse }) {
  const today = new Date()
  const tMid = atMid(today)
  const phase = getPhase(today)
  const week = getProgramWeek(today)
  const progStart = new Date(today.getFullYear(), 5, 3) // Jun 3 (Wed — block start)
  const blockEnd = new Date(today.getFullYear(), 7, 10) // Aug 10 (block end)

  const { entries: journalEntries } = useJournal()
  const { entries: weightEntries, unit: weightUnit } = useWeight()
  const { setDayCode, resetDay, savePhasePattern, resetPhasePattern } = useSchedule()
  const [selected, setSelected] = useState(null) // selected Date for the sheet
  const [editingSchedule, setEditingSchedule] = useState(false) // phase-pattern sheet

  // Step the day-detail sheet to the previous/next day, clamped to the block.
  const shiftSelected = (delta) =>
    setSelected((cur) => {
      if (!cur) return cur
      const next = addDays(cur, delta)
      return next < progStart || next > blockEnd ? cur : next
    })

  // Horizontal swipe inside the sheet moves between days.
  const touch = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftSelected(dx < 0 ? 1 : -1)
  }

  // Completed days from Supabase; past non-rest days are placeholder-complete.
  const [completed, setCompleted] = useState(() => new Set())
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('date')
        .eq('user_id', PLACEHOLDER_USER)
        .eq('completed', true)
      if (!active || error || !data) return
      setCompleted(new Set(data.map((r) => r.date)))
    })()
    return () => {
      active = false
    }
  }, [])

  const stateOf = (date) => {
    if (sameDay(date, today)) return 'today'
    // Rest + run days are recovery days — shown grey, not counted as sessions.
    const t = getSession(date).type
    if (t === 'rest' || t === 'restrun') return 'rest'
    if (date < tMid || completed.has(dayKey(date))) return 'completed'
    return 'future'
  }

  // Build the 10-week × 7-day block.
  const weeks = Array.from({ length: 10 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => {
      const date = addDays(progStart, wi * 7 + di)
      return { date, state: stateOf(date) }
    }),
  )
  const flat = weeks.flat()
  const totalSessions = flat.filter((c) => c.state !== 'rest').length
  const doneCount = flat.filter((c) => c.state === 'completed').length

  const preview = (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Calendar
        </span>
        <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-xs font-normal text-muted-foreground">
          Phase {phase.id}
        </Badge>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
          {flat.map((c, i) => (
            <Cell key={i} state={c.state} className="w-[9px] h-[9px]" />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-textMuted">
          <span className="font-semibold text-textSecondary">{doneCount}</span> of {totalSessions}
        </span>
        <span className="text-textMuted">Week {week} of 10</span>
      </div>
    </div>
  )

  const expanded = (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-textPrimary">
          Summer Block <span className="font-normal text-muted-foreground">· Jun 3 – Aug 10</span>
        </h1>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setEditingSchedule(true)
          }}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-textSecondary transition hover:bg-secondary hover:text-textPrimary [&_svg]:size-3.5"
        >
          <Pencil /> Edit plan
        </button>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-5xl font-extrabold tracking-tight text-textPrimary">
          {doneCount}
        </span>
        <span className="text-sm text-textMuted">
          of {totalSessions} sessions · Week {week} of 10
        </span>
      </div>
      <p className="mt-1 text-xs text-textMuted">Tap any day for its stats</p>

      {/* Day-of-week header */}
      <div className="mt-8 flex items-center gap-3">
        <span className="w-16 flex-shrink-0" />
        <div className="flex items-center gap-3">
          {WEEK_LABELS.map((l, i) => (
            <span key={i} className="w-6 text-center text-[11px] font-medium text-textMuted">
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Heatmap rows */}
      <div className="mt-2">
        {weeks.map((days, wi) => {
          const w = wi + 1
          return (
            <div key={w}>
              {PHASE_DIVIDERS[w] && (
                <div className="mt-4 mb-1.5 text-xs font-semibold uppercase tracking-wider text-textMuted">
                  {PHASE_DIVIDERS[w]}
                </div>
              )}
              <div className="flex items-center gap-3 py-1.5">
                <span className="w-16 flex-shrink-0 text-xs text-muted-foreground">Week {w}</span>
                <div className="flex items-center gap-3">
                  {days.map((c, i) => (
                    <Cell
                      key={i}
                      state={c.state}
                      className="size-6 rounded-[5px]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(c.date)
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
        <LegendItem state="completed" label="Done" />
        <LegendItem state="today" label="Today" />
        <LegendItem state="rest" label="Rest" />
        <LegendItem state="future" label="Upcoming" />
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-border bg-card max-h-[88dvh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {selected && (
            <DayDetail
              date={selected}
              state={stateOf(selected)}
              today={today}
              journalEntries={journalEntries}
              weightEntries={weightEntries}
              weightUnit={weightUnit}
              onPrev={() => shiftSelected(-1)}
              onNext={() => shiftSelected(1)}
              canPrev={selected > progStart}
              canNext={selected < blockEnd}
              onSetDay={setDayCode}
              onResetDay={resetDay}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={editingSchedule} onOpenChange={setEditingSchedule}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-border bg-card max-h-[88dvh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <ScheduleEditor onSave={savePhasePattern} onReset={resetPhasePattern} />
        </SheetContent>
      </Sheet>
    </div>
  )

  return (
    <CardFrame
      id="calendar"
      expandedId={expandedId}
      onExpand={onExpand}
      onCollapse={onCollapse}
      preview={preview}
      expanded={expanded}
      noScroll
    />
  )
}

function DayDetail({
  date,
  state,
  today,
  journalEntries,
  weightEntries,
  weightUnit,
  onPrev,
  onNext,
  canPrev,
  canNext,
  onSetDay,
  onResetDay,
}) {
  const key = dayKey(date)
  const phase = getPhase(date)
  const week = getProgramWeek(date)
  const session = getSession(date)
  const focus = getDayFocus({ session, phase })
  const checklist = getChecklist({ session, phase, date, week })
  const status = STATUS[state]

  const [editing, setEditing] = useState(false)
  useEffect(() => setEditing(false), [key]) // close the editor when the day changes
  const currentCode = getDayCode(date)
  const override = getDayOverride(date)
  const defaultCode = getDefaultDayCode(date)

  // Real per-day sleep (Garmin) and fuel (nutrition log) for this date.
  const [sleep, setSleep] = useState(null) // { score, durationMin } | null
  const [fuel, setFuel] = useState(null) // { calories, protein } | null
  useEffect(() => {
    let active = true
    ;(async () => {
      const [g, n] = await Promise.all([
        supabase
          .from('garmin_data')
          .select('sleep_score, sleep_duration_hours')
          .eq('user_id', PLACEHOLDER_USER)
          .eq('date', key)
          .maybeSingle(),
        supabase
          .from('nutrition_logs')
          .select('calories, protein_g')
          .eq('user_id', PLACEHOLDER_USER)
          .eq('date', key),
      ])
      if (!active) return
      if (g.data && g.data.sleep_score != null) {
        setSleep({
          score: Math.round(g.data.sleep_score),
          durationMin: g.data.sleep_duration_hours != null ? Math.round(g.data.sleep_duration_hours * 60) : null,
        })
      } else {
        setSleep(null)
      }
      if (n.data && n.data.length) {
        setFuel({
          calories: Math.round(n.data.reduce((s, r) => s + (Number(r.calories) || 0), 0)),
          protein: Math.round(n.data.reduce((s, r) => s + (Number(r.protein_g) || 0), 0)),
        })
      } else {
        setFuel(null)
      }
    })()
    return () => {
      active = false
    }
  }, [key])
  const quality = sleep ? sleepQuality(sleep.score) : null
  const journalEntry = journalEntries.find((e) => e.date === key)
  const weightEntry = weightEntries.find((e) => e.date === key)

  return (
    <>
      <SheetHeader className="px-5">
        <div className="flex items-center justify-between gap-2">
          <DayNavButton aria-label="Previous day" disabled={!canPrev} onClick={onPrev}>
            <ChevronLeft />
          </DayNavButton>
          <div className="flex min-w-0 flex-1 flex-col items-center text-center">
            <SheetTitle className="truncate text-xl font-bold text-textPrimary">
              {formatLongDate(date)}
            </SheetTitle>
            <span
              className="mt-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ color: status.color, backgroundColor: `${status.color}1f` }}
            >
              {status.label}
            </span>
          </div>
          <DayNavButton aria-label="Next day" disabled={!canNext} onClick={onNext}>
            <ChevronRight />
          </DayNavButton>
        </div>
        <SheetDescription className="text-center text-textMuted">
          Phase {phase.id} · Week {week} of 10
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-7 px-5 pb-8 pt-2">
        {/* Activity */}
        <Section icon={Dumbbell} title="Activity" color="#30d158">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-lg font-semibold text-textPrimary">{session.label}</span>
              {override && (
                <span className="ml-2 align-middle text-[11px] font-semibold text-[#0a84ff]">Edited</span>
              )}
              <span className="block text-sm text-textMuted">{focus}</span>
            </div>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-textSecondary transition hover:bg-secondary hover:text-textPrimary [&_svg]:size-3.5"
            >
              <Pencil /> {editing ? 'Done' : 'Edit'}
            </button>
          </div>

          {editing && (
            <div className="mt-3 rounded-2xl bg-background/60 p-3">
              <DayTypePicker
                value={currentCode}
                onPick={(code) => {
                  if (code === defaultCode) onResetDay(key)
                  else onSetDay(key, code)
                  setEditing(false)
                }}
              />
              {override && (
                <button
                  type="button"
                  onClick={() => {
                    onResetDay(key)
                    setEditing(false)
                  }}
                  className="mt-3 flex items-center gap-1.5 text-xs font-medium text-textMuted transition hover:text-textPrimary [&_svg]:size-3.5"
                >
                  <RotateCcw /> Reset to plan default · {dayTypeLabel(defaultCode)}
                </button>
              )}
            </div>
          )}

          {checklist.kind === 'list' && (
            <ul className="mt-2 flex flex-col gap-2">
              {checklist.items.map((item) => (
                <PlanItem
                  key={item.key}
                  label={item.label}
                  detail={item.detail}
                  done={state === 'completed'}
                />
              ))}
            </ul>
          )}
          {checklist.kind === 'text' && (
            <p className="mt-1 text-sm text-textSecondary">{checklist.text}</p>
          )}
        </Section>

        {/* Sleep */}
        <Section icon={Moon} title="Sleep" color="#5ac8fa">
          {!sleep ? (
            <NotLogged />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold tracking-tight text-textPrimary">
                {sleep.score}
              </span>
              <span className="text-sm font-semibold" style={{ color: quality.color }}>
                {quality.label}
              </span>
              {sleep.durationMin != null && (
                <span className="ml-auto text-sm text-textMuted">{fmtDur(sleep.durationMin)} in bed</span>
              )}
            </div>
          )}
        </Section>

        {/* Fuel */}
        <Section icon={Flame} title="Fuel" color="#ff9f0a">
          {!fuel ? (
            <NotLogged />
          ) : (
            <div className="flex flex-col gap-1.5">
              <StatRow label="Protein" value={`${fuel.protein} / ${GOALS.protein} g`} color="#ff375f" />
              <StatRow
                label="Calories"
                value={`${fuel.calories.toLocaleString()} / ${GOALS.calories.toLocaleString()}`}
                color="#ff9f0a"
              />
            </div>
          )}
        </Section>

        {/* Weight */}
        <Section icon={Scale} title="Weight" color="#5ac8fa">
          {weightEntry ? (
            <span className="font-display text-2xl font-extrabold tracking-tight text-textPrimary">
              {weightEntry.weight}
              <span className="ml-1 text-base font-semibold text-textMuted">{weightUnit}</span>
            </span>
          ) : (
            <NotLogged />
          )}
        </Section>

        {/* Journal */}
        <Section icon={NotebookPen} title="Journal" color="#bf5af2">
          {journalEntry ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-textPrimary">
              {journalEntry.entry_text}
            </p>
          ) : (
            <p className="text-sm text-textMuted">No entry</p>
          )}
        </Section>
      </div>
    </>
  )
}

// Round chevron to step the day-detail sheet one day at a time.
function DayNavButton({ children, disabled, onClick, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-9 flex-shrink-0 place-content-center rounded-full bg-secondary/80 text-foreground transition',
        'hover:bg-secondary disabled:opacity-30 disabled:hover:bg-secondary/80 [&_svg]:size-5',
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function Section({ icon: Icon, title, color, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4" style={{ color }} />
        <span className="text-xs font-semibold uppercase tracking-wider text-textSecondary">
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function StatRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-textSecondary">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="stat text-sm text-textPrimary">{value}</span>
    </div>
  )
}

function PlanItem({ label, detail, done }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cn(
          'mt-1 size-3.5 flex-shrink-0 rounded-full border-2',
          done ? 'border-green bg-green' : 'border-textMuted',
        )}
      />
      <span className="flex flex-col">
        <span className={cn('text-[15px]', done ? 'text-textMuted line-through' : 'text-textPrimary')}>
          {label}
        </span>
        {detail && <span className="text-[13px] text-textMuted">{detail}</span>}
      </span>
    </li>
  )
}

function NotLogged() {
  return <p className="text-sm text-textMuted">Not logged</p>
}

// Row of the six session types; the current one is filled, the rest tinted.
function DayTypePicker({ value, onPick }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DAY_TYPES.map((t) => {
        const active = t.code === value
        const color = TYPE_COLOR[t.code]
        return (
          <button
            key={t.code}
            type="button"
            onClick={() => onPick(t.code)}
            className="rounded-full px-3 py-1.5 text-sm font-semibold transition"
            style={active ? { backgroundColor: color, color: '#fff' } : { backgroundColor: `${color}1f`, color }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// Phase-pattern sheet: one editable Wed→Tue template per phase.
function ScheduleEditor({ onSave, onReset }) {
  return (
    <>
      <SheetHeader className="px-5">
        <SheetTitle className="text-xl font-bold text-textPrimary">Edit plan</SheetTitle>
        <SheetDescription className="text-textMuted">
          Set the weekly pattern for each phase. Tap a day to change its session.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-7 px-5 pb-8 pt-3">
        {PHASE_LIST.map((p) => (
          <PhasePatternEditor key={p.id} phase={p} onSave={onSave} onReset={onReset} />
        ))}
        <p className="text-xs leading-relaxed text-textMuted">
          Patterns apply to the normal weeks of each phase — deload and peak weeks keep their own
          reduced or intensified schedules. To change one specific date, tap that day on the calendar.
        </p>
      </div>
    </>
  )
}

function PhasePatternEditor({ phase, onSave, onReset }) {
  const pattern = getPhasePattern(phase.id)
  const custom = isPhasePatternCustom(phase.id)
  const [openDay, setOpenDay] = useState(null)

  const setDay = (weekday, code) => {
    onSave(phase.id, { ...pattern, [weekday]: code })
    setOpenDay(null)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-textPrimary">{phase.name}</span>
        {custom && (
          <button
            type="button"
            onClick={() => {
              onReset(phase.id)
              setOpenDay(null)
            }}
            className="flex items-center gap-1 text-xs font-medium text-textMuted transition hover:text-textPrimary [&_svg]:size-3"
          >
            <RotateCcw /> Reset
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((wd) => {
          const code = pattern[wd]
          const color = TYPE_COLOR[code]
          const active = openDay === wd
          const dt = DAY_TYPES.find((t) => t.code === code)
          return (
            <button
              key={wd}
              type="button"
              onClick={() => setOpenDay(active ? null : wd)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl py-2 transition',
                active && 'ring-2 ring-foreground ring-inset',
              )}
              style={{ backgroundColor: `${color}1f` }}
            >
              <span className="text-[10px] font-medium text-textMuted">{wd}</span>
              <span className="text-[11px] font-semibold leading-tight" style={{ color }}>
                {dt?.short}
              </span>
            </button>
          )
        })}
      </div>
      {openDay && (
        <div className="mt-2.5 rounded-2xl bg-background/60 p-3">
          <p className="mb-2 text-xs font-medium text-textMuted">{openDay}</p>
          <DayTypePicker value={pattern[openDay]} onPick={(code) => setDay(openDay, code)} />
        </div>
      )}
    </div>
  )
}

const CELL_STYLES = {
  completed: 'bg-green',
  rest: 'bg-secondary',
  future: 'bg-secondary/40',
  today: 'bg-foreground/25 ring-2 ring-foreground ring-inset',
}

function Cell({ state, className, onClick }) {
  const cls = cn('rounded-[2px]', CELL_STYLES[state], className)
  if (onClick) {
    return (
      <button
        type="button"
        aria-label="View day"
        onClick={onClick}
        className={cn(cls, 'cursor-pointer transition hover:ring-2 hover:ring-foreground/50 hover:ring-inset')}
      />
    )
  }
  return <span className={cls} />
}

function LegendItem({ state, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <Cell state={state} className="size-3.5 rounded-[2px]" />
      <span className="text-xs text-textSecondary">{label}</span>
    </span>
  )
}
