import { useState } from 'react'
import CardFrame from './CardFrame.jsx'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useJournal } from '../hooks/useJournal'
import { getProgramDay } from '../lib/training'

const PLACEHOLDER_PREVIEW = 'Felt strong on the overhang today. Footwork is clicking.'

function formatEntryDate(dateStr, opts) {
  // dateStr is YYYY-MM-DD; anchor at local midnight to avoid TZ drift.
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', opts)
}

export default function JournalCard({ expandedId, onExpand, onCollapse }) {
  const { entries, addEntry, saving } = useJournal()
  const [text, setText] = useState('')
  const last = entries[0]
  const programDay = getProgramDay(new Date())

  const preview = (
    <div className="h-full flex flex-col">
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Journal</span>
        <span className="text-xs text-muted-foreground">Day {programDay} of 73</span>
      </div>

      <div className="border-t border-border mt-2 pt-3 flex-1 flex flex-col">
        <p className="text-sm text-textPrimary leading-snug line-clamp-2" style={{ opacity: 0.85 }}>
          {last ? last.entry_text : PLACEHOLDER_PREVIEW}
        </p>
      </div>

      <div className="flex justify-end">
        <span className="text-xs text-textMuted">
          {last ? formatEntryDate(last.date, { month: 'short', day: 'numeric' }) : 'Jun 1'}
        </span>
      </div>
    </div>
  )

  const handleSave = async (e) => {
    e.stopPropagation()
    if (!text.trim() || saving) return
    await addEntry(text)
    setText('')
  }

  const expanded = (
    <div>
      <h1 className="text-3xl font-bold mb-4 text-textPrimary">Journal</h1>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder="How did today go..."
        className="bg-background text-textPrimary resize-none min-h-[110px]"
      />
      <div className="flex justify-end mt-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className="font-semibold"
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="mt-8">
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">
            Your summer starts here. Write something.
          </p>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry) => (
              <div key={entry.id} className="border-b border-border py-4 first:pt-0">
                <div className="text-xs text-muted-foreground mb-1">
                  {formatEntryDate(entry.date, { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
                <p className="text-textPrimary whitespace-pre-wrap leading-relaxed">{entry.entry_text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <CardFrame
      id="journal"
      expandedId={expandedId}
      onExpand={onExpand}
      onCollapse={onCollapse}
      preview={preview}
      expanded={expanded}
    />
  )
}
