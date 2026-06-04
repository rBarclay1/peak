import { useEffect, useState } from 'react'
import { Flame, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import CardFrame from './CardFrame.jsx'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useNutrition } from '../hooks/useNutrition'
import { useSavedFoods } from '../hooks/useSavedFoods'

const COLORS = {
  protein: '#ff375f', // pink/red
  calories: '#ff9f0a', // orange
  carbs: '#0a84ff', // blue
  fat: '#bf5af2', // purple
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

const pct = (v, g) => (g ? Math.min(100, Math.round((v / g) * 100)) : 0)
const r0 = (v) => Math.round(Number(v) || 0)

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Sensible default meal based on time of day.
function defaultMealType() {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export default function FuelCard({ expandedId, onExpand, onCollapse }) {
  const { logs, totals, goals, addLog, removeLog } = useNutrition()
  const { foods, saveFood, removeFood } = useSavedFoods()
  const [mode, setMode] = useState('view') // 'view' | 'add'
  const isExpanded = expandedId === 'fuel'

  // Reset to the log view whenever the card collapses.
  useEffect(() => {
    if (!isExpanded) setMode('view')
  }, [isExpanded])

  const proteinLeft = Math.max(0, goals.protein - totals.protein)

  const preview = (
    <div className="h-full flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Fuel
      </span>

      {/* Weighted rings — protein hero, calories second */}
      <div className="flex-1 flex items-center justify-center gap-5">
        <div className="flex flex-col items-center gap-1.5">
          <Ring size={86} stroke={9} pct={pct(totals.protein, goals.protein)} color={COLORS.protein} animate>
            <div className="flex flex-col items-center leading-none">
              <span className="font-display text-2xl font-extrabold tracking-tight text-textPrimary">
                {r0(totals.protein)}
              </span>
              <span className="mt-0.5 text-[10px] font-medium text-textMuted">/{goals.protein}g</span>
            </div>
          </Ring>
          <span className="text-[11px] font-semibold text-textMuted">Protein</span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <Ring size={54} stroke={6} pct={pct(totals.calories, goals.calories)} color={COLORS.calories} animate>
            <Flame className="size-4" style={{ color: COLORS.calories }} />
          </Ring>
          <span className="text-[11px] font-semibold text-textMuted">
            {r0(totals.calories).toLocaleString()} kcal
          </span>
        </div>
      </div>

      {/* Minor macros */}
      <div className="flex flex-col gap-2">
        <MiniBar label="Carbs" value={totals.carbs} goal={goals.carbs} color={COLORS.carbs} />
        <MiniBar label="Fat" value={totals.fat} goal={goals.fat} color={COLORS.fat} />
      </div>
    </div>
  )

  const expanded =
    mode === 'add' ? (
      <AddFood
        savedFoods={foods}
        onLog={addLog}
        onSaveFood={saveFood}
        onRemoveSaved={removeFood}
        onDone={() => setMode('view')}
      />
    ) : (
      <div>
        <h1 className="text-3xl font-bold text-textPrimary">Fuel</h1>
        <p className="mt-1.5 text-[15px] font-medium text-textSecondary">
          {r0(totals.calories).toLocaleString()} / {goals.calories.toLocaleString()} kcal today
        </p>

        {/* Hero rings */}
        <div className="my-8 flex items-center justify-center gap-10" key={isExpanded ? 'open' : 'closed'}>
          <div className="flex flex-col items-center gap-2">
            <Ring size={148} stroke={14} pct={pct(totals.protein, goals.protein)} color={COLORS.protein} animate={isExpanded}>
              <div className="flex flex-col items-center leading-none">
                <span className="font-display text-5xl font-extrabold tracking-tight text-textPrimary">
                  {r0(totals.protein)}
                </span>
                <span className="mt-1 text-xs font-medium text-textMuted">of {goals.protein}g</span>
              </div>
            </Ring>
            <span className="text-sm font-semibold" style={{ color: COLORS.protein }}>
              Protein · {r0(proteinLeft)}g left
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Ring size={96} stroke={11} pct={pct(totals.calories, goals.calories)} color={COLORS.calories} animate={isExpanded}>
              <div className="flex flex-col items-center leading-none">
                <Flame className="size-5" style={{ color: COLORS.calories }} />
                <span className="mt-1 font-display text-lg font-bold text-textPrimary">
                  {r0(totals.calories).toLocaleString()}
                </span>
              </div>
            </Ring>
            <span className="text-sm font-semibold" style={{ color: COLORS.calories }}>
              Calories
            </span>
          </div>
        </div>

        {/* Minor macros, full bars */}
        <div className="flex flex-col gap-5">
          <MacroBar
            label="Carbs"
            right={`${r0(totals.carbs)}g / ${goals.carbs}g`}
            pct={pct(totals.carbs, goals.carbs)}
            color={COLORS.carbs}
          />
          <MacroBar
            label="Fat"
            right={`${r0(totals.fat)}g / ${goals.fat}g`}
            pct={pct(totals.fat, goals.fat)}
            color={COLORS.fat}
          />
        </div>

        {/* Today's meals */}
        <div className="mt-10">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground mb-3">
            Today&apos;s meals
          </h2>
          {logs.length === 0 ? (
            <Card className="bg-card py-10 text-center text-muted-foreground">No meals logged yet</Card>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {logs.map((log) => (
                <MealRow key={log.id} log={log} onRemove={removeLog} />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-8 flex items-center justify-end">
          <Button
            type="button"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              setMode('add')
            }}
            className="size-14 rounded-full [&_svg]:size-6"
            aria-label="Add food"
          >
            <Plus />
          </Button>
        </div>
      </div>
    )

  return (
    <CardFrame
      id="fuel"
      expandedId={expandedId}
      onExpand={onExpand}
      onCollapse={onCollapse}
      preview={preview}
      expanded={expanded}
    />
  )
}

// ── Add-food flow: quick-tap saved foods + manual macro entry ──────────────
function AddFood({ savedFoods, onLog, onSaveFood, onRemoveSaved, onDone }) {
  const [name, setName] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [calories, setCalories] = useState('')
  const [calTouched, setCalTouched] = useState(false)
  const [mealType, setMealType] = useState(defaultMealType())
  const [saveFav, setSaveFav] = useState(false)

  // AI text estimate
  const [description, setDescription] = useState('')
  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState('')
  const [assumptions, setAssumptions] = useState('')

  // Calories default to the 4/4/9 estimate from macros, but stay editable.
  const autoCal = Math.round(num(protein) * 4 + num(carbs) * 4 + num(fat) * 9)
  const hasMacros = !!(protein || carbs || fat)
  const shownCal = calTouched ? calories : hasMacros ? String(autoCal) : ''

  const logFood = (food) => {
    if (!food.protein_g && !food.carbs_g && !food.fat_g && !food.calories) return
    onLog(food)
    onDone()
  }

  const submitManual = (e) => {
    e.stopPropagation()
    const food = {
      name: name.trim() || 'Food',
      meal_type: mealType,
      protein_g: num(protein),
      carbs_g: num(carbs),
      fat_g: num(fat),
      calories: num(calTouched ? calories : autoCal),
    }
    if (saveFav) onSaveFood(food)
    logFood(food)
  }

  const quickAdd = (e, f) => {
    e.stopPropagation()
    logFood({
      name: f.name,
      meal_type: defaultMealType(),
      calories: f.calories,
      protein_g: f.protein_g,
      carbs_g: f.carbs_g,
      fat_g: f.fat_g,
    })
  }

  // Ask the AI to estimate macros from a free-text description, then fill the
  // manual fields so the user can review/edit before logging.
  const estimate = async (e) => {
    e.stopPropagation()
    const desc = description.trim()
    if (!desc || estimating) return
    setEstimating(true)
    setEstimateError('')
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setName(data.name || desc)
      setProtein(String(Math.round(num(data.protein_g))))
      setCarbs(String(Math.round(num(data.carbs_g))))
      setFat(String(Math.round(num(data.fat_g))))
      setCalories(String(Math.round(num(data.calories))))
      setCalTouched(true)
      setAssumptions(data.assumptions || '')
    } catch (err) {
      setEstimateError(err.message || 'Could not estimate')
    } finally {
      setEstimating(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-textPrimary">Add food</h1>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onDone()
          }}
          className="rounded-full"
        >
          Cancel
        </Button>
      </div>

      {/* Quick add from saved foods */}
      {savedFoods.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">Saved foods</h2>
          <div className="flex flex-col divide-y divide-border">
            {savedFoods.map((f) => (
              <SavedFoodRow
                key={f.id}
                food={f}
                onAdd={(e) => quickAdd(e, f)}
                onRemove={(e) => {
                  e.stopPropagation()
                  onRemoveSaved(f.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Describe it — AI estimate */}
      <h2 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">Describe it</h2>
      <div className="mb-2 flex gap-2">
        <input
          type="text"
          value={description}
          placeholder='e.g. "2 eggs, toast & butter"'
          onChange={(e) => setDescription(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') estimate(e)
          }}
          className="min-w-0 flex-1 rounded-xl bg-secondary px-3.5 py-3 text-base font-medium text-textPrimary outline-none placeholder:text-textMuted"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={estimating || !description.trim()}
          onClick={estimate}
          className="shrink-0 rounded-xl px-4 [&_svg]:size-4"
        >
          {estimating ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Estimate
        </Button>
      </div>
      {estimateError && <p className="mb-2 text-xs text-destructive">{estimateError}</p>}
      {assumptions && <p className="mb-3 text-xs text-textMuted">Assumed: {assumptions}</p>}

      {/* Manual entry */}
      <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
        Or enter manually
      </h2>
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={name}
          placeholder="Food name (optional)"
          onChange={(e) => setName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-xl bg-secondary px-3.5 py-3 text-base font-medium text-textPrimary outline-none placeholder:text-textMuted"
        />

        <div className="flex gap-2">
          <NumField label="Protein" color={COLORS.protein} suffix="g" value={protein} onChange={setProtein} />
          <NumField label="Carbs" color={COLORS.carbs} suffix="g" value={carbs} onChange={setCarbs} />
          <NumField label="Fat" color={COLORS.fat} suffix="g" value={fat} onChange={setFat} />
        </div>

        <NumField
          label="Calories"
          suffix="kcal"
          value={shownCal}
          onChange={(v) => {
            setCalTouched(true)
            setCalories(v)
          }}
        />

        {/* Meal-type segmented selector */}
        <div className="flex gap-2">
          {MEAL_TYPES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMealType(m)
              }}
              className={cn(
                'flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition-colors',
                mealType === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-textMuted',
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Save to favorites */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSaveFav((s) => !s)
          }}
          className="flex items-center gap-2.5 py-1"
        >
          <Checkbox checked={saveFav} className="pointer-events-none" />
          <span className="text-sm text-textSecondary">Save to my foods for quick logging</span>
        </button>

        <Button
          type="button"
          onClick={submitManual}
          className="mt-1 h-auto w-full rounded-2xl py-3.5 text-base font-semibold"
        >
          Log food{shownCal ? ` · ${shownCal} kcal` : ''}
        </Button>
      </div>
    </div>
  )
}

// Labeled number input used in the manual-entry macro row.
function NumField({ label, value, onChange, suffix, color }) {
  return (
    <label className="flex-1">
      <span
        className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-textMuted"
        style={color ? { color } : undefined}
      >
        {label}
      </span>
      <div className="flex items-center rounded-xl bg-secondary px-3 py-2.5">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-full min-w-0 bg-transparent text-base font-semibold tabular-nums text-textPrimary outline-none placeholder:text-textMuted"
        />
        {suffix && <span className="ml-1 text-sm text-textMuted">{suffix}</span>}
      </div>
    </label>
  )
}

function SavedFoodRow({ food, onAdd, onRemove }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <button type="button" onClick={onAdd} className="flex flex-1 items-center justify-between pr-3 text-left">
        <span className="truncate text-[15px] font-medium text-textPrimary">{food.name}</span>
        <span className="ml-3 shrink-0 text-xs tabular-nums text-textMuted">
          {r0(food.calories)} kcal · {r0(food.protein_g)}P
        </span>
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove saved food"
          className="rounded-full p-1.5 text-textMuted transition-colors hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Log this food"
          className="rounded-full bg-secondary p-1.5 text-textPrimary"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

function MealRow({ log, onRemove }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <span className="block truncate text-[15px] font-medium text-textPrimary">{log.meal_name}</span>
        <span className="text-xs capitalize text-textMuted">{log.meal_type}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-right text-[11px] leading-tight tabular-nums text-textMuted">
          <span className="block font-semibold text-textSecondary">{r0(log.calories)} kcal</span>
          {r0(log.protein_g)}p · {r0(log.carbs_g)}c · {r0(log.fat_g)}f
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(log.id)
          }}
          aria-label="Remove meal"
          className="rounded-full p-1.5 text-textMuted transition-colors hover:text-destructive"
        >
          <X className="size-4" />
        </button>
      </div>
    </li>
  )
}

// SVG progress ring. The arc shows its final fill immediately; when `animate`
// is set (e.g. on expand) the whole ring spins one full turn instead of
// re-filling — the preview already shows it filled. The fill itself still
// transitions smoothly when the underlying totals change.
function Ring({ size, stroke, pct, color, animate, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(1, pct / 100))

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{
          transform: 'rotate(-90deg)',
          animation: animate ? 'ring-spin 0.9s cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
        }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2c2c2e" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

// Compact label · bar · value row used for the minor macros on the preview.
function MiniBar({ label, value, goal, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[10px] font-semibold text-textMuted">{label}</span>
      <Progress
        value={pct(value, goal)}
        style={{ '--bar': color }}
        className="h-1 flex-1 bg-secondary [&>[data-slot=progress-indicator]]:bg-(--bar)"
      />
      <span className="w-14 text-right text-[10px] font-medium tabular-nums text-textMuted">
        {r0(value)}/{goal}g
      </span>
    </div>
  )
}

function MacroBar({ label, right, pct, color }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = requestAnimationFrame(() => setWidth(pct))
    return () => cancelAnimationFrame(t)
  }, [pct])

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-textPrimary">{label}</span>
        <span className="text-sm text-muted-foreground">{right}</span>
      </div>
      <Progress
        value={width}
        style={{ '--bar': color }}
        className="h-2.5 bg-secondary [&>[data-slot=progress-indicator]]:bg-(--bar) [&>[data-slot=progress-indicator]]:duration-700"
      />
    </div>
  )
}
