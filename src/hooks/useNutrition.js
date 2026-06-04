import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayKey } from '../lib/date'

const PLACEHOLDER_USER = 'placeholder-user'

// Daily macro targets. Centralized here so the card and (later) a settings
// screen read the same numbers. Mirrors the old hard-coded FuelCard goals.
export const GOALS = {
  calories: 2550,
  protein: 155,
  carbs: 280,
  fat: 85,
}

const SELECT = 'id, date, meal_name, meal_type, calories, protein_g, carbs_g, fat_g, created_at'

function lsKey(date) {
  return `peak:nutrition:${date}`
}

function readLocal(date) {
  try {
    return JSON.parse(localStorage.getItem(lsKey(date)) || '[]')
  } catch {
    return []
  }
}

function writeLocal(date, logs) {
  try {
    localStorage.setItem(lsKey(date), JSON.stringify(logs))
  } catch {
    /* non-fatal */
  }
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Today's nutrition log. localStorage is the instant/offline layer; Supabase
 * (nutrition_logs, prototype mode — text user_id, no RLS) is the source of
 * truth. Returns running totals and the shared macro goals.
 */
export function useNutrition() {
  const date = todayKey()
  const [logs, setLogs] = useState(() => readLocal(date))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('nutrition_logs')
        .select(SELECT)
        .eq('user_id', PLACEHOLDER_USER)
        .eq('date', date)
        .order('created_at', { ascending: true })
      if (!active || error || !data) return
      setLogs(data)
      writeLocal(date, data)
    })()
    return () => {
      active = false
    }
  }, [date])

  // food: { name, meal_type, calories, protein_g, carbs_g, fat_g }
  const addLog = useCallback(
    async (food) => {
      setSaving(true)
      const row = {
        user_id: PLACEHOLDER_USER,
        date,
        meal_name: (food.name || '').trim() || 'Food',
        meal_type: food.meal_type || 'snack',
        calories: num(food.calories),
        protein_g: num(food.protein_g),
        carbs_g: num(food.carbs_g),
        fat_g: num(food.fat_g),
      }
      const optimistic = { id: `local-${Date.now()}`, created_at: new Date().toISOString(), ...row }
      setLogs((prev) => {
        const next = [...prev, optimistic]
        writeLocal(date, next)
        return next
      })

      const { data, error } = await supabase.from('nutrition_logs').insert(row).select(SELECT).single()
      if (!error && data) {
        setLogs((prev) => {
          const next = prev.map((l) => (l.id === optimistic.id ? data : l))
          writeLocal(date, next)
          return next
        })
      }
      setSaving(false)
    },
    [date],
  )

  const removeLog = useCallback(
    async (id) => {
      setLogs((prev) => {
        const next = prev.filter((l) => l.id !== id)
        writeLocal(date, next)
        return next
      })
      if (!String(id).startsWith('local-')) {
        await supabase.from('nutrition_logs').delete().eq('id', id)
      }
    },
    [date],
  )

  const totals = logs.reduce(
    (t, l) => ({
      calories: t.calories + num(l.calories),
      protein: t.protein + num(l.protein_g),
      carbs: t.carbs + num(l.carbs_g),
      fat: t.fat + num(l.fat_g),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  return { logs, totals, goals: GOALS, addLog, removeLog, saving }
}
