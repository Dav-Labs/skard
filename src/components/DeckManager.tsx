import { useState } from 'react'
import type { CollectionCard } from '../hooks/useCollection'
import type { useDecks } from '../hooks/useDecks'
import { CollectionView } from './CollectionView'
import { ExportButton } from './ExportButton'

interface Props {
  cards: CollectionCard[]
  onRemoveCard: (id: string) => void
  decks: ReturnType<typeof useDecks>
}

type DeckView = { deckId: string; deckName: string; cards: (CollectionCard & { deck_card_id: string })[] } | null

export function DeckManager({ cards, onRemoveCard, decks }: Props) {
  const [tab, setTab] = useState<'collection' | 'decks'>('collection')
  const [newDeckName, setNewDeckName] = useState('')
  const [deckView, setDeckView] = useState<DeckView>(null)

  const handleCreateDeck = async () => {
    const name = newDeckName.trim()
    if (!name) return
    await decks.createDeck(name)
    setNewDeckName('')
  }

  const handleOpenDeck = async (deckId: string, deckName: string) => {
    const deckCards = await decks.fetchDeckCards(deckId)
    setDeckView({ deckId, deckName, cards: deckCards })
  }

  const handleRemoveFromDeck = async (deckCardId: string) => {
    if (!deckView) return
    await decks.removeCardFromDeck(deckCardId, deckView.deckId)
    setDeckView((prev) => prev ? {
      ...prev,
      cards: prev.cards.filter((c) => c.deck_card_id !== deckCardId),
    } : null)
  }

  // Viewing a specific deck
  if (deckView) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDeckView(null)}
            className="text-sm text-violet-400"
          >
            &larr; Back
          </button>
          <h3 className="font-bold">{deckView.deckName}</h3>
          <span className="text-sm text-gray-400">{deckView.cards.length} cards</span>
        </div>
        {deckView.cards.length === 0 ? (
          <p className="text-center text-gray-500 py-4 text-sm">No cards in this deck yet. Add cards from your collection.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {deckView.cards.map((card) => (
                <div
                  key={card.deck_card_id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">{card.name}</span>
                    <span className="text-xs text-gray-500">
                      ({card.set_code.toUpperCase()}) #{card.collector_number}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFromDeck(card.deck_card_id)}
                    className="ml-2 text-gray-500 hover:text-red-400 text-lg leading-none shrink-0"
                    aria-label={`Remove ${card.name}`}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <ExportButton entries={deckView.cards} deckName={deckView.deckName} />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setTab('collection')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'collection' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Collection ({cards.length})
        </button>
        <button
          onClick={() => setTab('decks')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'decks' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Decks ({decks.decks.length})
        </button>
      </div>

      {/* Tab content */}
      {tab === 'collection' ? (
        <CollectionView
          cards={cards}
          onRemove={onRemoveCard}
          decks={decks.decks}
          onAddToDeck={decks.addCardToDeck}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {/* New deck input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDeck()}
              placeholder="New deck name..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleCreateDeck}
              disabled={!newDeckName.trim()}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Create
            </button>
          </div>

          {/* Deck list */}
          {decks.decks.length === 0 ? (
            <p className="text-center text-gray-500 py-4 text-sm">No decks yet. Create one above.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {decks.decks.map((deck) => (
                <div
                  key={deck.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded-lg"
                >
                  <button
                    onClick={() => handleOpenDeck(deck.id, deck.name)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="text-sm font-medium truncate block">{deck.name}</span>
                    <span className="text-xs text-gray-500">{deck.card_count} cards</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${deck.name}"?`)) decks.deleteDeck(deck.id)
                    }}
                    className="ml-2 text-gray-500 hover:text-red-400 text-lg leading-none shrink-0"
                    aria-label={`Delete ${deck.name}`}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
