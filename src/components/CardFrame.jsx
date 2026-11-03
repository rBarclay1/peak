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

// Reserve enough height for the weight summary independently of viewport size.
// The remaining rows share the available space above it.
const WEIGHT_HEIGHT = 'max(112px, 15%)'
const FIRST_ROW_END = `calc((100% - ${WEIGHT_HEIGHT}) * 0.64)`
const POSITIONS = {
  activity: { top: G, left: G, right: G, bottom: `calc(100% - ${FIRST_ROW_END} + ${HALF})` },
  fuel: { top: `calc(${FIRST_ROW_END} + ${HALF})`, left: G, right: `calc(50% + ${HALF})`, bottom: `calc(${WEIGHT_HEIGHT} + ${HALF})` },
  recovery: { top: `calc(${FIRST_ROW_END} + ${HALF})`, left: `calc(50% + ${HALF})`, right: G, bottom: `calc(${WEIGHT_HEIGHT} + ${HALF})` },
  weight: { top: `calc(100% - ${WEIGHT_HEIGHT} + ${HALF})`, left: G, right: G, bottom: G },
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
      aria-hidden={hidden || undefined}
      role={!isExpanded && id !== 'activity' ? 'button' : undefined}
      tabIndex={!isExpanded && !hidden && id !== 'activity' ? 0 : -1}
      aria-label={!isExpanded && id !== 'activity' ? `Open ${id === 'activity' ? 'timeline' : id === 'recovery' ? 'sleep' : id === 'todos' ? 'to-do list' : id}` : undefined}
      onKeyDown={e => { if (e.target === e.currentTarget && !isExpanded && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onExpand(id) } }}
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
        className="absolute inset-0 p-4"
        aria-hidden={isExpanded || hidden}
        inert={isExpanded || hidden ? "" : undefined}
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
        aria-hidden={!isExpanded || hidden}
        inert={!isExpanded || hidden ? "" : undefined}
        className={`absolute inset-0 ${noScroll ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y'}`}
        onTouchStart={isExpanded ? onTouchStart : undefined}
        onTouchEnd={isExpanded ? onTouchEnd : undefined}
        style={{
          opacity: isExpanded ? 1 : 0,
          pointerEvents: isExpanded ? 'auto' : 'none',
          transition: 'opacity .25s ease-in-out',
        }}
      >
        <div
          className="px-6 min-h-full min-w-0 w-full"
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
