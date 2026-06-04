import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PLACEHOLDER_USER = 'placeholder-user'
const LS_KEY = 'peak:savedFoods'
const SELECT = 'id, name, calories, protein_g, carbs_g, fat_g, created_at'

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}

function writeLocal(rows) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows))
  } catch {
    /* non-fatal */
  }
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Foods the user eats regularly, newest first, for one-tap logging. Backed by
 * saved_meals (prototype mode). Saving the same name twice replaces the old
 * entry so favorites stay deduped.
 */
export function useSavedFoods() {
  const [foods, setFoods] = useState(() => readLocal())

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('saved_meals')
        .select(SELECT)
        .eq('user_id', PLACEHOLDER_USER)
        .order('created_at', { ascending: false })
      if (!active || error || !data) return
      setFoods(data)
      writeLocal(data)
    })()
    return () => {
      active = false
    }
  }, [])

  const saveFood = useCallback(async (food) => {
    const name = (food.name || '').trim()
    if (!name) return
    const row = {
      user_id: PLACEHOLDER_USER,
      name,
      calories: num(food.calories),
      protein_g: num(food.protein_g),
      carbs_g: num(food.carbs_g),
      fat_g: num(food.fat_g),
    }
    const optimistic = { id: `local-${Date.now()}`, created_at: new Date().toISOString(), ...row }
    setFoods((prev) => {
      const next = [optimistic, ...prev.filter((f) => f.name.toLowerCase() !== name.toLowerCase())]
      writeLocal(next)
      return next
    })

    // Replace any existing favorite with the same name, then insert fresh.
    await supabase
      .from('saved_meals')
      .delete()
      .eq('user_id', PLACEHOLDER_USER)
      .ilike('name', name)
    const { data, error } = await supabase.from('saved_meals').insert(row).select(SELECT).single()
    if (!error && data) {
      setFoods((prev) => {
        const next = prev.map((f) => (f.id === optimistic.id ? data : f))
        writeLocal(next)
        return next
      })
    }
  }, [])

  const removeFood = useCallback(async (id) => {
    setFoods((prev) => {
      const next = prev.filter((f) => f.id !== id)
      writeLocal(next)
      return next
    })
    if (!String(id).startsWith('local-')) {
      await supabase.from('saved_meals').delete().eq('id', id)
    }
  }, [])

  return { foods, saveFood, removeFood }
}
