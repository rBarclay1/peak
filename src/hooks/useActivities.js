import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Manually-logged activities for a day (e.g. an unplanned run). Backed by
// logged_activities (prototype mode); localStorage is the instant/offline layer
// and the migration source when the server table is empty for a day.
const PLACEHOLDER_USER = 'placeholder-user'
const SELECT = 'id, date, name, type, created_at'
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

// Locally-created ids (pre-server) start with these prefixes.
const isLocalId = (id) => String(id).startsWith('local-') || String(id).startsWith('act-')

// Guards the one-time local→server upload per date so concurrent/remounted
// consumers don't both insert and duplicate. Resets on reload.
const migratedDates = new Set()

export function useActivities(date) {
  const [activities, setActivities] = useState(() => readLocal(date))

  useEffect(() => {
    let active = true
    setActivities(readLocal(date))
    ;(async () => {
      const { data, error } = await supabase
        .from('logged_activities')
        .select(SELECT)
        .eq('user_id', PLACEHOLDER_USER)
        .eq('date', date)
        .order('created_at', { ascending: true })
      if (!active || error) return // table missing → keep localStorage

      if (data.length) {
        setActivities(data)
        writeLocal(date, data)
      } else {
        // Server empty for this day → push any local entries up once.
        const local = readLocal(date)
        if (local.length && !migratedDates.has(date)) {
          migratedDates.add(date) // set synchronously before awaiting the insert
          const rows = local.map((a) => ({
            user_id: PLACEHOLDER_USER,
            date,
            name: a.name,
            type: a.type || 'other',
          }))
          const { data: inserted } = await supabase.from('logged_activities').insert(rows).select(SELECT)
          if (active && inserted) {
            setActivities(inserted)
            writeLocal(date, inserted)
          }
        }
      }
    })()
    return () => {
      active = false
    }
  }, [date])

  const addActivity = useCallback(
    async (activity) => {
      const row = {
        user_id: PLACEHOLDER_USER,
        date,
        name: (activity.name || '').trim() || 'Activity',
        type: activity.type || 'other',
      }
      const optimistic = { id: `local-${Date.now()}`, created_at: new Date().toISOString(), ...row }
      setActivities((prev) => {
        const next = [...prev, optimistic]
        writeLocal(date, next)
        return next
      })
      const { data, error } = await supabase.from('logged_activities').insert(row).select(SELECT).single()
      if (!error && data) {
        setActivities((prev) => {
          const next = prev.map((a) => (a.id === optimistic.id ? data : a))
          writeLocal(date, next)
          return next
        })
      }
    },
    [date],
  )

  const removeActivity = useCallback(
    async (id) => {
      setActivities((prev) => {
        const next = prev.filter((a) => a.id !== id)
        writeLocal(date, next)
        return next
      })
      if (!isLocalId(id)) {
        await supabase.from('logged_activities').delete().eq('id', id)
      }
    },
    [date],
  )

  return { activities, addActivity, removeActivity }
}
