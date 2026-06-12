import { useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

// A swipe that begins within this many px of the left screen edge is treated as
// a back gesture. Exported so cards with their own horizontal swipes (Activity)
// can leave this zone alone.
export const EDGE_BACK_ZONE = 28

// Animated, expand-in-place card shell.
// Each card is absolutely positioned in its 2x2 quadrant. Tapping expands it
// to fill the dashboard (which itself fills the screen once Home collapses the
// header). Inset + opacity + border-radius all transition over 300ms.
const G = 'var(--gap)'
const HALF = 'var(--half)'

// Asymmetric grid above a full-width Weight strip (bottom 16.67%):
//   Left  (Activity / Fuel)               → 2 rows, ~41.67% height each
//   Right (Recovery / Journal / Calendar) → 33.3% / 25% / 25%
//   Weight                                → full-width bottom bar
const POSITIONS = {
  // Left column (ends at 83.33% to clear the Weight strip)
  activity: { top: G, left: G, right: `calc(50% + ${HALF})`, bottom: `calc(58.3333% + ${HALF})` },
  fuel: { top: `calc(41.6667% + ${HALF})`, left: G, right: `calc(50% + ${HALF})`, bottom: `calc(16.6667% + ${HALF})` },
  // Right column
  recovery: { top: G, left: `calc(50% + ${HALF})`, right: G, bottom: `calc(66.6667% + ${HALF})` },
  journal: { top: `calc(33.3333% + ${HALF})`, left: `calc(50% + ${HALF})`, right: G, bottom: `calc(41.6667% + ${HALF})` },
  calendar: { top: `calc(58.3333% + ${HALF})`, left: `calc(50% + ${HALF})`, right: G, bottom: `calc(16.6667% + ${HALF})` },
  // Full-width bottom strip
  weight: { top: `calc(83.3333% + ${HALF})`, left: G, right: G, bottom: G },
}

const EXPANDED = { top: 0, left: 0, right: 0, bottom: 0 }

export default function CardFrame({ id, expandedId, onExpand, onCollapse, preview, expanded, noScroll }) {
  const isExpanded = expandedId === id
  const anyExpanded = expandedId !== null
  const hidden = anyExpanded && !isExpanded
  const pos = isExpanded ? EXPANDED : POSITIONS[id]

  // Swipe in from the far-left edge to dismiss the card (iOS back gesture).
  const edgeSwipe = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    edgeSwipe.current = t.clientX <= EDGE_BACK_ZONE ? { x: t.clientX, y: t.clientY } : null
  }
  const onTouchEnd = (e) => {
    if (!edgeSwipe.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - edgeSwipe.current.x
    const dy = t.clientY - edgeSwipe.current.y
    edgeSwipe.current = null
    if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onCollapse()
  }

  return (
    <div
      onClick={() => {
        if (!isExpanded) onExpand(id)
      }}
      className="absolute overflow-hidden"
      style={{
        top: pos.top,
        left: pos.left,
        right: pos.right,
        bottom: pos.bottom,
        // Slightly translucent so the topo contour lines ghost through.
        backgroundColor: 'rgba(28, 28, 30, 0.9)',
        opacity: hidden ? 0 : 1,
        zIndex: isExpanded ? 30 : 10,
        borderRadius: isExpanded ? '0px' : '1.75rem',
        transform: isExpanded ? 'scale(1)' : 'scale(1)',
        boxShadow: isExpanded ? 'none' : '0 1px 3px rgba(0,0,0,0.4)',
        pointerEvents: hidden ? 'none' : 'auto',
        cursor: isExpanded ? 'default' : 'pointer',
        transition:
          'top .35s cubic-bezier(0.32,0.72,0,1), left .35s cubic-bezier(0.32,0.72,0,1), right .35s cubic-bezier(0.32,0.72,0,1), bottom .35s cubic-bezier(0.32,0.72,0,1), opacity .3s ease-in-out, border-radius .35s cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      {/* Preview layer (grid view) */}
      <div
        className="absolute inset-0 p-5"
        style={{
          opacity: isExpanded ? 0 : 1,
          pointerEvents: isExpanded ? 'none' : 'auto',
          transition: 'opacity .2s ease-in-out',
        }}
      >
        {preview}
      </div>

      {/* Expanded layer (full screen) */}
      <div
        className={`absolute inset-0 ${noScroll ? 'overflow-hidden' : 'overflow-y-auto'}`}
        onTouchStart={isExpanded ? onTouchStart : undefined}
        onTouchEnd={isExpanded ? onTouchEnd : undefined}
        style={{
          opacity: isExpanded ? 1 : 0,
          pointerEvents: isExpanded ? 'auto' : 'none',
          transition: 'opacity .25s ease-in-out',
        }}
      >
        <div
          className="px-6 min-h-full"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
          }}
        >
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Back"
            onClick={(e) => {
              e.stopPropagation()
              onCollapse()
            }}
            className="mb-4 size-9 rounded-full bg-secondary/80 text-foreground hover:bg-secondary [&_svg]:size-5"
          >
            <ChevronLeft />
          </Button>
          {expanded}
        </div>
      </div>
    </div>
  )
}
