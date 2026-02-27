export interface ScryfallCard {
  name: string
  set: string
  set_name: string
  collector_number: string
  image_uris?: {
    small: string
    normal: string
    large: string
  }
  card_faces?: Array<{
    image_uris?: {
      small: string
      normal: string
      large: string
    }
  }>
}

async function tryFuzzy(query: string): Promise<ScryfallCard | null> {
  if (!query || query.length < 3) return null
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(query)}`
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function fuzzySearch(cardName: string): Promise<ScryfallCard | null> {
  // Try the full OCR text first
  const full = await tryFuzzy(cardName)
  if (full) return full

  // Strip leading/trailing single-char noise and retry
  const cleaned = cardName.replace(/^(\S\s)+/, '').replace(/(\s\S)+$/, '').trim()
  if (cleaned !== cardName) {
    const result = await tryFuzzy(cleaned)
    if (result) return result
  }

  // Last resort: drop the last word (often garbled) and retry
  const words = (cleaned || cardName).split(/\s+/)
  if (words.length >= 2) {
    return tryFuzzy(words.slice(0, -1).join(' '))
  }

  return null
}

export function getCardImage(card: ScryfallCard): string {
  if (card.image_uris?.normal) return card.image_uris.normal
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal
  return ''
}
