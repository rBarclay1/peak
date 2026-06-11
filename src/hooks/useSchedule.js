import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import {
  subscribeSchedule,
  getScheduleSnapshot,
  replaceSchedule,
  setDayOverride as storeSetDay,
  clearDayOverride as storeClearDay,
  setPhasePattern as storeSetPhase,
  clearPhasePattern as storeClearPhase,
} from '../lib/training'

// User edits to the training schedule (one-off day changes + per-phase weekly
// patterns). localStorage is the instant/offline layer; schedule_overrides is
// the source of truth once that table exists. Mirrors the weight/journal hooks:
// a missing table just falls back to localStorage.
const PLACEHOLDER_USER = 'placeholder-user'
const LS_KEY = 'peak.schedule.v1'

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    return { dayOverrides: raw.dayOverrides || {}, phasePatterns: raw.phasePatterns || {} }
  } catch {
    return { dayOverrides: {}, phasePatterns: {} }
  }
}

function writeLocal(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function isEmpty(state) {
  return !Object.keys(state.dayOverrides).length && !Object.keys(state.phasePatterns).length
}

// Hydrate the shared store from localStorage as soon as this module loads, so
// the first render already reflects saved edits. The server sync refines it.
replaceSchedule(readLocal())

export function useSchedule() {
  const state = useSyncExternalStore(subscribeSchedule, getScheduleSnapshot)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('schedule_overrides')
        .select('day_overrides, phase_patterns')
        .eq('user_id', PLACEHOLDER_USER)
        .maybeSingle()
      if (!active || error) return // table missing → keep localStorage

      if (data) {
        const next = {
          dayOverrides: data.day_overrides || {},
          phasePatterns: data.phase_patterns || {},
        }
        replaceSchedule(next)
        writeLocal(next)
      } else {
        // No server row yet → push existing local edits up once.
        const local = readLocal()
        if (!isEmpty(local)) {
          await supabase.from('schedule_overrides').upsert(
            {
              user_id: PLACEHOLDER_USER,
              day_overrides: local.dayOverrides,
              phase_patterns: local.phasePatterns,
            },
            { onConflict: 'user_id' },
          )
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const persist = useCallback((next) => {
    writeLocal(next)
    supabase
      .from('schedule_overrides')
      .upsert(
        {
          user_id: PLACEHOLDER_USER,
          day_overrides: next.dayOverrides,
          phase_patterns: next.phasePatterns,
        },
        { onConflict: 'user_id' },
      )
      .then(() => {})
  }, [])

  const setDayCode = useCallback((key, code) => persist(storeSetDay(key, code)), [persist])
  const resetDay = useCallback((key) => persist(storeClearDay(key)), [persist])
  const savePhasePattern = useCallback(
    (phaseId, days) => persist(storeSetPhase(phaseId, days)),
    [persist],
  )
  const resetPhasePattern = useCallback(
    (phaseId) => persist(storeClearPhase(phaseId)),
    [persist],
  )

  return { state, setDayCode, resetDay, savePhasePattern, resetPhasePattern }
}
