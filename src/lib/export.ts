import type { CollectionCard } from '../hooks/useCollection'

export function generateDeckText(entries: CollectionCard[]): string {
  const counts = new Map<string, { entry: CollectionCard; count: number }>()

  for (const entry of entries) {
    const key = `${entry.name}|${entry.set_code}|${entry.collector_number}`
    const existing = counts.get(key)
    if (existing) {
      existing.count++
    } else {
      counts.set(key, { entry, count: 1 })
    }
  }

  return Array.from(counts.values())
    .map(({ entry, count }) => `${count} ${entry.name} (${entry.set_code.toUpperCase()}) ${entry.collector_number}`)
    .join('\n')
}

export function downloadDeckFile(entries: CollectionCard[], deckName?: string) {
  const text = generateDeckText(entries)
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = deckName ? `${deckName}.txt` : 'deck.txt'
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyDeckToClipboard(entries: CollectionCard[]): Promise<boolean> {
  const text = generateDeckText(entries)
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
