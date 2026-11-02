import test from 'node:test'
import assert from 'node:assert/strict'
import {
  baseDay,
  basePlan,
  dates,
  reconcile,
  patchRecord,
  materialize,
  canPlace,
  rowId,
  toRow,
  fromRows,
  dayProgress,
  todayKey,
  fuelAdvice,
  GOALS,
  mergeRecords,
  minutes,
} from '../src/lib/plan.js'
import { mergeNutrition, acknowledge } from '../src/lib/nutritionQueue.js'

test('19 explicit days with no training on November 3 except the easy run', () => {
  assert.equal(dates().length, 19)
  assert.equal(baseDay('2027-11-03').length, 0)
  assert.equal(
    baseDay('2026-11-03').filter((t) => t.type === 'climb').length,
    0,
  )
  assert.equal(baseDay('2026-11-03').filter((t) => t.type === 'run').length, 1)
  assert.equal(
    baseDay('2026-11-02').find((t) => t.type === 'climb').status,
    'done',
  )
})
test('base schedule has no overlapping timed blocks and protects actual commitments', () => {
  for (const date of dates()) {
    const day = baseDay(date)
    for (let i = 1; i < day.length; i++)
      assert.ok(
        minutes(day[i - 1].time) + day[i - 1].duration <= minutes(day[i].time),
        `${date}: ${day[i - 1].title} overlaps ${day[i].title}`,
      )
  }
  assert.equal(
    baseDay('2026-11-03').find((t) => t.id.endsWith(':commute')).time,
    '09:00',
  )
  assert.equal(
    baseDay('2026-11-04').find((t) => t.id.endsWith(':work-am')).time,
    '09:00',
  )
})
test('rollover consolidates missed training, preserves completions and is idempotent', () => {
  let state = patchRecord(
    {},
    '2026-11-04:training',
    { status: 'done' },
    '2026-11-04T20:00:00Z',
  )
  state = reconcile(state, '2026-11-09', '2026-11-09T05:10:00Z')
  assert.equal(state['2026-11-04:training'].status, 'done')
  assert.equal(state['2026-11-07:training'].movedTo, '2026-11-09:training')
  assert.equal(state['2026-11-07:training'].status, 'moved')
  assert.deepEqual(reconcile(state, '2026-11-09'), state)
  assert.equal(
    materialize(state).find((t) => t.id === '2026-11-09:training').duration,
    80,
  )
})
test('missed tasks cannot accumulate into the final recovery days', () => {
  const state = reconcile({}, '2026-11-18', '2026-11-18T05:10:00Z')
  assert.equal(state['2026-11-17:training'].status, 'skipped')
  assert.ok(
    !materialize(state).some(
      (t) => t.type === 'climb' && t.date >= '2026-11-18',
    ),
  )
})
test('unfinished todos return to backlog; completed ones stay done', () => {
  let state = patchRecord({}, '2026-11-02:todo-a', {
    custom: true,
    originalDate: '2026-11-02',
    date: '2026-11-03',
    time: '19:45',
    title: 'Homework',
    duration: 30,
    type: 'todo',
    status: 'partial',
  })
  const next = reconcile(state, '2026-11-04')
  assert.equal(next['2026-11-02:todo-a'].date, null)
  assert.equal(next['2026-11-02:todo-a'].status, 'partial')
  state = patchRecord(state, '2026-11-02:todo-a', { status: 'done' })
  assert.equal(
    reconcile(state, '2026-11-04')['2026-11-02:todo-a'].date,
    '2026-11-03',
  )
})
test('manual scheduling rejects conflicts, close climbing sessions and taper', () => {
  const task = baseDay('2026-11-04').find((t) => t.type === 'climb')
  assert.match(canPlace(task, '2026-11-05', '17:30', {}), /48 hours/)
  assert.match(canPlace(task, '2026-11-18', '17:30', {}), /protected/)
  assert.match(
    canPlace(
      { id: 'todo', type: 'todo', duration: 30 },
      '2026-11-03',
      '09:30',
      {},
    ),
    /Overlaps/,
  )
  assert.equal(
    canPlace(
      { id: 'todo', type: 'todo', duration: 30 },
      '2026-11-03',
      '19:45',
      {},
    ),
    null,
  )
})
test('past dates do not imply completion', () => {
  assert.equal(dayProgress(basePlan(), '2026-11-03').done, 0)
})
test('stable storage identity, safe legacy parsing and newer edits win', () => {
  const record = {
    id: '2026-11-04:training',
    status: 'done',
    updatedAt: '2026-11-04T20:00:00Z',
  }
  assert.match(
    rowId(record.id),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  assert.equal(
    new Set(basePlan().map((t) => rowId(t.id))).size,
    basePlan().length,
  )
  assert.deepEqual(fromRows([toRow(record), { notes: 'old personal note' }]), {
    [record.id]: record,
  })
  assert.equal(
    mergeRecords(
      { a: { updatedAt: '2026-11-04', status: 'done' } },
      { a: { updatedAt: '2026-11-03', status: 'planned' } },
    ).a.status,
    'done',
  )
})
test('New York midnight is independent of browser or server timezone', () => {
  assert.equal(todayKey(new Date('2026-11-03T04:59:59Z')), '2026-11-02')
  assert.equal(todayKey(new Date('2026-11-03T05:00:00Z')), '2026-11-03')
})
test('food advice distinguishes unlogged food and never creates macro debt', () => {
  assert.match(fuelAdvice({ protein: 0, calories: 0 }), /Finish logging/)
  assert.match(
    fuelAdvice({ protein: 80, calories: 2000 }, GOALS, true),
    /40 g protein and 550 kcal/,
  )
  assert.match(
    fuelAdvice({ protein: 80, calories: 2000 }, GOALS, true),
    /stay unchanged/,
  )
  assert.equal(GOALS.protein, 120)
})
test('offline food inserts and deletes survive stale server responses and retries', () => {
  const row = { id: 'meal-1', created_at: '2026-11-03T10:00:00Z' }
  const pending = {
    'meal-1': { id: 'meal-1', row, type: 'upsert', version: '1' },
  }
  assert.deepEqual(mergeNutrition([], pending), [row])
  assert.deepEqual(mergeNutrition([row], pending), [row])
  const deletion = { 'meal-1': { id: 'meal-1', type: 'delete', version: '2' } }
  assert.deepEqual(mergeNutrition([row], deletion), [])
  assert.deepEqual(acknowledge(deletion, pending), deletion)
  assert.deepEqual(acknowledge(deletion, deletion), {})
})

test('rapid updates have monotonic revisions and offline completion beats automatic rollover', () => {
  const a = patchRecord({}, 'task', { status: 'planned' })
  const b = patchRecord(a, 'task', { status: 'done' })
  assert.ok(b.task.updatedAt > a.task.updatedAt)
  const manual = {
    task: { status: 'done', automatic: false, updatedAt: '2026-11-03' },
  }
  const automatic = {
    task: { status: 'moved', automatic: true, updatedAt: '2026-11-04' },
  }
  assert.equal(mergeRecords(manual, automatic).task.status, 'done')
  assert.equal(mergeRecords(automatic, manual).task.status, 'done')
})
