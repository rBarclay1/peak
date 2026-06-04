import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayKey } from '../lib/date'

const PLACEHOLDER_USER = 'placeholder-user'
const LS_KEY = 'peak:journal'

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}

function writeLocal(entries) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries))
  } catch {
    /* non-fatal */
  }
}

/**
 * Journal entries, newest first. localStorage is the reliable layer; Supabase
 * is the source of truth once the journal_entries table exists (it has no RLS
 * in prototype mode, so the placeholder user can read/write directly).
 */
export function useJournal() {
  const [entries, setEntries] = useState(() => readLocal())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, date, entry_text, created_at')
        .eq('user_id', PLACEHOLDER_USER)
        .order('created_at', { ascending: false })

      if (!active || error || !data) return
      setEntries(data)
      writeLocal(data)
    })()
    return () => {
      active = false
    }
  }, [])

  const addEntry = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return

    setSaving(true)
    const today = todayKey()
    const optimistic = {
      id: `local-${Date.now()}`,
      date: today,
      entry_text: trimmed,
      created_at: new Date().toISOString(),
    }
    setEntries((prev) => {
      const next = [optimistic, ...prev]
      writeLocal(next)
      return next
    })

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({ user_id: PLACEHOLDER_USER, date: today, entry_text: trimmed })
      .select('id, date, entry_text, created_at')
      .single()

    if (!error && data) {
      // Replace the optimistic row with the persisted one.
      setEntries((prev) => {
        const next = [data, ...prev.filter((e) => e.id !== optimistic.id)]
        writeLocal(next)
        return next
      })
    }
    setSaving(false)
  }, [])

  return { entries, addEntry, saving }
}
