import { dayKey } from './date'

// Peak — training program logic.
// Riley · V7–V9 · summer bouldering block: Jun 3 – Aug 10, 2026.
// 10 weeks, 3 phases. Each training week runs Wed → Tue (the block opens on a
// Wednesday). Day types and accessories are specified per week, not by a single
// repeating weekday template, so deload/peak weeks differ from normal weeks.
//
// All date math is year-relative to the date passed in, so this keeps working
// next summer without edits.

// Months are 0-indexed (Jan = 0). Jun = 5, Jul = 6, Aug = 7.
const PHASES = [
  { id: 'I', name: 'Phase I · Base', start: [5, 3], end: [5, 23] }, // Jun 3 – Jun 23
  { id: 'II', name: 'Phase II · Strength', start: [5, 24], end: [6, 21] }, // Jun 24 – Jul 21
  { id: 'III', name: 'Phase III · Sends', start: [6, 22], end: [7, 10] }, // Jul 22 – Aug 10
]

// First day of the block (Phase I start) — Wed Jun 3.
const PROGRAM_START = [5, 3]

const DAY_MS = 24 * 60 * 60 * 1000

function atMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function phaseDates(phase, year) {
  return {
    start: new Date(year, phase.start[0], phase.start[1]),
    // inclusive end → push to end of that day
    end: new Date(year, phase.end[0], phase.end[1], 23, 59, 59),
  }
}

/** Returns the active phase for a date (clamped to first/last phase). */
export function getPhase(date) {
  const year = date.getFullYear()
  for (const phase of PHASES) {
    const { start, end } = phaseDates(phase, year)
    if (date >= start && date <= end) return phase
  }
  // Before the program starts → Phase I; after it ends → Phase III.
  const firstStart = phaseDates(PHASES[0], year).start
  return date < firstStart ? PHASES[0] : PHASES[PHASES.length - 1]
}

/** Fraction (0–1) of the way through the given phase on `date`. */
export function getPhaseProgress(date, phase) {
  const { start, end } = phaseDates(phase, date.getFullYear())
  const total = end - start
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, (date - start) / total))
}

function programStartDate(date) {
  return atMidnight(new Date(date.getFullYear(), PROGRAM_START[0], PROGRAM_START[1]))
}

/** Program week number, 1-based, counted from Jun 3. Clamped to 1..10. */
export function getProgramWeek(date) {
  const diff = atMidnight(date) - programStartDate(date)
  const week = Math.floor(diff / (7 * DAY_MS)) + 1
  return Math.min(10, Math.max(1, week))
}

/** Program day, 1-based, counted from Jun 3. */
export function getProgramDay(date) {
  return Math.max(1, Math.floor((atMidnight(date) - programStartDate(date)) / DAY_MS) + 1)
}

/** { day, total } — day number within the current phase, and its length. */
export function getPhaseDayInfo(date, phase) {
  const { start, end } = phaseDates(phase, date.getFullYear())
  const startMid = atMidnight(start)
  const endMid = atMidnight(end)
  const total = Math.round((endMid - startMid) / DAY_MS) + 1
  const day = Math.min(total, Math.max(1, Math.floor((atMidnight(date) - startMid) / DAY_MS) + 1))
  return { day, total }
}

/* ------------------------------------------------------------------ *
 * The plan — 10 weeks, each Wed → Tue.
 *
 * Day codes:
 *   C  = Climb (no accessory)
 *   CH = Climb + Hangboard (after climbing)
 *   CP = Climb + Weighted pull-ups (after climbing)
 *   G  = Gym (bench 3×5 + chest + core)
 *   R  = Rest + Run (rest from climbing, easy run)
 *   X  = Full rest (no run) — true zero day
 *
 * Rest scales with intensity: Phase I (volume) runs 4 climb days; Phase II
 * (strength) and Phase III (sends) drop to 3 climb days with an extra rest day
 * to absorb the higher load. Phase III's pre-send day is a full rest (X) so you
 * arrive fresh for the Friday session.
 *
 * Rules baked into the plan: hangboard and weighted pull-ups are always AFTER
 * climbing and never on the same day; pull-ups are Phase II only (weeks 4–6).
 * ------------------------------------------------------------------ */
const WEEK_PLANS = [
  // 1 — Phase I · base: volume, no accessories yet
  { phase: 'I', tag: null, days: { Wed: 'C', Thu: 'R', Fri: 'C', Sat: 'G', Sun: 'C', Mon: 'R', Tue: 'C' } },
  // 2 — Phase I · hangboard introduced (repeaters)
  { phase: 'I', tag: null, days: { Wed: 'CH', Thu: 'R', Fri: 'C', Sat: 'G', Sun: 'C', Mon: 'R', Tue: 'CH' } },
  // 3 — Phase I · DELOAD (cut climb volume ~40%, no hangboard)
  { phase: 'I', tag: 'deload', days: { Wed: 'C', Thu: 'R', Fri: 'R', Sat: 'G', Sun: 'C', Mon: 'R', Tue: 'R' } },
  // 4 — Phase II · strength/power: max hangs + weighted pulls. 3 climb days
  //     (2 hang + 1 pull); Tue is rest so the heavier load gets an extra day off.
  { phase: 'II', tag: null, days: { Wed: 'CH', Thu: 'R', Fri: 'CP', Sat: 'G', Sun: 'CH', Mon: 'R', Tue: 'R' } },
  // 5 — Phase II · progress loads
  { phase: 'II', tag: null, days: { Wed: 'CH', Thu: 'R', Fri: 'CP', Sat: 'G', Sun: 'CH', Mon: 'R', Tue: 'R' } },
  // 6 — Phase II · PEAK intensity (heaviest week)
  { phase: 'II', tag: 'peak', days: { Wed: 'CH', Thu: 'R', Fri: 'CP', Sat: 'G', Sun: 'CH', Mon: 'R', Tue: 'R' } },
  // 7 — Phase II · DELOAD (no hangboard, no pulls)
  { phase: 'II', tag: 'deload', days: { Wed: 'C', Thu: 'R', Fri: 'R', Sat: 'G', Sun: 'C', Mon: 'R', Tue: 'R' } },
  // 8 — Phase III · sends: 3 climb days, hangboard maintenance (Sun only).
  //     Thu is a full rest (X) to arrive fresh for the Fri send session.
  { phase: 'III', tag: null, days: { Wed: 'C', Thu: 'X', Fri: 'C', Sat: 'G', Sun: 'CH', Mon: 'R', Tue: 'R' } },
  // 9 — Phase III · sends: no accessories, execute
  { phase: 'III', tag: null, days: { Wed: 'C', Thu: 'X', Fri: 'C', Sat: 'G', Sun: 'C', Mon: 'R', Tue: 'R' } },
  // 10 — Phase III · PEAK: final send week
  { phase: 'III', tag: 'peak', days: { Wed: 'C', Thu: 'X', Fri: 'C', Sat: 'G', Sun: 'C', Mon: 'R', Tue: 'R' } },
]

const DOW_KEY = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }
const TYPE_OF = { C: 'climb', CH: 'climb', CP: 'climb', G: 'gym', R: 'restrun', X: 'rest' }
const ACCESSORY_OF = { CH: 'hang', CP: 'pulls' }

// Weekdays in block order (the program week runs Wed → Tue). Used by the editors.
export const WEEKDAYS = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue']

// The six session types, in picker order, with display labels.
export const DAY_TYPES = [
  { code: 'C', label: 'Climb', short: 'Climb' },
  { code: 'CH', label: 'Climb + Hang', short: 'Hang' },
  { code: 'CP', label: 'Climb + Pulls', short: 'Pulls' },
  { code: 'G', label: 'Gym', short: 'Gym' },
  { code: 'R', label: 'Rest + Run', short: 'Run' },
  { code: 'X', label: 'Full Rest', short: 'Rest' },
]
const DAY_TYPE_LABEL = Object.fromEntries(DAY_TYPES.map((t) => [t.code, t.label]))
export function dayTypeLabel(code) {
  return DAY_TYPE_LABEL[code] || code
}

// Phases as a plain list for the editor (id + display name).
export const PHASE_LIST = PHASES.map((p) => ({ id: p.id, name: p.name }))

// Seed pattern for each phase's editor — a representative *normal* week (deload
// and peak weeks are intentionally excluded; they keep their own schedules).
const DEFAULT_PHASE_PATTERNS = {
  I: { Wed: 'CH', Thu: 'R', Fri: 'C', Sat: 'G', Sun: 'C', Mon: 'R', Tue: 'CH' },
  II: { Wed: 'CH', Thu: 'R', Fri: 'CP', Sat: 'G', Sun: 'CH', Mon: 'R', Tue: 'R' },
  III: { Wed: 'C', Thu: 'X', Fri: 'C', Sat: 'G', Sun: 'C', Mon: 'R', Tue: 'R' },
}

/* ------------------------------------------------------------------ *
 * Schedule overrides — user edits layered on top of WEEK_PLANS.
 *
 *   dayOverrides:  { 'YYYY-MM-DD': code }  one-off edit to a single date
 *   phasePatterns: { I|II|III: {Wed..Tue: code} }  per-phase weekly template
 *
 * A day's code resolves: date override → phase pattern (skipped on protected
 * deload weeks) → baked WEEK_PLANS default. The store is module-level so the
 * pure lookup functions below can read it; React views subscribe through
 * useSchedule() (useSyncExternalStore) to re-render when it changes.
 * ------------------------------------------------------------------ */
let scheduleState = { dayOverrides: {}, phasePatterns: {} }
const scheduleListeners = new Set()

export function subscribeSchedule(listener) {
  scheduleListeners.add(listener)
  return () => scheduleListeners.delete(listener)
}
export function getScheduleSnapshot() {
  return scheduleState
}
function emitSchedule(next) {
  scheduleState = next
  scheduleListeners.forEach((l) => l())
  return next
}

/** Replace the whole override set (used when hydrating from storage/server). */
export function replaceSchedule({ dayOverrides = {}, phasePatterns = {} } = {}) {
  return emitSchedule({ dayOverrides, phasePatterns })
}
export function setDayOverride(key, code) {
  return emitSchedule({
    ...scheduleState,
    dayOverrides: { ...scheduleState.dayOverrides, [key]: code },
  })
}
export function clearDayOverride(key) {
  const { [key]: _removed, ...rest } = scheduleState.dayOverrides
  return emitSchedule({ ...scheduleState, dayOverrides: rest })
}
export function setPhasePattern(phaseId, days) {
  return emitSchedule({
    ...scheduleState,
    phasePatterns: { ...scheduleState.phasePatterns, [phaseId]: days },
  })
}
export function clearPhasePattern(phaseId) {
  const { [phaseId]: _removed, ...rest } = scheduleState.phasePatterns
  return emitSchedule({ ...scheduleState, phasePatterns: rest })
}

// Resolves the day code for a date through the override layers.
function resolveDayCode(date, plan) {
  const dow = DOW_KEY[date.getDay()]
  const override = scheduleState.dayOverrides[dayKey(date)]
  if (override && TYPE_OF[override]) return override
  // Deload weeks keep their reduced schedule — a uniform phase pattern would
  // silently add the volume back, so we never apply it there.
  if (plan.tag !== 'deload') {
    const code = scheduleState.phasePatterns[plan.phase]?.[dow]
    if (code && TYPE_OF[code]) return code
  }
  return plan.days[dow]
}

/** Effective weekly pattern for a phase (user override if set, else the seed). */
export function getPhasePattern(phaseId) {
  return scheduleState.phasePatterns[phaseId] || DEFAULT_PHASE_PATTERNS[phaseId]
}
/** Whether a phase's pattern has been customised by the user. */
export function isPhasePatternCustom(phaseId) {
  return !!scheduleState.phasePatterns[phaseId]
}
/** One-off override code for a date, or null if it's running on the default. */
export function getDayOverride(date) {
  return scheduleState.dayOverrides[dayKey(date)] || null
}
/** Baked baseline code for a date, ignoring all user overrides. */
export function getDefaultDayCode(date) {
  const plan = WEEK_PLANS[getProgramWeek(date) - 1]
  return plan.days[DOW_KEY[date.getDay()]]
}
/** Resolved day code for a date (after applying overrides). */
export function getDayCode(date) {
  return daySpec(date).code
}

// Resolves a date to its place in the plan: week (1..10), the week's plan entry,
// the resolved day code (after overrides), the app session type, and accessory.
function daySpec(date) {
  const week = getProgramWeek(date)
  const plan = WEEK_PLANS[week - 1]
  const code = resolveDayCode(date, plan)
  return { week, plan, code, type: TYPE_OF[code], accessory: ACCESSORY_OF[code] || null }
}

const SESSION_LABELS = {
  hang: 'Climb + Hang',
  pulls: 'Climb + Pulls',
}

export function getSession(date) {
  const { type, accessory } = daySpec(date)
  let label
  if (type === 'gym') label = 'Gym'
  else if (type === 'restrun') label = 'Rest + Run'
  else if (type === 'rest') label = 'Rest'
  else label = SESSION_LABELS[accessory] || 'Climb'
  return { type, label, accessory }
}

/* ------------------------------------------------------------------ *
 * Per-day prescription details (shown in the expanded checklist)
 * ------------------------------------------------------------------ */

function benchDetail(week, plan, phase) {
  if (plan.tag === 'deload') return 'Back off ~10% · controlled'
  if (week === 5) return 'Progress load from last week'
  if (week === 6) return 'Peak load — heaviest of the block'
  if (phase.id === 'III') return 'Maintain · no PR attempts'
  return 'Heavy · 3×5'
}

function hangDetail(week) {
  if (week === 2) return 'Repeaters · 7s on / 3s off · 4–5 sets per grip'
  if (week === 4) return 'Max hangs · 10s near-max · long rests · find working weight'
  if (week === 5) return 'Max hangs · 10s · add weight if fresh'
  if (week === 6) return 'Max hangs · 10s · heaviest loads of the block'
  if (week === 8) return 'Maintenance only · 1 set per grip · light'
  return 'Max hangs · 10s'
}

function pullsDetail(week) {
  if (week === 4) return '4×4–5 · moderate · find working weight'
  if (week === 5) return '4×4–5 · +5 lb from last week'
  if (week === 6) return '4×3–4 · heaviest week — watch your elbows'
  return '4×4–5'
}

function climbDetail(plan, phase) {
  if (plan.tag === 'deload') {
    return phase.id === 'I'
      ? 'Reduced volume (~40%) · V5–V7 · easy movement'
      : 'Reduced volume · easy movement, no projecting'
  }
  if (phase.id === 'I') return 'Volume · V5–V7 · slab & vertical, moderate grades'
  if (phase.id === 'II') return 'Limit bouldering · V8–V9 projects'
  return 'Send projects · redpoint tactics, full rest between burns'
}

function runDetail(phase) {
  // Phase I is the volume block — every run stays fully aerobic. Once strength
  // and send phases begin, runs go 80/20: a Zone 2 base with a Zone 4–5 dose.
  return phase.id === 'I'
    ? 'All Zone 2 · conversational pace'
    : '80% Zone 2 · 20% Zone 4–5 efforts'
}

/**
 * Builds the checklist for a given day.
 * Returns { kind: 'list', items: [{ key, label, detail }] }.
 */
export function getChecklist({ session, phase, date }) {
  const { accessory, week, plan } = daySpec(date)

  if (session.type === 'rest') {
    // True zero day — nothing to check off; the card shows a rest state.
    return { kind: 'list', items: [] }
  }

  if (session.type === 'restrun') {
    // Phase I runs are pure Zone 2; later phases mix in Zone 4–5 (80/20).
    const runLabel = phase.id === 'I' ? 'Zone 2 Run' : 'Run · Z2 + Z4–5'
    return {
      kind: 'list',
      items: [{ key: 'zone2-run', label: runLabel, detail: runDetail(phase) }],
    }
  }

  if (session.type === 'gym') {
    const light = plan.tag === 'deload'
    return {
      kind: 'list',
      items: [
        { key: 'bench', label: 'Bench press 3×5', detail: benchDetail(week, plan, phase) },
        { key: 'chest', label: 'Chest', detail: light ? 'Accessory pressing · lighter' : 'Accessory pressing volume' },
        { key: 'core', label: 'Core', detail: light ? 'Light core' : 'Core circuit' },
      ],
    }
  }

  // Climb day — bouldering first, then any accessory (always after climbing).
  const items = [{ key: 'bouldering', label: 'Bouldering', detail: climbDetail(plan, phase) }]
  if (accessory === 'hang') {
    items.push({ key: 'hangboard', label: 'Hangboard · after climbing', detail: hangDetail(week) })
  }
  if (accessory === 'pulls') {
    items.push({ key: 'weighted-pullups', label: 'Weighted pull-ups · after climbing', detail: pullsDetail(week) })
  }
  return { kind: 'list', items }
}

// One-line "what kind of day is this" focus, by session type and (for
// climbing) the training phase.
const CLIMB_FOCUS = {
  I: 'Capacity · high volume, moderate grades',
  II: 'Strength · limit projecting',
  III: 'Sends · execute projects',
}

export function getDayFocus({ session, phase }) {
  switch (session.type) {
    case 'climb':
      return CLIMB_FOCUS[phase.id] ?? 'Bouldering session'
    case 'gym':
      return 'Bench, chest & core'
    case 'restrun':
      return phase.id === 'I' ? 'Active recovery · easy run' : 'Aerobic base + short intensity'
    case 'rest':
      return 'Full rest · stay off your fingers'
    default:
      return ''
  }
}

/** Greeting based on hour of day. */
export function getGreeting(date) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "Monday, June 2" */
export function formatLongDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/** "Monday, Jun 2" */
export function formatMediumDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/** Recovery score 0–100 from HRV (ms, baseline max 100) + sleep score (0–100). */
export function computeRecovery(hrvScore, sleepScore) {
  const normHrv = Math.min(1, hrvScore / 100)
  const normSleep = Math.min(1, sleepScore / 100)
  return Math.round((normHrv * 0.6 + normSleep * 0.4) * 100)
}

/** Tier color for a recovery score. */
export function recoveryTier(score) {
  if (score >= 70) return { color: '#30d158', label: 'Recovered' }
  if (score >= 40) return { color: '#ffd60a', label: 'Moderate' }
  return { color: '#ff453a', label: 'Low' }
}
