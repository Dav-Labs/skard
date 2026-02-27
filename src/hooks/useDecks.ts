import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CollectionCard } from './useCollection'

export interface Deck {
  id: string
  name: string
  created_at: string
}

export interface DeckWithCount extends Deck {
  card_count: number
}

export function useDecks() {
  const [decks, setDecks] = useState<DeckWithCount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDecks = useCallback(async () => {
    const { data } = await supabase
      .from('decks')
      .select('*, deck_cards(count)')
      .order('created_at', { ascending: false })

    if (data) {
      setDecks(data.map((d) => ({
        id: d.id,
        name: d.name,
        created_at: d.created_at,
        card_count: (d.deck_cards as { count: number }[])[0]?.count ?? 0,
      })))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDecks()
  }, [fetchDecks])

  const createDeck = useCallback(async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('decks')
      .insert({ name, user_id: user.id })
      .select()
      .single()

    if (!error && data) {
      setDecks((prev) => [{ ...data, card_count: 0 }, ...prev])
    }
  }, [])

  const deleteDeck = useCallback(async (id: string) => {
    const { error } = await supabase.from('decks').delete().eq('id', id)
    if (!error) {
      setDecks((prev) => prev.filter((d) => d.id !== id))
    }
  }, [])

  const addCardToDeck = useCallback(async (deckId: string, collectionCardId: string) => {
    const { error } = await supabase
      .from('deck_cards')
      .insert({ deck_id: deckId, collection_card_id: collectionCardId })

    if (!error) {
      setDecks((prev) => prev.map((d) =>
        d.id === deckId ? { ...d, card_count: d.card_count + 1 } : d
      ))
    }
    return !error
  }, [])

  const removeCardFromDeck = useCallback(async (deckCardId: string, deckId: string) => {
    const { error } = await supabase
      .from('deck_cards')
      .delete()
      .eq('id', deckCardId)

    if (!error) {
      setDecks((prev) => prev.map((d) =>
        d.id === deckId ? { ...d, card_count: Math.max(0, d.card_count - 1) } : d
      ))
    }
  }, [])

  const fetchDeckCards = useCallback(async (deckId: string): Promise<(CollectionCard & { deck_card_id: string })[]> => {
    const { data } = await supabase
      .from('deck_cards')
      .select('id, collection_cards(*)')
      .eq('deck_id', deckId)

    if (!data) return []

    return data.map((dc) => {
      const card = dc.collection_cards as unknown as CollectionCard
      return { ...card, deck_card_id: dc.id }
    })
  }, [])

  return { decks, loading, createDeck, deleteDeck, addCardToDeck, removeCardFromDeck, fetchDeckCards }
}
