import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { todayKey, USER, GOALS } from '../lib/plan.js'
import { usePlanner, updatePlanner } from './usePlanner'
import { mergeNutrition, acknowledge } from '../lib/nutritionQueue.js'
export { GOALS }
const KEY = 'peak.nutrition.queue.v2'
let cache = {}
try {
  cache = JSON.parse(localStorage.getItem(KEY) || '{}')
} catch {
  /* first visit */
}
const listeners = new Set()
let snapshot = { days: cache, status: 'Loading…' }
const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function publish(days, status = snapshot.status) {
  try {
    localStorage.setItem(KEY, JSON.stringify(days))
  } catch {
    status = 'Device storage full — keep open until synced.'
  }
  snapshot = { days, status }
  listeners.forEach((fn) => fn())
}
function ensure(date) {
  if (snapshot.days[date]) return
  let legacy = []
  try {
    legacy = JSON.parse(localStorage.getItem(`peak:nutrition:${date}`) || '[]')
  } catch {
    /* empty */
  }
  const pending = {}
  const logs = legacy.map((row) => {
    if (!String(row.id).startsWith('local-')) return row
    const copy = { ...row, id: crypto.randomUUID() }
    pending[copy.id] = {
      type: 'upsert',
      id: copy.id,
      row: copy,
      version: crypto.randomUUID(),
    }
    return copy
  })
  publish({ ...snapshot.days, [date]: { logs, pending } })
}
let flight = null
export function syncNutrition(date) {
  if (flight) return flight
  flight = (async () => {
    try {
      // Include all pending days, not only the date currently on screen.
      const days = new Set([
        date,
        ...Object.keys(snapshot.days).filter(
          (d) => Object.keys(snapshot.days[d].pending).length,
        ),
      ])
      for (const d of days) {
        if (!d) continue
        ensure(d)
        const { data, error } = await supabase
          .from('nutrition_logs')
          .select('*')
          .eq('user_id', USER)
          .eq('date', d)
          .order('created_at')
        if (error) throw error
        let state = snapshot.days[d]
        publish({
          ...snapshot.days,
          [d]: { ...state, logs: mergeNutrition(data || [], state.pending) },
        })
        const sent = { ...snapshot.days[d].pending }
        for (const operation of Object.values(sent)) {
          const result =
            operation.type === 'delete'
              ? await supabase
                  .from('nutrition_logs')
                  .delete()
                  .eq('id', operation.id)
                  .eq('user_id', USER)
              : await supabase
                  .from('nutrition_logs')
                  .upsert(operation.row, { onConflict: 'id' })
          if (result.error) throw result.error
          state = snapshot.days[d]
          publish({
            ...snapshot.days,
            [d]: {
              ...state,
              pending: acknowledge(state.pending, {
                [operation.id]: operation,
              }),
            },
          })
        }
      }
      publish(snapshot.days, 'Saved')
    } catch {
      publish(snapshot.days, 'Saved on this device · waiting to sync')
    } finally {
      flight = null
    }
  })()
  return flight
}
const num = (v) => Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0)
export function useNutrition(date = todayKey()) {
  const state = useSyncExternalStore(subscribe, () => snapshot)
  const { goals } = usePlanner()
  useEffect(() => {
    ensure(date)
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void syncNutrition(date)
    }
    refresh()
    const timer = setInterval(refresh, 30000)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [date])
  const addLog = (food) => {
    ensure(date)
    const row = {
      id: crypto.randomUUID(),
      user_id: USER,
      date,
      created_at: new Date().toISOString(),
      meal_name: (food.name || '').trim() || 'Food',
      meal_type: food.meal_type || 'snack',
      calories: num(food.calories),
      protein_g: num(food.protein_g),
      carbs_g: num(food.carbs_g),
      fat_g: num(food.fat_g),
    }
    const current = snapshot.days[date]
    publish(
      {
        ...snapshot.days,
        [date]: {
          logs: [...current.logs, row],
          pending: {
            ...current.pending,
            [row.id]: {
              type: 'upsert',
              id: row.id,
              row,
              version: crypto.randomUUID(),
            },
          },
        },
      },
      'Saving…',
    )
    updatePlanner(`${date}:food-review`, { confirmed: false })
    void syncNutrition(date)
  }
  const removeLog = (id) => {
    ensure(date)
    const current = snapshot.days[date]
    publish(
      {
        ...snapshot.days,
        [date]: {
          logs: current.logs.filter((row) => row.id !== id),
          pending: {
            ...current.pending,
            [id]: { type: 'delete', id, version: crypto.randomUUID() },
          },
        },
      },
      'Saving…',
    )
    updatePlanner(`${date}:food-review`, { confirmed: false })
    void syncNutrition(date)
  }
  const logs = state.days[date]?.logs || []
  const totals = logs.reduce(
    (t, row) => ({
      calories: t.calories + num(row.calories),
      protein: t.protein + num(row.protein_g),
      carbs: t.carbs + num(row.carbs_g),
      fat: t.fat + num(row.fat_g),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
  return {
    logs,
    totals,
    goals,
    addLog,
    removeLog,
    syncStatus: state.status,
    retry: () => syncNutrition(date),
    saving: !!Object.keys(state.days[date]?.pending || {}).length,
  }
}
