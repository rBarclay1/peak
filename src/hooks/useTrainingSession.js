import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Until auth exists, all rows are attributed to this placeholder user.
// Server persistence requires running the "prototype mode" migration in
// schema.sql (text user_id, RLS off). Either way the UI works: state is
// mirrored to localStorage below, so checkboxes persist across reloads now.
const PLACEHOLDER_USER_ID = 'placeholder-user'

const lsKey = (date, sessionType) => `peak:session:${date}:${sessionType}`

function readLocal(date, sessionType) {
  try {
    const raw = localStorage.getItem(lsKey(date, sessionType))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeLocal(date, sessionType, value) {
  try {
    localStorage.setItem(lsKey(date, sessionType), JSON.stringify(value))
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/**
 * Manages today's training_sessions row: which checklist items are done and
 * whether the session is marked complete. Optimistic local state, mirrored to
 * localStorage immediately and persisted to Supabase best-effort.
 */
export function useTrainingSession(date, sessionType) {
  const [completedItems, setCompletedItems] = useState([])
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const rowId = useRef(null)

  // Load: local cache first (instant), then reconcile with Supabase.
  useEffect(() => {
    let active = true
    rowId.current = null
    setLoading(true)

    const cached = readLocal(date, sessionType)
    if (cached) {
      setCompletedItems(cached.completedItems ?? [])
      setCompleted(!!cached.completed)
    } else {
      setCompletedItems([])
      setCompleted(false)
    }

    ;(async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('id, completed, completed_items')
        .eq('user_id', PLACEHOLDER_USER_ID)
        .eq('date', date)
        .eq('session_type', sessionType)
        .maybeSingle()

      if (!active) return
      if (!error && data) {
        rowId.current = data.id
        setCompletedItems(data.completed_items ?? [])
        setCompleted(!!data.completed)
      }
      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [date, sessionType])

  const persist = useCallback(
    async (items, done) => {
      writeLocal(date, sessionType, { completedItems: items, completed: done })

      const payload = {
        user_id: PLACEHOLDER_USER_ID,
        date,
        session_type: sessionType,
        completed_items: items,
        completed: done,
      }

      if (rowId.current) {
        await supabase
          .from('training_sessions')
          .update(payload)
          .eq('id', rowId.current)
      } else {
        const { data } = await supabase
          .from('training_sessions')
          .insert(payload)
          .select('id')
          .single()
        if (data) rowId.current = data.id
      }
    },
    [date, sessionType],
  )

  const toggleItem = useCallback(
    (key) => {
      setCompletedItems((prev) => {
        const next = prev.includes(key)
          ? prev.filter((k) => k !== key)
          : [...prev, key]
        persist(next, completed)
        return next
      })
    },
    [persist, completed],
  )

  const markComplete = useCallback(() => {
    setCompleted(true)
    persist(completedItems, true)
  }, [persist, completedItems])

  return { completedItems, completed, loading, toggleItem, markComplete }
}
