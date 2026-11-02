import { useState } from 'react'
import { usePlanner } from '../hooks/usePlanner'
import { START, fuelAdvice } from '../lib/plan.js'
import { actionClass, inputClass } from './TimelineCard.jsx'
export default function FuelPlan({ date, totals, logs, syncStatus, retry }) {
  const { records, goals, update } = usePlanner()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState(goals)
  const [error, setError] = useState('')
  const complete = records[`${date}:food-review`]?.confirmed || false
  return (
    <div className="mt-5 rounded-2xl bg-secondary/50 p-4 space-y-3">
      <p className="text-sm font-semibold">
        120 g protein · four meals or snacks
      </p>
      <p className="text-xs leading-relaxed text-textSecondary">
        2,550 kcal is a provisional starting target. Review your usual intake,
        weight trend, hunger, and recovery. Daily targets do not accumulate as
        debt.
      </p>
      <button
        className={`${actionClass} w-full text-left`}
        disabled={!logs.length}
        onClick={() => update(`${date}:food-review`, { confirmed: !complete })}
      >
        {complete
          ? '✓ All food logged · tap to reopen'
          : 'Mark all food logged for this day'}
      </button>
      <p className="text-sm leading-relaxed text-textSecondary">
        {fuelAdvice(totals, goals, complete)}
      </p>
      <div className="flex justify-between items-center gap-2 text-xs">
        <button onClick={retry} className="text-textSecondary">
          {syncStatus}
        </button>
        <button
          className={actionClass}
          onClick={() => {
            setValues(goals)
            setEditing(!editing)
          }}
        >
          Edit targets
        </button>
      </div>
      {editing && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            const g = Object.fromEntries(
              Object.entries(values).map(([k, v]) => [k, Number(v)]),
            )
            if (Object.values(g).some((v) => !Number.isFinite(v) || v <= 0))
              return setError('Enter positive numbers for every target.')
            update(`${START}:settings`, { goals: g })
            setEditing(false)
            setError('')
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            {Object.keys(goals).map((k) => (
              <label key={k} className="text-xs capitalize">
                {k}
                {k === 'calories' ? ' (kcal)' : ' (g)'}
                <input
                  className={inputClass}
                  required
                  type="number"
                  min="1"
                  value={values[k]}
                  onChange={(e) =>
                    setValues({ ...values, [k]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          {error && <p role="alert">{error}</p>}
          <button className={actionClass}>Save targets</button>
        </form>
      )}
    </div>
  )
}
