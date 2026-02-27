import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface CollectionCard {
  id: string
  name: string
  set_code: string
  collector_number: string
  image_url: string
  created_at: string
}

export function useCollection() {
  const [cards, setCards] = useState<CollectionCard[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCards = useCallback(async () => {
    const { data } = await supabase
      .from('collection_cards')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setCards(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  const addCard = useCallback(async (card: { name: string; set_code: string; collector_number: string; image_url: string }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('collection_cards')
      .insert({ ...card, user_id: user.id })
      .select()
      .single()

    if (!error && data) {
      setCards((prev) => [data, ...prev])
    }
  }, [])

  const removeCard = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('collection_cards')
      .delete()
      .eq('id', id)

    if (!error) {
      setCards((prev) => prev.filter((c) => c.id !== id))
    }
  }, [])

  return { cards, loading, addCard, removeCard }
}
