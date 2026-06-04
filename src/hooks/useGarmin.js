import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dayKey } from '../lib/date'

const PLACEHOLDER_USER = 'placeholder-user'

// Recent Garmin daily metrics (oldest → newest), synced by the garmin-sync
// function. Returns the rows plus refetch() to reload after a manual sync.
export function useGarmin(days = 14) {
  const [rows, setRows] = useState([])

  const refetch = useCallback(async () => {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const { data, error } = await supabase
      .from('garmin_data')
      .select('*')
      .eq('user_id', PLACEHOLDER_USER)
      .gte('date', dayKey(since))
      .order('date', { ascending: true })
    if (!error && data) setRows(data)
  }, [days])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { rows, refetch }
}
