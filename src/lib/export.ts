import type { DeckEntry } from '../hooks/useDeckList'

export function generateDeckText(entries: DeckEntry[]): string {
  const counts = new Map<string, { entry: DeckEntry; count: number }>()

  for (const entry of entries) {
    const key = `${entry.name}|${entry.set}|${entry.collector_number}`
    const existing = counts.get(key)
    if (existing) {
      existing.count++
    } else {
      counts.set(key, { entry, count: 1 })
    }
  }

  return Array.from(counts.values())
    .map(({ entry, count }) => `${count} ${entry.name} (${entry.set.toUpperCase()}) ${entry.collector_number}`)
    .join('\n')
}

export function downloadDeckFile(entries: DeckEntry[]) {
  const text = generateDeckText(entries)
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'deck.txt'
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyDeckToClipboard(entries: DeckEntry[]): Promise<boolean> {
  const text = generateDeckText(entries)
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
