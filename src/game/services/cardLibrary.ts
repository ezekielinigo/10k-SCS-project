import type { CardDefinition } from "@shared/game/engine/combatTypes"
import CARDS from "@shared/game/content/cards"

let cachedMap: Record<string, CardDefinition> | null = null

export const getCardLibraryMap = (): Record<string, CardDefinition> => {
  if (cachedMap) return cachedMap
  cachedMap = CARDS.reduce<Record<string, CardDefinition>>((acc, card) => {
    acc[card.id] = card
    return acc
  }, {})
  return cachedMap
}
