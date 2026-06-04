import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dayKey } from '../lib/date'

// Weight log, one entry per day. Backed by weight_log (prototype mode); the
// localStorage copy is the instant/offline layer and the migration source if
// the server table is empty (e.g. it was just created).
const PLACEHOLDER_USER = 'placeholder-user'
const KEY = 'peak.weight.v2'
const UNIT = 'lb'
const SELECT = 'date, weight'

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function writeLocal(rows) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows))
  } catch {
    /* ignore */
  }
}

export function useWeight() {
  const [entries, setEntries] = useState(() => readLocal())

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('weight_log')
        .select(SELECT)
        .eq('user_id', PLACEHOLDER_USER)
        .order('date', { ascending: true })
      if (!active || error) return // table missing → keep localStorage

      if (data.length) {
        const rows = data.map((r) => ({ date: r.date, weight: Number(r.weight) }))
        setEntries(rows)
        writeLocal(rows)
      } else {
        // Server empty → push existing local entries up once.
        const local = readLocal()
        if (local.length) {
          await supabase.from('weight_log').upsert(
            local.map((e) => ({ user_id: PLACEHOLDER_USER, date: e.date, weight: e.weight, unit: UNIT })),
            { onConflict: 'user_id,date' },
          )
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const addEntry = useCallback((weight) => {
    const w = Math.round(Number(weight) * 10) / 10
    if (!w || Number.isNaN(w)) return
    const k = dayKey()
    setEntries((prev) => {
      const next = [...prev.filter((e) => e.date !== k), { date: k, weight: w }].sort((a, b) =>
        a.date < b.date ? -1 : 1,
      )
      writeLocal(next)
      return next
    })
    supabase
      .from('weight_log')
      .upsert({ user_id: PLACEHOLDER_USER, date: k, weight: w, unit: UNIT }, { onConflict: 'user_id,date' })
      .then(() => {})
  }, [])

  return { entries, addEntry, unit: UNIT }
}
