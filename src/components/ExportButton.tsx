import type { CollectionCard } from '../hooks/useCollection'
import { downloadDeckFile, copyDeckToClipboard } from '../lib/export'
import { useState } from 'react'

interface Props {
  entries: CollectionCard[]
  deckName?: string
}

export function ExportButton({ entries, deckName }: Props) {
  const [copied, setCopied] = useState(false)

  if (entries.length === 0) return null

  const handleCopy = async () => {
    const ok = await copyDeckToClipboard(entries)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => downloadDeckFile(entries, deckName)}
        className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
      >
        Download .txt
      </button>
      <button
        onClick={handleCopy}
        className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
