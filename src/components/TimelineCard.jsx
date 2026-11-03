import ActivityEditor from './ActivityEditor.jsx'
import { useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Plus,
  Undo2,
} from 'lucide-react'
import CardFrame from './CardFrame.jsx'
import { usePlanner } from '../hooks/usePlanner'
import { useNow } from '../hooks/useNow'
import {
  START,
  isActivity,
  isTodoListItem,
  END,
  todayKey,
  shortDate,
  dayDate,
  addDays,
  phase,
  dayProgress,
  formatTime,
  canPlace,
  minutes,
  timeString,
} from '../lib/plan.js'

const tones = {
  climb: '#30d158',
  golf: '#bf5af2',
  run: '#5ac8fa',
  meal: '#ff9f0a',
  sleep: '#8e8cff',
  todo: '#ffd60a',
  fixed: '#98989f',
}
export const actionClass =
  'rounded-xl bg-secondary px-3 py-2.5 text-xs font-semibold min-h-10 disabled:opacity-40'
export const inputClass = 'w-full rounded-xl bg-secondary px-3 py-3 text-base'

export default function TimelineCard({
  selectedDate,
  setSelectedDate,
  ...cardProps
}) {
  const planner = usePlanner(),
    now = useNow(),
    today = todayKey(now)
  const date = selectedDate || today
  const [error, setError] = useState('')
  const [moving, setMoving] = useState(null)
  const [moveDate, setMoveDate] = useState(today)
  const [moveTime, setMoveTime] = useState('19:45')
  const [undo, setUndo] = useState(null)
  const [editor, setEditor] = useState(null)
  const tasks = planner.tasks
    .filter((t) => t.date === date && isActivity(t))
    .sort((a, b) => a.time.localeCompare(b.time))
  const progress = dayProgress(planner.tasks, date)
  const timeNow = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
  const upcoming = tasks.filter(
    (t) =>
      !['done', 'moved', 'skipped'].includes(t.status) &&
      (date !== today || minutes(t.time) + t.duration >= minutes(timeNow)),
  )
  function change(task, patch) {
    setUndo({
      id: task.id,
      value: { deleted: false, ...task, ...planner.records[task.id] },
    })
    planner.update(task.id, patch)
  }
  function move(e) {
    e.preventDefault()
    if (moveDate < today) return setError('Choose today or a later day.')
    const problem = canPlace(moving, moveDate, moveTime, planner.records)
    if (problem) return setError(problem)
    change(moving, {
      date: moveDate,
      time: moveTime,
      status: 'planned',
      reason: `Moved from ${shortDate(moving.date)}.`,
      movedTo: null,
    })
    setMoving(null)
    setError('')
  }
  const preview = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-textSecondary">
          Your day
        </span>
        <span className="text-xs text-exercise">
          {progress.done}/{progress.total} done
        </span>
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-hidden">
        {upcoming.slice(0, 2).map((task, i) => (
          <div key={task.id} className="flex gap-3 items-center">
            <span className="w-16 shrink-0 text-xs text-textSecondary">
              {formatTime(task.time)}
            </span>
            <span
              className="h-7 w-0.5 shrink-0 rounded"
              style={{ background: tones[task.type] || '#636366' }}
            />
            <span
              className={`truncate ${i === 0 ? 'font-semibold' : 'text-sm text-textSecondary'}`}
            >
              {task.title}
            </span>
          </div>
        ))}
        {!upcoming.length && (
          <p className="text-sm text-textSecondary">
            {tasks.length
              ? 'Review your day and prepare for tomorrow.'
              : 'Your November plan is ready to browse.'}
          </p>
        )}
      </div>
      {cardProps.expandedId === null && <SimpleTodoList compact />}
      <div className="mt-2 shrink-0 flex items-center justify-between text-xs text-textSecondary">
        <span>{phase(date)}</span>
        <button aria-label="Open timeline" className="py-1" onClick={() => cardProps.onExpand('activity')}>Open timeline →</button>
      </div>
    </div>
  )
  const expanded = (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-exercise">
            {phase(date)}
          </p>
          <h1 className="text-3xl font-bold mt-1">Your day</h1>
        </div>
        <Clock3 className="text-exercise mt-2" />
      </div>
      <div className="my-5 flex items-center justify-between gap-2">
        <button
          aria-label="Previous timeline day"
          className={actionClass}
          disabled={date <= START}
          onClick={() => setSelectedDate(addDays(date, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="text-sm font-semibold"
          onClick={() =>
            setSelectedDate(today >= START && today <= END ? today : START)
          }
        >
          {dayDate(date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </button>
        <button
          aria-label="Next timeline day"
          className={actionClass}
          disabled={date >= END}
          onClick={() => setSelectedDate(addDays(date, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="flex justify-between text-xs text-textSecondary mb-2">
        <span>
          {progress.done} of {progress.total} completed
        </span>
        <button onClick={planner.retry}>{planner.syncStatus}</button>
      </div>
      <div className="h-1 rounded bg-secondary mb-5">
        <div
          className="h-full rounded bg-exercise"
          style={{
            width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
          }}
        />
      </div>
      {undo && (
        <div
          className="mb-4 flex items-center justify-between rounded-xl bg-secondary p-3 text-sm"
          role="status"
        >
          <span>Plan updated</span>
          <button
            className="flex gap-1 items-center"
            onClick={() => {
              planner.update(undo.id, undo.value)
              setUndo(null)
            }}
          >
            <Undo2 size={16} /> Undo
          </button>
        </div>
      )}
      {moving && (
        <form
          onSubmit={move}
          className="mb-5 space-y-3 rounded-2xl border border-border p-4"
        >
          <p className="font-semibold">Move {moving.title}</p>
          <label className="block text-sm">
            Date
            <input
              required
              type="date"
              min={today > START ? today : START}
              max={END}
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            Start time
            <input
              required
              type="time"
              value={moveTime}
              onChange={(e) => setMoveTime(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-orange">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button className={actionClass}>Move task</button>
            <button
              type="button"
              className={actionClass}
              onClick={() => setMoving(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <button
        className={`${actionClass} mb-4 w-full text-exercise`}
        onClick={() => {
          setEditor({ task: null })
          setMoving(null)
        }}
      >
        <Plus size={16} className="inline mr-2" />
        Add activity
      </button>
      {editor && (
        <ActivityEditor
          key={editor.task?.id || 'new'}
          task={editor.task}
          date={date}
          records={planner.records}
          onCancel={() => setEditor(null)}
          onSave={(next) => {
            if (editor.task) change(editor.task, next)
            else {
              planner.update(next.id, next)
              setUndo({ id: next.id, value: { ...next, deleted: true } })
            }
            setSelectedDate(next.date)
            setEditor(null)
          }}
        />
      )}
      {planner.tasks
        .filter((t) => t.date === date && t.type === 'fixed')
        .map((t) => (
          <div
            key={t.id}
            className="mb-3 rounded-xl bg-secondary/40 px-4 py-3 text-sm text-textSecondary"
          >
            {formatTime(t.time)}–
            {formatTime(timeString(minutes(t.time) + t.duration))} · {t.title}
          </div>
        ))}
      {!tasks.length && (
        <p className="my-5 text-sm text-textSecondary">
          No activities planned. Add your own above.
        </p>
      )}
      <div className="space-y-3">
        {tasks.map((task) => {
          const done = task.status === 'done',
            excluded = ['moved', 'skipped'].includes(task.status)
          const carries = planner.tasks.filter((t) => t.movedTo === task.id)
          return (
            <article
              key={task.id}
              className={`rounded-2xl border border-border p-4 ${done || excluded ? 'opacity-65' : ''}`}
            >
              <div className="flex gap-3">
                <button
                  aria-label={`${done ? 'Undo completion' : 'Complete'}: ${task.title}`}
                  aria-pressed={done}
                  className="shrink-0 size-11 flex items-center justify-center rounded-full bg-secondary"
                  onClick={() =>
                    change(task, {
                      status: done ? 'planned' : 'done',
                      completedAt: done ? null : new Date().toISOString(),
                      movedTo: null,
                      reason: null,
                    })
                  }
                >
                  {done ? (
                    <Check className="text-exercise" />
                  ) : (
                    <Circle className="text-textMuted" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs mb-1"
                    style={{ color: tones[task.type] || '#98989f' }}
                  >
                    {formatTime(task.time)}
                    {task.duration > 0
                      ? ` – ${formatTime(timeString(minutes(task.time) + task.duration))}`
                      : ''}{' '}
                    ·{' '}
                    {excluded
                      ? task.status
                      : task.status === 'partial'
                        ? 'Partly done'
                        : task.type}
                  </p>
                  <h2
                    className={`font-semibold leading-snug ${done ? 'line-through text-textSecondary' : ''}`}
                  >
                    {task.title}
                  </h2>
                </div>
              </div>
              {task.detail && (
                <p className="mt-3 text-sm leading-relaxed text-textSecondary">
                  {task.detail}
                </p>
              )}
              {task.steps?.length > 0 && (
                <div className="mt-3 space-y-1">
                  {task.steps.map((step, i) => (
                    <label
                      key={step}
                      className="flex items-start gap-2 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-green"
                        checked={(task.checkedSteps || []).includes(i)}
                        onChange={() => {
                          const checkedSteps = (
                            task.checkedSteps || []
                          ).includes(i)
                            ? task.checkedSteps.filter((n) => n !== i)
                            : [...(task.checkedSteps || []), i]
                          change(task, {
                            checkedSteps,
                            status:
                              checkedSteps.length === task.steps.length
                                ? 'done'
                                : checkedSteps.length
                                  ? 'partial'
                                  : 'planned',
                          })
                        }}
                      />
                      <span>{step}</span>
                    </label>
                  ))}
                </div>
              )}
              {task.reason && (
                <p className="mt-2 text-xs text-orange">{task.reason}</p>
              )}
              {carries.length > 0 && (
                <p className="mt-2 text-xs text-cyan">
                  Includes the focus from{' '}
                  {carries.map((t) => shortDate(t.originalDate)).join(', ')}.
                  Keep this session’s original duration.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  className={actionClass}
                  onClick={() => {
                    setEditor({ task })
                    setMoving(null)
                  }}
                >
                  Edit activity
                </button>
                <button
                  className={actionClass}
                  onClick={() => change(task, { deleted: true })}
                >
                  Delete activity
                </button>
              </div>
              {!done && !excluded && task.type !== 'flex' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className={actionClass}
                    onClick={() => change(task, { status: 'partial' })}
                  >
                    Partly done
                  </button>
                  {!['fixed', 'sleep', 'meal'].includes(task.type) && (
                    <button
                      className={actionClass}
                      onClick={() => {
                        setMoving(task)
                        setMoveDate(task.date < today ? today : task.date)
                        setMoveTime(task.time)
                        setError('')
                      }}
                    >
                      Move
                    </button>
                  )}
                  <button
                    className={actionClass}
                    onClick={() =>
                      change(task, {
                        status: 'skipped',
                        reason: 'Skipped by you.',
                      })
                    }
                  >
                    Skip
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>
      {cardProps.expandedId === 'activity' && <SimpleTodoList />}
      <p className="mt-6 text-xs leading-relaxed text-textSecondary">
        Unfinished training folds into a suitable later session without extra
        volume. Unfinished other activities return to your To-do list. Work and
        class are shown for context; only activities count toward completion.
      </p>
    </div>
  )
  return (
    <CardFrame
      id="activity"
      {...cardProps}
      preview={preview}
      expanded={expanded}
    />
  )
}

function SimpleTodoList({ compact = false }) {
  const { tasks, update } = usePlanner()
  const [title, setTitle] = useState('')
  const [completed, setCompleted] = useState(null)
  const pending = tasks.filter(t => isTodoListItem(t) && !['done', 'skipped', 'moved'].includes(t.status))
  function add(e) {
    e.preventDefault()
    if (!title.trim()) return
    update(`${START}:todo-${crypto.randomUUID()}`, {
      custom: true, listOnly: true, originalDate: START, date: null, time: null,
      title: title.trim(), type: 'todo', status: 'planned', duration: 0,
    })
    setTitle('')
  }
  return (
    <section aria-label="To-do list" className={`${compact ? 'mt-3 shrink-0' : 'mt-8'} border-t border-border pt-3 min-h-0 flex flex-col`}
      onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-textSecondary">To-do list · {pending.length}</h2>
      <form onSubmit={add} className="mt-2 flex gap-2">
        <input aria-label="Task" value={title} onChange={e => setTitle(e.target.value)} maxLength={200}
          placeholder="Add a task…" className="min-w-0 flex-1 rounded-xl bg-secondary px-3 py-2 text-base" />
        <button aria-label="Add task" disabled={!title.trim()} className={`${actionClass} text-yellow`}><Plus size={18} /></button>
      </form>
      <ul className={`${compact ? 'max-h-11 overflow-y-auto overscroll-contain' : ''} mt-1`}>
        {pending.map(task => (
          <li key={task.id}>
            <button aria-label={`Complete todo: ${task.title}`} className="flex min-h-11 w-full items-center gap-3 py-2 text-left text-sm"
              onClick={() => { setCompleted(task); update(task.id, { status: 'done' }) }}>
              <Circle size={18} className="shrink-0 text-textMuted" />
              <span className="min-w-0 break-words">{task.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {!pending.length && !compact && <p className="mt-3 text-sm text-textSecondary">All clear. Add anything you need to do.</p>}
      {completed && <button className="mt-1 text-xs text-yellow text-left min-h-8" onClick={() => { update(completed.id, { status: completed.status }); setCompleted(null) }}>Undo task completion</button>}
    </section>
  )
}
