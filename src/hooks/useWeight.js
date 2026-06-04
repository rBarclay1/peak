import { useState } from 'react'
import { dayKey } from '../lib/date'

// Local-only weight log. One entry per day. Starts empty — real readings only.
// v2: bumped from v1 to drop the old seeded sample weights on existing devices.
const KEY = 'peak.weight.v2'
const UNIT = 'lb'

export function useWeight() {
  const [entries, setEntries] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return []
  })

  const addEntry = (weight) => {
    const w = Math.round(Number(weight) * 10) / 10
    if (!w || Number.isNaN(w)) return
    setEntries((prev) => {
      const k = dayKey()
      const next = [...prev.filter((e) => e.date !== k), { date: k, weight: w }].sort((a, b) =>
        a.date < b.date ? -1 : 1,
      )
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return { entries, addEntry, unit: UNIT }
}
