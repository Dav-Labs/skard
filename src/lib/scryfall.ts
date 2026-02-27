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

export async function fuzzySearch(cardName: string): Promise<ScryfallCard | null> {
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export function getCardImage(card: ScryfallCard): string {
  if (card.image_uris?.normal) return card.image_uris.normal
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal
  return ''
}
