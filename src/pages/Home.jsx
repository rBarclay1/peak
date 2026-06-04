import { useState } from 'react'
import { getProgramDay, getGreeting, formatLongDate } from '../lib/training'
import { quotes } from '../data/quotes'
import Header from '../components/Header.jsx'
import TopoBackground from '../components/TopoBackground.jsx'
import ActivityCard from '../components/ActivityCard.jsx'
import RecoveryCard from '../components/RecoveryCard.jsx'
import FuelCard from '../components/FuelCard.jsx'
import JournalCard from '../components/JournalCard.jsx'
import CalendarCard from '../components/CalendarCard.jsx'
import WeightCard from '../components/WeightCard.jsx'

export default function Home() {
  const [expandedId, setExpandedId] = useState(null)
  const now = new Date()
  const anyExpanded = expandedId !== null

  // Daily quote: one per day of the summer block, looping if needed.
  const progStart = new Date(now.getFullYear(), 5, 3) // Jun 3
  const blockEnd = new Date(now.getFullYear(), 7, 10, 23, 59, 59) // Aug 10
  const inRange = now >= progStart && now <= blockEnd
  const quote = quotes[inRange ? (getProgramDay(now) - 1) % quotes.length : 0]

  const cardProps = {
    expandedId,
    onExpand: (id) => setExpandedId(id),
    onCollapse: () => setExpandedId(null),
  }

  return (
    <div className="h-full overflow-hidden bg-background text-foreground relative">
      <TopoBackground />

      <div className="relative z-10 h-full flex flex-col">
        <Header
          date={formatLongDate(now)}
          greeting={getGreeting(now)}
          quote={quote}
          collapsed={anyExpanded}
        />

        {/* Dashboard — asymmetric grid of expand-in-place cards */}
        <div className="relative flex-1" style={{ '--gap': '0.5rem', '--half': '0.25rem' }}>
          {/* Left column */}
          <ActivityCard date={now} {...cardProps} />
          <FuelCard {...cardProps} />
          {/* Right column */}
          <RecoveryCard {...cardProps} />
          <JournalCard {...cardProps} />
          <CalendarCard {...cardProps} />
          {/* Full-width bottom strip */}
          <WeightCard {...cardProps} />
        </div>
      </div>
    </div>
  )
}
