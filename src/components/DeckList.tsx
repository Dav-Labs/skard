import type { DeckEntry } from '../hooks/useDeckList'

interface Props {
  entries: DeckEntry[]
  onRemove: (id: string) => void
  onClearAll: () => void
}

export function DeckList({ entries, onRemove, onClearAll }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No cards scanned yet</p>
        <p className="text-sm mt-1">Point your camera at a card and tap scan</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-gray-400">
          {entries.length} card{entries.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => {
            if (confirm('Clear all cards?')) onClearAll()
          }}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Clear All
        </button>
      </div>
      <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded-lg"
          >
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium truncate block">{entry.name}</span>
              <span className="text-xs text-gray-500">
                ({entry.set.toUpperCase()}) #{entry.collector_number}
              </span>
            </div>
            <button
              onClick={() => onRemove(entry.id)}
              className="ml-2 text-gray-500 hover:text-red-400 text-lg leading-none shrink-0"
              aria-label={`Remove ${entry.name}`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
