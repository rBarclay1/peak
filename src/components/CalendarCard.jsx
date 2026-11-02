import { useState } from 'react'
import CardFrame from './CardFrame.jsx'
import { usePlanner } from '../hooks/usePlanner'
import {
  START,
  END,
  dates,
  todayKey,
  shortDate,
  trainingFor,
  dayProgress,
  phase,
} from '../lib/plan.js'
import { actionClass } from './TimelineCard.jsx'

export default function CalendarCard({ onSelectDay, ...props }) {
  const { tasks } = usePlanner(),
    today = todayKey()
  const [selected, setSelected] = useState(
    today >= START && today <= END ? today : START,
  )
  const remaining = Math.max(
    0,
    Math.round(
      (new Date(`${END}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) /
        86400000,
    ),
  )
  const progress = dayProgress(tasks, selected)
  const preview = (
    <div className="h-full flex flex-col justify-between">
      <span className="text-xs font-semibold uppercase tracking-wider text-textSecondary">
        November plan
      </span>
      <p className="text-xl font-bold">
        {remaining} days{' '}
        <span className="text-xs font-normal text-textSecondary">to go</span>
      </p>
      <p className="text-xs text-textSecondary">Nov 20 · climbing + golf</p>
    </div>
  )
  const expanded = (
    <div>
      <p className="text-xs uppercase tracking-widest text-cyan">
        November 2–20, 2026
      </p>
      <h1 className="text-3xl font-bold mt-1">The plan</h1>
      <p className="mt-2 text-sm text-textSecondary">
        Practice, recover, arrive fresh.
      </p>
      <div className="grid grid-cols-7 gap-2 mt-6">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-center text-xs text-textSecondary">
            {d}
          </span>
        ))}
        {dates().map((date) => {
          const p = dayProgress(tasks, date),
            allDone = p.total > 0 && p.done === p.total,
            training = trainingFor(date)
          return (
            <button
              key={date}
              aria-label={`View ${shortDate(date)}`}
              aria-pressed={selected === date}
              onClick={() => setSelected(date)}
              className={`rounded-xl min-h-16 py-2 border ${selected === date ? 'border-cyan bg-cyan/10' : 'border-border bg-secondary/40'}`}
            >
              <span
                className={`block font-semibold ${today === date ? 'text-cyan' : ''}`}
              >
                {Number(date.slice(-2))}
              </span>
              <span
                className={`block text-[9px] mt-1 ${allDone ? 'text-exercise' : 'text-textSecondary'}`}
              >
                {allDone ? 'Done' : training?.type || 'Recover'}
              </span>
              {p.done > 0 && (
                <span className="block text-[9px] text-exercise">
                  {p.done}/{p.total}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-6 rounded-2xl bg-secondary p-4">
        <p className="text-sm text-cyan">
          {shortDate(selected)} · {phase(selected)}
        </p>
        <h2 className="font-semibold mt-2">
          {trainingFor(selected)?.title || 'Recovery, routine & your to-dos'}
        </h2>
        <p className="text-sm text-textSecondary mt-2">
          {progress.done}/{progress.total} completed. Past dates are only
          complete when you mark them done.
        </p>
        <button
          className={`${actionClass} mt-3 bg-background`}
          onClick={() => onSelectDay(selected)}
        >
          Open this day →
        </button>
      </div>
      <div className="mt-6 text-sm leading-relaxed text-textSecondary space-y-3">
        <p>
          <strong className="text-foreground">Nov 3–8:</strong> Easy climbing
          and technique. Morning runs on the 3rd and 6th; range on the 5th and
          8th.
        </p>
        <p>
          <strong className="text-foreground">Nov 9–14:</strong> Controlled
          trip-style climbing. Runs on the 10th and 13th; range on the 12th.
        </p>
        <p>
          <strong className="text-foreground">Nov 15–20:</strong> Short range
          session on the 15th, climbing primer on the 17th, then protect
          recovery.
        </p>
        <p>
          Stop a session for pain or deteriorating technique. Daily climbing is
          not the target.
        </p>
      </div>
    </div>
  )
  return (
    <CardFrame id="calendar" {...props} preview={preview} expanded={expanded} />
  )
}
