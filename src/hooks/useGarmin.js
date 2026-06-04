import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dayKey, todayKey } from '../lib/date'

const PLACEHOLDER_USER = 'placeholder-user'

// Recent Garmin daily metrics (oldest → newest), synced by scripts/garmin_sync.py.
// Returns rows plus saveToday() for manual edits. Empty until the table has data.
export function useGarmin(days = 14) {
  const [rows, setRows] = useState([])
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  useEffect(() => {
    let active = true
    ;(async () => {
      const since = new Date()
      since.setDate(since.getDate() - days)
      const sinceKey = dayKey(since)
      const { data, error } = await supabase
        .from('garmin_data')
        .select('*')
        .eq('user_id', PLACEHOLDER_USER)
        .gte('date', sinceKey)
        .order('date', { ascending: true })
      if (!active || error || !data) return
      setRows(data)
    })()
    return () => {
      active = false
    }
  }, [days])

  // Manually upsert today's row. Merges over any existing values so editing one
  // stat doesn't null out the others (other Garmin fields, run data, stages).
  const saveToday = useCallback(async (fields) => {
    const date = todayKey()
    const existing = rowsRef.current.find((r) => r.date === date)
    const merged = {
      ...(existing || { user_id: PLACEHOLDER_USER, date }),
      ...fields,
      synced_at: new Date().toISOString(),
    }
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.date === date)
      if (idx >= 0) return prev.map((r, i) => (i === idx ? merged : r))
      return [...prev, merged].sort((a, b) => (a.date < b.date ? -1 : 1))
    })
    await supabase.from('garmin_data').upsert(merged, { onConflict: 'user_id,date' })
  }, [])

  return { rows, saveToday }
}
