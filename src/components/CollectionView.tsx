import type { CollectionCard } from '../hooks/useCollection'
import type { DeckWithCount } from '../hooks/useDecks'
import { ExportButton } from './ExportButton'
import { useState } from 'react'

interface Props {
  cards: CollectionCard[]
  onRemove: (id: string) => void
  decks: DeckWithCount[]
  onAddToDeck: (deckId: string, cardId: string) => Promise<boolean>
}

export function CollectionView({ cards, onRemove, decks, onAddToDeck }: Props) {
  const [addingFor, setAddingFor] = useState<string | null>(null)

  if (cards.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No cards scanned yet</p>
        <p className="text-sm mt-1">Point your camera at a card and tap scan</p>
      </div>
    )
  }

  const handleAddToDeck = async (deckId: string, cardId: string) => {
    await onAddToDeck(deckId, cardId)
    setAddingFor(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-gray-400">
          {cards.length} card{cards.length !== 1 ? 's' : ''}
        </span>
      </div>
      <ExportButton entries={cards} deckName="collection" />
      <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
        {cards.map((card) => (
          <div key={card.id}>
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded-lg">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium truncate block">{card.name}</span>
                <span className="text-xs text-gray-500">
                  ({card.set_code.toUpperCase()}) #{card.collector_number}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {decks.length > 0 && (
                  <button
                    onClick={() => setAddingFor(addingFor === card.id ? null : card.id)}
                    className="text-violet-400 hover:text-violet-300 text-lg leading-none px-1"
                    aria-label={`Add ${card.name} to deck`}
                  >
                    +
                  </button>
                )}
                <button
                  onClick={() => onRemove(card.id)}
                  className="text-gray-500 hover:text-red-400 text-lg leading-none px-1"
                  aria-label={`Remove ${card.name}`}
                >
                  &times;
                </button>
              </div>
            </div>
            {addingFor === card.id && (
              <div className="ml-4 mt-1 mb-1 flex flex-col gap-1">
                {decks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => handleAddToDeck(deck.id, card.id)}
                    className="text-left text-sm px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
                  >
                    {deck.name} ({deck.card_count})
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
