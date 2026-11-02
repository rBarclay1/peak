import { useState } from 'react'
import { usePlanner } from '../hooks/usePlanner'
import { inputClass, actionClass } from './TimelineCard.jsx'
export default function ManualSleep({ date }) {
  const { records, update } = usePlanner()
  const saved = records[`${date}:sleep-log`]?.hours
  const [hours, setHours] = useState(saved ?? '')
  return (
    <form
      className="mt-5 rounded-2xl bg-secondary/50 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        update(`${date}:sleep-log`, { hours: Number(hours), source: 'manual' })
      }}
    >
      <p className="text-sm font-semibold">Sleep routine · 10 pm–6:30 am</p>
      <p className="text-xs text-textSecondary my-2">
        Log hours slept if Garmin is unavailable. Manual entries stay separate
        from Garmin’s measurements.
      </p>
      <label className="block text-sm">
        Hours slept
        <input
          className={inputClass}
          type="number"
          min="0"
          max="24"
          step="0.1"
          required
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </label>
      <button className={`${actionClass} mt-3`}>Save sleep</button>
      {saved != null && (
        <p className="text-sm text-cyan mt-2" role="status">
          {saved} hours logged manually for {date}
        </p>
      )}
    </form>
  )
}
