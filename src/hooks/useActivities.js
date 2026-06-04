import { useCallback, useEffect, useState } from 'react'

// Manually-logged activities for a day (e.g. an unplanned run), kept per-date in
// localStorage — separate from the fixed training plan and its completion state.
const lsKey = (date) => `peak:activities:${date}`

function readLocal(date) {
  try {
    return JSON.parse(localStorage.getItem(lsKey(date)) || '[]')
  } catch {
    return []
  }
}

function writeLocal(date, list) {
  try {
    localStorage.setItem(lsKey(date), JSON.stringify(list))
  } catch {
    /* non-fatal */
  }
}

export function useActivities(date) {
  const [activities, setActivities] = useState(() => readLocal(date))

  useEffect(() => {
    setActivities(readLocal(date))
  }, [date])

  const addActivity = useCallback(
    (activity) => {
      setActivities((prev) => {
        const entry = {
          id: `act-${Date.now()}`,
          name: (activity.name || '').trim() || 'Activity',
          type: activity.type || 'other',
          created_at: new Date().toISOString(),
        }
        const next = [...prev, entry]
        writeLocal(date, next)
        return next
      })
    },
    [date],
  )

  const removeActivity = useCallback(
    (id) => {
      setActivities((prev) => {
        const next = prev.filter((a) => a.id !== id)
        writeLocal(date, next)
        return next
      })
    },
    [date],
  )

  return { activities, addActivity, removeActivity }
}
