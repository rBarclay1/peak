// Apple-Fitness-style summary header: big date + greeting, with the daily
// quote tucked underneath. Collapses out of the way when a card expands so
// the expanded card fills the whole screen.
export default function Header({ date, greeting, quote, collapsed }) {
  return (
    <div
      className="px-5 overflow-hidden shrink-0"
      style={{
        maxHeight: collapsed ? '0px' : '220px',
        opacity: collapsed ? 0 : 1,
        paddingTop: collapsed ? 0 : 'calc(env(safe-area-inset-top) + 14px)',
        paddingBottom: collapsed ? 0 : '14px',
        transition:
          'max-height .35s cubic-bezier(0.32,0.72,0,1), opacity .3s ease-in-out, padding .35s cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-textSecondary">
        {date}
      </p>
      <h1 className="font-display text-[2rem] font-extrabold leading-tight tracking-tight text-foreground">
        {greeting}
      </h1>
      <p className="mt-1.5 text-[13px] leading-snug text-textSecondary line-clamp-2">
        “{quote.text}” <span className="text-textMuted">— {quote.author}</span>
      </p>
    </div>
  )
}
