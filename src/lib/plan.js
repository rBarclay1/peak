// Shared by the browser and the daily rollover function. Dates are explicit:
// this is the November 2026 trip, not an annually repeating summer program.
export const START = '2026-11-02'
export const END = '2026-11-20'
export const HISTORY_START = '2026-06-03'
export const USER = 'placeholder-user'
export const PLAN_KIND = 'peak-november-v1'
export const STORAGE_PREFIX = `${USER}:${PLAN_KIND}:`
export const GOALS = { calories: 2550, protein: 120, carbs: 315, fat: 90 }
export const TIMEZONE = 'America/New_York'
export const dayDate = (key) => new Date(`${key}T12:00:00`)
export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
export function addDays(key, n) {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const dates = (start = START, end = END) => {
  const result = []
  for (let d = start; d <= end; d = addDays(d, 1)) result.push(d)
  return result
}
export const phase = (date) =>
  date < '2026-11-09'
    ? 'Recover & practice'
    : date < '2026-11-15'
      ? 'Climb with purpose'
      : 'Fresh for the trip'
export const minutes = (time) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
export const timeString = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
export const formatTime = (time) =>
  `${Number(time.slice(0, 2)) % 12 || 12}:${time.slice(3)} ${Number(time.slice(0, 2)) < 12 ? 'am' : 'pm'}`
export const shortDate = (date) =>
  dayDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const climbing = { '04': 70, '07': 80, '09': 80, 11: 75, 14: 65, 17: 40 }
const running = { '03': 20, '06': 20, 10: 25, 13: 20 }
const golf = { '05': 45, '08': 45, 12: 45, 15: 35 }
export function trainingFor(date) {
  if (date < START || date > END) return null
  const d = date.slice(-2)
  if (date === START)
    return {
      type: 'climb',
      title: 'Climbing already completed',
      duration: 60,
      detail: 'Logged from your November 2 check-in. Recover tonight.',
      steps: [],
    }
  if (climbing[d]) {
    const easy = d === '04' || d === '07'
    const primer = d === '17'
    return {
      type: 'climb',
      title: easy
        ? 'Easy climbing · movement & volume'
        : primer
          ? 'Short climbing primer'
          : 'Climb · controlled, trip-style practice',
      duration: climbing[d],
      detail: easy
        ? 'Comfortable V2–V4 to start; adjust to effort. No grinding, repeated failures, or finger pain. Stop while movement is crisp.'
        : primer
          ? 'A short warm-up and a few familiar, crisp moves. Finish fresh. No projects or catch-up volume.'
          : 'Choose familiar problems in the trip’s style. Rest 3–5 minutes between demanding attempts. Stop when performance drops; no max hangs or campus work.',
      steps: easy
        ? [
            'Warm up progressively · 15–20 min',
            'Quiet feet and accurate placement',
            'Relaxed grip and deliberate hip movement',
            'Finish before technique deteriorates',
          ]
        : [
            'Progressive warm-up · 15–20 min',
            'A few quality problems; full rests',
            'Stop before grinding or skin damage',
          ],
    }
  }
  if (golf[d])
    return {
      type: 'golf',
      title: 'Driving range · contact & consistency',
      duration: golf[d],
      detail:
        d === '15'
          ? 'Short final practice: about 30 balls, comfortable effort. Finish fresh.'
          : 'About 45 balls. Use a target and full routine. Consistent contact before extra speed.',
      steps: [
        '10 easy wedge shots · balanced finish',
        '15 iron shots · repeatable setup and target',
        '10 controlled drives · center contact',
        '10 alternating clubs/targets · one ball at a time',
        'Record solid contacts and target hits out of 10',
      ],
    }
  return null
}
function block(
  date,
  key,
  time,
  duration,
  title,
  type = 'routine',
  detail = '',
  extra = {},
) {
  return {
    id: `${date}:${key}`,
    originalDate: date,
    date,
    time,
    duration,
    title,
    type,
    detail,
    status: 'planned',
    ...extra,
  }
}
export function isActivity(task) {
  return ['climb', 'golf', 'run', 'recovery', 'todo'].includes(task.type)
}
export function baseDay(date) {
  if (date < START || date > END) return []
  const dow = dayDate(date).getDay()
  const work = [1, 3, 5].includes(dow)
  const blocks = []
  // Commitments provide context and reserve time, but are not checklist items.
  if (work)
    blocks.push(
      block(date, 'work-am', '09:00', 480, 'Work · coffee shop', 'fixed'),
    )
  if (dow === 2 || dow === 4)
    blocks.push(
      block(
        date,
        'class-am',
        '09:30',
        dow === 2 ? 440 : 150,
        'Class',
        'fixed',
        'Leave for campus by 9 am.',
      ),
    )
  const run = running[date.slice(-2)]
  if (run)
    blocks.push(
      block(
        date,
        'run',
        '07:00',
        run,
        'Easy morning run / run-walk',
        'run',
        'Conversational effort. Alternate jogging and walking if needed.',
      ),
    )
  else
    blocks.push(
      block(
        date,
        'walk',
        '06:45',
        25,
        'Gentle walk / mobility',
        'recovery',
        'Optional easy movement. Rest instead if tired.',
      ),
    )
  const training = trainingFor(date)
  if (training)
    blocks.push(
      block(
        date,
        'training',
        work || dow === 2 ? '17:30' : dow === 4 ? '13:30' : '10:00',
        training.duration,
        training.title,
        training.type,
        training.detail,
        { steps: training.steps, status: date === START ? 'done' : 'planned' },
      ),
    )
  if (dow === 0)
    blocks.push(
      block(
        date,
        'prep',
        '13:30',
        90,
        'Groceries & meal preparation',
        'todo',
        'Prepare packed lunches and easy protein snacks.',
        { deadline: END },
      ),
    )
  return blocks.sort((a, b) => a.time.localeCompare(b.time))
}
export const basePlan = () => dates().flatMap(baseDay)
export function materialize(records = {}) {
  const result = basePlan().map((task) => ({ ...task, ...records[task.id] }))
  for (const record of Object.values(records))
    if (record.custom) result.push(record)
  return result.filter((t) => !t.deleted)
}
export function mergeRecords(a = {}, b = {}) {
  const merged = { ...a }
  for (const [id, record] of Object.entries(b)) {
    // A completion recorded offline wins over unattended rollover.
    if (
      record.automatic &&
      merged[id]?.status === 'done' &&
      !merged[id].automatic
    )
      continue
    if (
      merged[id]?.automatic &&
      record.status === 'done' &&
      !record.automatic
    ) {
      merged[id] = record
      continue
    }
    if (
      !merged[id] ||
      record.updatedAt > merged[id].updatedAt ||
      (record.updatedAt === merged[id].updatedAt &&
        JSON.stringify(record) > JSON.stringify(merged[id]))
    )
      merged[id] = record
  }
  return merged
}
export function patchRecord(records, id, patch, stamp) {
  stamp ||= new Date(
    Math.max(Date.now(), (Date.parse(records[id]?.updatedAt) || 0) + 1),
  ).toISOString()
  return {
    ...records,
    [id]: { ...records[id], ...patch, id, updatedAt: stamp },
  }
}
// Stable IDs make retries idempotent without a new table or database migration.
export function rowId(id) {
  const hash = (seed) => {
    let h = seed
    for (const c of `${PLAN_KIND}:${id}`)
      h = Math.imul(h ^ c.charCodeAt(0), 16777619)
    return (h >>> 0).toString(16).padStart(8, '0')
  }
  const s = [2166136261, 123456789, 987654321, 314159265].map(hash).join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-8${s.slice(17, 20)}-${s.slice(20)}`
}
export function toRow(record) {
  // Separate versioned keys preserve the old summer schedule row. Each item
  // has its own row so changing one task cannot overwrite an unrelated task.
  return {
    user_id: `${STORAGE_PREFIX}${record.id}`,
    day_overrides: { kind: PLAN_KIND, record },
    phase_patterns: {},
  }
}
export function fromRows(rows = []) {
  const records = {}
  for (const row of rows) {
    const data = row.day_overrides
    if (data?.kind === PLAN_KIND && data.record?.id && data.record.updatedAt)
      records[data.record.id] = data.record
  }
  return records
}

export function canPlace(task, date, time, records) {
  if (date < START || date > END) return 'Choose a date within November 2–20.'
  const start = minutes(time),
    end = start + Number(task.duration)
  if (!Number.isFinite(start) || start < 390 || end > 1275)
    return 'Keep tasks between 6:30 am and 9:15 pm.'
  if (task.type === 'climb' && date >= '2026-11-18')
    return 'November 18–20 is protected from catch-up climbing.'
  const active = materialize(records).filter(
    (t) => t.id !== task.id && !['skipped', 'moved'].includes(t.status),
  )
  for (const other of active) {
    if (
      other.date === date &&
      other.type !== 'flex' &&
      other.time &&
      start < minutes(other.time) + other.duration &&
      end > minutes(other.time)
    )
      return `Overlaps ${other.title}.`
    if (
      task.type === 'climb' &&
      other.type === 'climb' &&
      other.date &&
      other.time
    ) {
      const hours = Math.abs(
        (new Date(`${date}T${time}:00`) -
          new Date(`${other.date}T${other.time}:00`)) /
          36e5,
      )
      if (hours < 48)
        return 'Leave at least 48 hours between climbing sessions.'
    }
  }
  return null
}
// Catch up once after midnight or a long absence. Repeated calls are idempotent.
// Unknown completion is kept visible; auto-moves can always be corrected.
export function reconcile(records, today, stamp = new Date().toISOString()) {
  let next = records
  const tasks = materialize(records)
  for (const task of tasks) {
    if (
      !task.date ||
      task.date >= today ||
      !['planned', 'partial'].includes(task.status)
    )
      continue
    if (['climb', 'golf', 'run'].includes(task.type)) {
      const target = materialize(next).find(
        (t) =>
          t.type === task.type &&
          t.date >= today &&
          t.date <= END &&
          ['planned', 'partial'].includes(t.status),
      )
      next = patchRecord(
        next,
        task.id,
        {
          automatic: true,
          status: target ? 'moved' : 'skipped',
          movedTo: target?.id || null,
          reason: target
            ? `Folded into ${shortDate(target.date)}’s session; no extra volume. If already done, correct the original day.`
            : 'No suitable session remains before the trip. Recovery protected.',
          previousStatus: task.status,
        },
        stamp,
      )
    } else if (task.type === 'todo') {
      // Unfinished tasks remain in the backlog rather than occupying work/sleep.
      next = patchRecord(
        next,
        task.id,
        {
          ...task,
          automatic: true,
          date: null,
          time: null,
          status: task.status,
          reason: 'Returned to your to-do list after its scheduled day.',
        },
        stamp,
      )
    }
  }
  return next
}
export function dayProgress(tasks, date) {
  const items = tasks.filter(
    (t) =>
      t.date === date &&
      isActivity(t) &&
      t.status !== 'moved' &&
      t.status !== 'skipped',
  )
  return {
    done: items.filter((t) => t.status === 'done').length,
    total: items.length,
  }
}
export function fuelAdvice(totals, goals = GOALS, confirmed = false) {
  if (!confirmed)
    return 'Finish logging the day before treating missing entries as a food shortfall.'
  const p = Math.max(0, Math.round(goals.protein - totals.protein)),
    c = Math.max(0, Math.round(goals.calories - totals.calories))
  if (!p && !c)
    return 'Targets met. Keep tomorrow’s normal meals and protein target.'
  return `${p} g protein and ${c} kcal below target. Plan a substantial lunch and an afternoon protein + carbohydrate snack tomorrow. Tomorrow’s targets stay unchanged; no accumulated food debt.`
}
