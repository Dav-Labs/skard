import { useState } from 'react'
import { fuzzySearch, getCardImage, type ScryfallCard } from '../lib/scryfall'

interface Props {
  card: ScryfallCard
  ocrText: string
  onAdd: (card: ScryfallCard) => void
  onRetry: () => void
}

export function CardConfirm({ card, ocrText, onAdd, onRetry }: Props) {
  const [manualMode, setManualMode] = useState(false)
  const [manualName, setManualName] = useState(ocrText)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const imageUrl = getCardImage(card)

  const handleManualSearch = async () => {
    if (!manualName.trim()) return
    setSearching(true)
    setSearchError('')
    const result = await fuzzySearch(manualName.trim())
    setSearching(false)
    if (result) {
      onAdd(result)
    } else {
      setSearchError('No card found. Try a different name.')
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
      {!manualMode ? (
        <>
          {imageUrl && (
            <img
              src={imageUrl}
              alt={card.name}
              className="w-64 rounded-xl shadow-2xl"
            />
          )}
          <div className="text-center">
            <h2 className="text-xl font-bold">{card.name}</h2>
            <p className="text-sm text-gray-400">
              {card.set_name} ({card.set.toUpperCase()}) #{card.collector_number}
            </p>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => onAdd(card)}
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors"
            >
              Add to Collection
            </button>
            <button
              onClick={onRetry}
              className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-medium transition-colors"
            >
              Retry
            </button>
          </div>
          <button
            onClick={() => setManualMode(true)}
            className="text-sm text-violet-400 underline"
          >
            Type manually
          </button>
        </>
      ) : (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <h2 className="text-lg font-bold text-center">Manual Search</h2>
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
            placeholder="Enter card name..."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            autoFocus
          />
          {searchError && <p className="text-red-400 text-sm">{searchError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleManualSearch}
              disabled={searching}
              className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-600 text-white rounded-xl font-medium transition-colors"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={() => setManualMode(false)}
              className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-medium transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface NoMatchProps {
  ocrText: string
  debugUrl?: string
  rawDebugUrl?: string
  onAdd: (card: ScryfallCard) => void
  onRetry: () => void
}

export function NoMatchView({ ocrText, debugUrl, rawDebugUrl, onAdd, onRetry }: NoMatchProps) {
  const [manualName, setManualName] = useState(ocrText)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const handleSearch = async () => {
    if (!manualName.trim()) return
    setSearching(true)
    setSearchError('')
    const result = await fuzzySearch(manualName.trim())
    setSearching(false)
    if (result) {
      onAdd(result)
    } else {
      setSearchError('No card found. Try a different name.')
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-red-400 mb-1">No Match Found</h2>
        <p className="text-sm text-gray-400">
          OCR read: "<span className="text-gray-300">{ocrText || '(empty)'}</span>"
        </p>
      </div>
      {rawDebugUrl && (
        <div className="w-full max-w-sm">
          <p className="text-xs text-gray-500 mb-1">Debug frame (green=card, red=name crop):</p>
          <img src={rawDebugUrl} alt="Debug frame" className="w-full rounded border border-gray-700" />
        </div>
      )}
      {debugUrl && (
        <div className="w-full max-w-sm">
          <p className="text-xs text-gray-500 mb-1">Processed image (what OCR sees):</p>
          <img src={debugUrl} alt="OCR input" className="w-full rounded border border-gray-700" />
        </div>
      )}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <input
          type="text"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter card name..."
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
          autoFocus
        />
        {searchError && <p className="text-red-400 text-sm">{searchError}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleSearch}
            disabled={searching}
            className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-600 text-white rounded-xl font-medium transition-colors"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
          <button
            onClick={onRetry}
            className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-medium transition-colors"
          >
            Scan Again
          </button>
        </div>
      </div>
    </div>
  )
}
