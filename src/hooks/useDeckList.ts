import { useState, useEffect, useCallback } from 'react'

export interface DeckEntry {
  id: string
  name: string
  set: string
  collector_number: string
  image_url: string
}

const STORAGE_KEY = 'skard-deck'

function loadFromStorage(): DeckEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useDeckList() {
  const [entries, setEntries] = useState<DeckEntry[]>(loadFromStorage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  const addEntry = useCallback((entry: Omit<DeckEntry, 'id'>) => {
    setEntries((prev) => [...prev, { ...entry, id: crypto.randomUUID() }])
  }, [])

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setEntries([])
  }, [])

  return { entries, addEntry, removeEntry, clearAll }
}
