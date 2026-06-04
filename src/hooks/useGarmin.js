import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dayKey } from '../lib/date'

const PLACEHOLDER_USER = 'placeholder-user'

// Recent Garmin daily metrics (oldest → newest), synced by scripts/garmin_sync.py.
// Returns [] until the table has data, so callers fall back to placeholders.
export function useGarmin(days = 14) {
  const [rows, setRows] = useState([])

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

  return rows
}
