import { useState } from 'react'
import { START, END, canPlace } from '../lib/plan.js'

const input = 'w-full rounded-xl bg-secondary px-3 py-3 text-base'
const button = 'rounded-xl bg-secondary px-4 py-3 text-sm font-semibold'
export default function ActivityEditor({
  task,
  date,
  records,
  onSave,
  onCancel,
}) {
  const [draft, setDraft] = useState(() => ({
    id: task?.id || `${START}:activity-${crypto.randomUUID()}`,
    title: task?.title || '',
    date: task?.date || date,
    time: task?.time || '18:00',
    duration: task?.duration || 30,
    type: task?.type || 'todo',
    detail: task?.detail || '',
    steps: (task?.steps || []).join('\n'),
  }))
  const [error, setError] = useState('')
  const field = (name, value) => setDraft({ ...draft, [name]: value })
  function save(e) {
    e.preventDefault()
    if (!draft.title.trim()) return setError('Give the activity a name.')
    const next = {
      ...draft,
      title: draft.title.trim(),
      duration: Number(draft.duration),
      steps: draft.steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    }
    const problem = canPlace(next, next.date, next.time, records)
    // Description/name edits do not reschedule an already completed session.
    const timingChanged =
      !task ||
      ['date', 'time', 'duration', 'type'].some((k) => next[k] !== task[k])
    if (problem && timingChanged) return setError(problem)
    const stepsChanged =
      JSON.stringify(next.steps) !== JSON.stringify(task?.steps || [])
    onSave({
      ...next,
      ...(task ? {} : { custom: true, originalDate: date, status: 'planned' }),
      ...(stepsChanged ? { checkedSteps: [] } : {}),
    })
  }
  return (
    <form
      onSubmit={save}
      className="mb-5 space-y-3 rounded-2xl border border-border p-4"
    >
      <h2 className="font-semibold">
        {task ? 'Edit activity' : 'New activity'}
      </h2>
      <label className="block text-sm">
        Activity name
        <input
          autoFocus
          required
          maxLength={200}
          className={input}
          value={draft.title}
          onChange={(e) => field('title', e.target.value)}
          placeholder="e.g. Stretching, gym, practice"
        />
      </label>
      <label className="block text-sm">
        Activity type
        <select
          className={input}
          value={draft.type}
          onChange={(e) => field('type', e.target.value)}
        >
          <option value="todo">Other activity</option>
          <option value="meal">Meal / snack</option>
          <option value="study">Study / personal project</option>
          <option value="climb">Climbing</option>
          <option value="golf">Golf</option>
          <option value="run">Running</option>
          <option value="recovery">Walk / mobility</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm min-w-0">
          Activity date
          <input
            required
            type="date"
            min={START}
            max={END}
            className={input}
            value={draft.date}
            onChange={(e) => field('date', e.target.value)}
          />
        </label>
        <label className="text-sm min-w-0">
          Activity time
          <input
            required
            type="time"
            className={input}
            value={draft.time}
            onChange={(e) => field('time', e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        Duration in minutes
        <input
          required
          type="number"
          min="5"
          max="480"
          step="5"
          className={input}
          value={draft.duration}
          onChange={(e) => field('duration', e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Activity notes
        <textarea
          className={input}
          rows={2}
          value={draft.detail}
          onChange={(e) => field('detail', e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Checklist · optional, one item per line
        <textarea
          className={input}
          rows={3}
          value={draft.steps}
          onChange={(e) => field('steps', e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-orange text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className={`${button} text-exercise`}>Save activity</button>
        <button type="button" className={button} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
