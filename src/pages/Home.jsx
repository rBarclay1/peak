import { useState } from 'react'
import TopoBackground from '../components/TopoBackground.jsx'
import TimelineCard from '../components/TimelineCard.jsx'
import RecoveryCard from '../components/RecoveryCard.jsx'
import FuelCard from '../components/FuelCard.jsx'
import WeightCard from '../components/WeightCard.jsx'
import { useNow } from '../hooks/useNow'
import { todayKey, START, END, phase, dayDate } from '../lib/plan.js'

export default function Home() {
  const [expandedId, setExpandedId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const now = useNow(),
    today = todayKey(now)
  const props = {
    expandedId,
    onExpand: setExpandedId,
    onCollapse: () => setExpandedId(null),
  }
  const date =
    selectedDate || (today < START ? START : today > END ? END : today)
  return (
    <div className="h-full overflow-hidden bg-background text-foreground relative">
      <TopoBackground />
      <div className="relative z-10 h-full flex flex-col max-w-3xl mx-auto">
        {expandedId === null && (
          <header
            className="px-5 shrink-0"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
              paddingBottom: 10,
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-textSecondary">
              {dayDate(today).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <div className="flex justify-between items-baseline mt-1">
              <h1 className="text-2xl font-extrabold tracking-tight">
                Peak · November
              </h1>
              <span className="text-[11px] text-exercise">{phase(date)}</span>
            </div>
          </header>
        )}
        <div
          className="relative flex-1 min-h-0"
          style={{ '--gap': '0.5rem', '--half': '0.25rem' }}
        >
          <TimelineCard
            {...props}
            selectedDate={date}
            setSelectedDate={setSelectedDate}
          />
          <FuelCard {...props} />
          <RecoveryCard {...props} />
          <WeightCard {...props} />
        </div>
      </div>
    </div>
  )
}
