import { useState, useEffect, useCallback } from 'react'
import { CameraView } from './components/CameraView'
import { CardConfirm, NoMatchView } from './components/CardConfirm'
import { DeckManager } from './components/DeckManager'
import { useCollection } from './hooks/useCollection'
import { useDecks } from './hooks/useDecks'
import { useAuth } from './hooks/useAuth'
import { preprocessImage, recognizeCardName, preloadWorker } from './lib/ocr'
import { fuzzySearch, type ScryfallCard } from './lib/scryfall'

type AppState =
  | { view: 'camera' }
  | { view: 'processing' }
  | { view: 'confirm'; card: ScryfallCard; ocrText: string }
  | { view: 'no-match'; ocrText: string }

function App() {
  const { cards, addCard, removeCard } = useCollection()
  const decks = useDecks()
  const { signOut } = useAuth()
  const [state, setState] = useState<AppState>({ view: 'camera' })
  const [showList, setShowList] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [ocrReady, setOcrReady] = useState(false)

  useEffect(() => {
    preloadWorker().then(() => setOcrReady(true))
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  const handleCapture = useCallback(async (canvas: HTMLCanvasElement) => {
    setState({ view: 'processing' })
    try {
      const processed = preprocessImage(canvas)
      const cardName = await recognizeCardName(processed)

      if (!cardName) {
        setState({ view: 'no-match', ocrText: '' })
        return
      }

      const card = await fuzzySearch(cardName)
      if (card) {
        setState({ view: 'confirm', card, ocrText: cardName })
      } else {
        setState({ view: 'no-match', ocrText: cardName })
      }
    } catch {
      setState({ view: 'no-match', ocrText: '' })
    }
  }, [])

  const handleAdd = useCallback(async (card: ScryfallCard) => {
    const imageUrl = card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || ''
    await addCard({
      name: card.name,
      set_code: card.set,
      collector_number: card.collector_number,
      image_url: imageUrl,
    })
    showToast(`Added ${card.name}`)
    setState({ view: 'camera' })
  }, [addCard, showToast])

  const handleRetry = useCallback(() => {
    setState({ view: 'camera' })
  }, [])

  return (
    <div className="flex flex-col h-dvh relative">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 z-10">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-violet-400">Skard</span>
        </h1>
        <div className="flex items-center gap-3">
          {!ocrReady && (
            <span className="text-xs text-yellow-400 animate-pulse">Loading OCR...</span>
          )}
          <button
            onClick={() => setShowList(!showList)}
            className="relative px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Collection
            {cards.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-violet-600 rounded-full text-xs flex items-center justify-center font-bold">
                {cards.length}
              </span>
            )}
          </button>
          <button
            onClick={signOut}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      {state.view === 'camera' || state.view === 'processing' ? (
        <CameraView
          onCapture={handleCapture}
          isProcessing={state.view === 'processing'}
        />
      ) : state.view === 'confirm' ? (
        <CardConfirm
          card={state.card}
          ocrText={state.ocrText}
          onAdd={handleAdd}
          onRetry={handleRetry}
        />
      ) : (
        <NoMatchView
          ocrText={state.ocrText}
          onAdd={handleAdd}
          onRetry={handleRetry}
        />
      )}

      {/* Bottom sheet - DeckManager */}
      {showList && (
        <div
          className="absolute inset-0 z-20 bg-black/50"
          onClick={() => setShowList(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl p-4 max-h-[80vh] flex flex-col gap-3 border-t border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto" />
            <DeckManager
              cards={cards}
              onRemoveCard={removeCard}
              decks={decks}
            />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
