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
      <div className="mt-3 flex-1 space-y-2 overflow-hidden">
        {upcoming.slice(0, 3).map((task, i) => (
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
      <div className="mt-2 flex items-center justify-between text-xs text-textSecondary">
        <span>{phase(date)}</span>
        <span>Open timeline →</span>
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

export function TodoCard(cardProps) {
  const { tasks, records, update, syncStatus } = usePlanner(),
    today = todayKey()
  const [title, setTitle] = useState(''),
    [due, setDue] = useState(''),
    [duration, setDuration] = useState(30),
    [error, setError] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState(null)
  const [removed, setRemoved] = useState(null)
  const todos = tasks
    .filter((t) => t.type === 'todo')
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'))
  const pending = todos.filter((t) => !['done', 'skipped'].includes(t.status))
  function add(e) {
    e.preventDefault()
    if (!title.trim()) return
    if (editing) {
      update(editing, {
        title: title.trim(),
        deadline: due || null,
        duration: Number(duration),
        date: null,
        time: null,
      })
      setEditing(null)
      setTitle('')
      setDue('')
      setError('')
      return
    }
    const id = `${START}:todo-${crypto.randomUUID()}`
    update(id, {
      custom: true,
      originalDate: START,
      date: null,
      time: null,
      duration: Number(duration),
      title: title.trim(),
      deadline: due || null,
      type: 'todo',
      status: 'planned',
      detail: '',
    })
    setTitle('')
    setDue('')
    setError('')
  }
  function schedule(task) {
    for (
      let day = today < START ? START : today;
      day <= END && (!task.deadline || day <= task.deadline);
      day = addDays(day, 1)
    ) {
      for (let time = 1185; time + task.duration <= 1275; time += 15) {
        if (day === today) {
          const current = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date())
          if (time < minutes(current)) continue
        }
        if (!canPlace(task, day, timeString(time), records)) {
          update(task.id, {
            ...task,
            date: day,
            time: timeString(time),
            reason: null,
          })
          setError('')
          return
        }
      }
    }
    setError(
      'No free evening slot before this deadline. The task stays in your list; adjust its due date or duration.',
    )
  }
  const preview = (
    <div className="h-full flex flex-col justify-between">
      <div className="flex justify-between items-center">
        <span className="text-xs uppercase font-semibold tracking-wider text-textSecondary">
          To-do list
        </span>
        <Plus size={16} className="text-yellow" />
      </div>
      <p className="text-xl font-bold">{pending.length} open</p>
      <p className="text-xs text-textSecondary truncate">
        {pending[0]?.title || 'Add something to get done'}
      </p>
    </div>
  )
  const expanded = (
    <div>
      <p className="text-xs uppercase tracking-widest text-yellow">
        Make room for the rest
      </p>
      <h1 className="text-3xl font-bold mt-1">To-do list</h1>
      <p className="text-sm text-textSecondary mt-2">
        Add anything. Keep it here, or find an evening slot in your day.
      </p>
      <form onSubmit={add} className="mt-6 space-y-3">
        <label className="block text-sm">
          Task
          <input
            className={inputClass}
            maxLength={200}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Finish assignment"
          />
        </label>
        <div className="flex gap-3">
          <label className="min-w-0 flex-1 text-sm">
            Due date · optional
            <input
              className={inputClass}
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label className="w-24 text-sm">
            Minutes
            <input
              className={inputClass}
              type="number"
              min="5"
              max="90"
              step="5"
              required
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
        </div>
        <button className={`${actionClass} w-full text-yellow`}>
          <Plus size={16} className="inline mr-1" />{' '}
          {editing ? 'Save task' : 'Add task'}
        </button>
        {editing && (
          <button
            type="button"
            className={actionClass}
            onClick={() => {
              setEditing(null)
              setTitle('')
              setDue('')
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="text-sm text-orange mt-3">
          {error}
        </p>
      )}
      <div className="mt-6 space-y-3">
        {(showDone ? todos : pending).map((task) => (
          <article
            key={task.id}
            className="rounded-2xl border border-border p-4"
          >
            <div className="flex gap-3 items-start">
              <button
                aria-label={`${task.status === 'done' ? 'Reopen' : 'Complete'} todo: ${task.title}`}
                className="size-11 shrink-0 rounded-full bg-secondary grid place-items-center"
                onClick={() =>
                  update(task.id, {
                    status: task.status === 'done' ? 'planned' : 'done',
                  })
                }
              >
                {task.status === 'done' ? (
                  <Check className="text-exercise" />
                ) : (
                  <Circle size={20} />
                )}
              </button>
              <div>
                <p
                  className={`font-semibold ${task.status === 'done' ? 'line-through text-textSecondary' : ''}`}
                >
                  {task.title}
                </p>
                <p
                  className={`mt-1 text-xs ${task.deadline && task.deadline < today && task.status !== 'done' ? 'text-orange' : 'text-textSecondary'}`}
                >
                  {task.duration} min
                  {task.deadline
                    ? ` · Due ${shortDate(task.deadline)}`
                    : ' · No deadline'}
                </p>
                {task.date && (
                  <p className="text-xs text-cyan mt-1">
                    {shortDate(task.date)} · {formatTime(task.time)}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {task.status !== 'done' && (
                <button
                  className={actionClass}
                  onClick={() =>
                    task.date
                      ? update(task.id, { date: null, time: null })
                      : schedule(task)
                  }
                >
                  {task.date ? 'Back to list' : 'Find a time'}
                </button>
              )}
              <button
                className={actionClass}
                onClick={() => {
                  setEditing(task.id)
                  setTitle(task.title)
                  setDue(task.deadline || '')
                  setDuration(task.duration)
                }}
              >
                Edit
              </button>
              <button
                className={actionClass}
                onClick={() => {
                  setRemoved(task.id)
                  update(task.id, { deleted: true })
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      {removed && (
        <button
          className={`${actionClass} mt-4`}
          onClick={() => {
            update(removed, { deleted: false })
            setRemoved(null)
          }}
        >
          Undo delete
        </button>
      )}
      {!pending.length && (
        <p className="my-6 text-textSecondary">Your list is clear.</p>
      )}
      <button
        className={`${actionClass} mt-4`}
        onClick={() => setShowDone(!showDone)}
      >
        {showDone ? 'Hide completed' : 'Show completed'}
      </button>
      <p className="text-xs text-textSecondary mt-4">{syncStatus}</p>
    </div>
  )
  return (
    <CardFrame
      id="todos"
      {...cardProps}
      preview={preview}
      expanded={expanded}
    />
  )
}
