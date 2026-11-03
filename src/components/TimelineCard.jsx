import { useState } from 'react'
import { Plus, Circle, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import CardFrame from './CardFrame.jsx'
import { usePlanner } from '../hooks/usePlanner'
import { START, END, addDays, shortDate, isTodoListItem } from '../lib/plan.js'

export const actionClass = 'rounded-xl bg-secondary px-3 py-2.5 text-xs font-semibold min-h-10 disabled:opacity-40'
export const inputClass = 'w-full rounded-xl bg-secondary px-3 py-3 text-base'

export default function TimelineCard({ selectedDate, setSelectedDate, ...props }) {
  const planner = usePlanner()
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState(null)
  const [undo, setUndo] = useState(null)
  const date = selectedDate
  const daily = planner.tasks.filter(t => t.date === date &&
    (['climb', 'golf', 'run', 'study'].includes(t.type) ||
      (t.type === 'todo' && !isTodoListItem(t)) ||
      (t.custom && t.type === 'recovery') || t.id.endsWith(':work-am')))
  const all = [...daily, ...planner.tasks.filter(isTodoListItem)]
  const pending = all.filter(t => !['done', 'skipped', 'moved'].includes(t.status))
  const label = t => t.id.endsWith(':work-am') ? 'nCino work' : t.type === 'study' ? 'Schoolwork' :
    t.type === 'golf' ? 'Driving range' : t.type === 'run' ? 'Easy run' : t.title
  const complete = t => {
    setUndo({ id: t.id, status: t.status })
    planner.update(t.id, { status: 'done', completedAt: new Date().toISOString() })
  }
  const add = e => {
    e.preventDefault()
    if (!title.trim()) return
    planner.update(`${START}:todo-${crypto.randomUUID()}`, {
      custom: true, listOnly: true, originalDate: date, date: null, time: null,
      title: title.trim(), type: 'todo', duration: 0, status: 'planned',
    })
    setTitle('')
  }
  const content = compact => (
    <div className="flex h-full min-h-0 flex-col" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h1 className={compact ? 'text-sm font-semibold uppercase tracking-wider' : 'text-3xl font-bold'}>To-do list</h1>
        <span className="text-xs text-exercise">{pending.length} left</span>
      </div>
      <div className="my-2 flex shrink-0 items-center justify-between text-xs text-textSecondary">
        <button aria-label="Previous checklist day" className="p-2" disabled={date <= START} onClick={() => {setSelectedDate(addDays(date, -1)); setDetail(null)}}><ChevronLeft size={16}/></button>
        <span>{shortDate(date)}</span>
        <button aria-label="Next checklist day" className="p-2" disabled={date >= END} onClick={() => {setSelectedDate(addDays(date, 1)); setDetail(null)}}><ChevronRight size={16}/></button>
      </div>
      <form onSubmit={add} className="flex shrink-0 gap-2 mb-2">
        <input aria-label="Task" placeholder="Add a task…" maxLength={200} value={title} onChange={e => setTitle(e.target.value)} className="min-w-0 flex-1 rounded-xl bg-secondary px-3 py-2 text-base"/>
        <button aria-label="Add task" disabled={!title.trim()} className={actionClass}><Plus size={18}/></button>
      </form>
      <div className={compact ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain' : 'space-y-1'}>
        {pending.map(task => <div key={task.id} className="border-b border-border">
          <div className="flex items-center gap-2 min-h-11">
            <button aria-label={`Complete todo: ${label(task)}`} onClick={() => complete(task)} className="shrink-0 p-2"><Circle size={20} className="text-textSecondary"/></button>
            <button aria-label={`Details: ${label(task)}`} className="min-w-0 flex-1 py-3 text-left text-sm" onClick={() => {setDetail(task.id === detail ? null : task.id); if(compact) props.onExpand('activity')}}>
              {label(task)}{(task.detail || task.steps?.length > 0) && <span className="ml-2 text-textMuted">›</span>}
            </button>
          </div>
          {!compact && detail === task.id && <div className="pb-4 pl-10 text-sm text-textSecondary">
            {task.detail && <p className="mb-3">{task.detail}</p>}
            {task.steps?.map((step, i) => <label key={step} className="flex gap-2 py-2"><input type="checkbox" checked={(task.checkedSteps || []).includes(i)} onChange={() => planner.update(task.id, { checkedSteps: (task.checkedSteps || []).includes(i) ? task.checkedSteps.filter(n => n !== i) : [...(task.checkedSteps || []), i] })}/><span>{step}</span></label>)}
            <button className={actionClass} onClick={() => {setUndo({id:task.id, deleted:false}); planner.update(task.id,{deleted:true})}}>Remove task</button>
          </div>}
        </div>)}
        {!pending.length && <p className="py-4 text-sm text-textSecondary"><Check size={16} className="inline mr-2"/>All done for now.</p>}
      </div>
      {undo && <button className="shrink-0 text-xs text-yellow py-2 text-left" onClick={() => {planner.update(undo.id,undo); setUndo(null)}}>Undo</button>}
      {compact && <button aria-label="Open checklist" onClick={() => props.onExpand('activity')} className="shrink-0 pt-2 text-right text-xs text-textSecondary">Open list →</button>}
      {!compact && <p className="mt-5 text-xs text-textMuted">{planner.syncStatus} · Unfinished personal tasks stay on your list.</p>}
    </div>
  )
  return <CardFrame id="activity" {...props} preview={props.expandedId === null ? content(true) : null} expanded={props.expandedId === 'activity' ? content(false) : null}/>
}
