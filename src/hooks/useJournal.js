import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dayKey, todayKey } from '../lib/date'

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

// One-time fix for entries written before the local-date switch: an entry's
// real day is the local date of its created_at, not whatever (UTC-derived) date
// got stored. Entries are always created "today", so this is lossless — it only
// shifts rows whose stored date disagrees with their timestamp. Idempotent.
function normalizeDates(entries) {
  let changed = false
  const next = entries.map((e) => {
    if (!e.created_at) return e
    const local = dayKey(new Date(e.created_at))
    if (local !== e.date) {
      changed = true
      return { ...e, date: local }
    }
    return e
  })
  return changed ? next : entries
}

/**
 * Journal entries, newest first. localStorage is the reliable layer; Supabase
 * is the source of truth once the journal_entries table exists (it has no RLS
 * in prototype mode, so the placeholder user can read/write directly).
 */
export function useJournal() {
  const [entries, setEntries] = useState(() => normalizeDates(readLocal()))
  const [saving, setSaving] = useState(false)

  // Persist the local-date normalization back to storage on mount.
  useEffect(() => {
    writeLocal(normalizeDates(readLocal()))
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, date, entry_text, created_at')
        .eq('user_id', PLACEHOLDER_USER)
        .order('created_at', { ascending: false })

      if (!active || error) return // table missing → keep localStorage

      if (data.length) {
        const normalized = normalizeDates(data)
        setEntries(normalized)
        writeLocal(normalized)
      } else {
        // Server empty (e.g. table just created) → push local entries up once
        // instead of overwriting them with nothing.
        const local = normalizeDates(readLocal())
        if (local.length) {
          const { data: inserted } = await supabase
            .from('journal_entries')
            .insert(local.map((e) => ({ user_id: PLACEHOLDER_USER, date: e.date, entry_text: e.entry_text })))
            .select('id, date, entry_text, created_at')
          if (active && inserted) {
            const norm = normalizeDates(inserted).sort((a, b) =>
              a.created_at < b.created_at ? 1 : -1,
            )
            setEntries(norm)
            writeLocal(norm)
          }
        }
      }
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
