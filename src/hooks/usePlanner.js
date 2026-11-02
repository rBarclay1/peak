import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import {
  START,
  END,
  USER,
  STORAGE_PREFIX,
  materialize,
  mergeRecords,
  patchRecord,
  reconcile,
  fromRows,
  toRow,
  todayKey,
  GOALS,
} from '../lib/plan.js'
const KEY = 'peak.planner.v1'
let saved = {}
try {
  saved = JSON.parse(localStorage.getItem(KEY) || '{}')
} catch {
  /* first visit */
}
let snapshot = {
  records: saved.records || {},
  pending: saved.pending || {},
  syncStatus: 'Loading…',
  storageError: false,
}
const listeners = new Set()
const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function publish(next) {
  snapshot = next
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ records: next.records, pending: next.pending }),
    )
  } catch {
    snapshot = {
      ...next,
      storageError: true,
      syncStatus: 'Device storage full — keep this page open until synced.',
    }
  }
  listeners.forEach((fn) => fn())
}
export function updatePlanner(id, patch) {
  const records = patchRecord(snapshot.records, id, {
    ...patch,
    automatic: false,
  })
  publish({
    ...snapshot,
    records,
    pending: { ...snapshot.pending, [id]: records[id] },
    syncStatus: 'Saving…',
  })
  void syncPlanner()
}
function rollover() {
  const records = reconcile(snapshot.records, todayKey())
  if (records === snapshot.records) return
  const pending = { ...snapshot.pending }
  for (const [id, value] of Object.entries(records))
    if (value !== snapshot.records[id]) pending[id] = value
  publish({ ...snapshot, records, pending })
}
let running = null
export function syncPlanner() {
  if (running) return running
  running = (async () => {
    try {
      const { data, error } = await supabase
        .from('schedule_overrides')
        .select('day_overrides')
        .like('user_id', `${STORAGE_PREFIX}%`)
      if (error) throw error
      const remote = fromRows(data)
      publish({ ...snapshot, records: mergeRecords(remote, snapshot.records) })
      rollover()
      // Capture a batch. Never acknowledge a later edit with an older response.
      const batch = { ...snapshot.pending }
      for (const [id, record] of Object.entries(batch)) {
        const winner = snapshot.records[id]
        const { error: writeError } = await supabase
          .from('schedule_overrides')
          .upsert(toRow(winner), { onConflict: 'user_id' })
        if (writeError) throw writeError
        const pending = { ...snapshot.pending }
        if (JSON.stringify(pending[id]) === JSON.stringify(record))
          delete pending[id]
        publish({ ...snapshot, pending })
      }
      publish({
        ...snapshot,
        syncStatus: Object.keys(snapshot.pending).length ? 'Saving…' : 'Saved',
      })
    } catch {
      rollover()
      publish({
        ...snapshot,
        syncStatus: Object.keys(snapshot.pending).length
          ? 'Saved on this device · waiting to sync'
          : 'Offline · showing saved plan',
      })
    } finally {
      running = null
    }
  })()
  return running
}
let clients = 0,
  stop = null
function start() {
  if (++clients !== 1) return
  if (!snapshot.records[`${START}:activation`])
    updatePlanner(`${START}:activation`, { activated: true })
  const refresh = () => {
    if (document.visibilityState !== 'hidden') void syncPlanner()
  }
  const timer = setInterval(refresh, 30000)
  window.addEventListener('online', refresh)
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
  const storage = (e) => {
    if (e.key !== KEY || !e.newValue) return
    try {
      const other = JSON.parse(e.newValue)
      const records = mergeRecords(snapshot.records, other.records)
      const pending = mergeRecords(snapshot.pending, other.pending)
      if (
        JSON.stringify(records) !== JSON.stringify(snapshot.records) ||
        JSON.stringify(pending) !== JSON.stringify(snapshot.pending)
      )
        publish({ ...snapshot, records, pending })
    } catch {
      /* ignore corrupt external data */
    }
  }
  window.addEventListener('storage', storage)
  void syncPlanner()
  stop = () => {
    clearInterval(timer)
    window.removeEventListener('online', refresh)
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
    window.removeEventListener('storage', storage)
  }
}
export function usePlanner() {
  const state = useSyncExternalStore(subscribe, () => snapshot)
  useEffect(() => {
    start()
    return () => {
      if (--clients === 0) stop?.()
    }
  }, [])
  return {
    ...state,
    tasks: materialize(state.records),
    update: updatePlanner,
    retry: syncPlanner,
    goals: state.records[`${START}:settings`]?.goals || GOALS,
  }
}
