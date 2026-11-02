import { createClient } from '@supabase/supabase-js'
import {
  START,
  STORAGE_PREFIX,
  todayKey,
  fromRows,
  reconcile,
  toRow,
} from '../src/lib/plan.js'

export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  // Never expose an unauthenticated job that changes personal records.
  if (
    !process.env.CRON_SECRET ||
    req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  )
    return res.status(401).json({ error: 'Unauthorized' })
  const today = todayKey()
  if (today <= START || today > '2026-11-21')
    return res.status(200).json({ updated: 0 })
  try {
    const client = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    )
    const { data, error } = await client
      .from('schedule_overrides')
      .select('day_overrides')
      .like('user_id', `${STORAGE_PREFIX}%`)
    if (error) throw error
    const records = fromRows(data)
    if (!records[`${START}:activation`])
      return res.status(200).json({ updated: 0 })
    const next = reconcile(records, today)
    let updated = 0
    for (const [id, record] of Object.entries(next)) {
      if (record === records[id]) continue
      // Compare-and-swap existing records: never overwrite an edit made after
      // this job read the task. Inserts ignore rows created concurrently.
      const row = toRow(record)
      const result = records[id]
        ? await client
            .from('schedule_overrides')
            .update(row)
            .eq('user_id', row.user_id)
            .eq('day_overrides->record->>updatedAt', records[id].updatedAt)
        : await client
            .from('schedule_overrides')
            .upsert(row, { onConflict: 'user_id', ignoreDuplicates: true })
      const writeError = result.error
      if (writeError) throw writeError
      updated++
    }
    return res.status(200).json({ updated })
  } catch {
    return res
      .status(500)
      .json({
        error: 'Rollover could not sync. The app will retry when opened.',
      })
  }
}
