import type { CardDefinition } from "@shared/game/engine/combatTypes"
import type { ItemTemplate } from "@shared/game/types"
import CARDS from "@shared/game/content/cards"

/*

Card Library Service
	- manages caching and lookup of card definitions

getCardLibraryMap(): Record<string, CardDefinition>
	- returns a map of card ID to CardDefinition for all cards in the library
	- used by game engine to look up card definitions by ID

getCardSourceMap(itemTemplates): Map<string, { name: string; rarity?: string }>
	- item templates derived from game content (items.ts)
	- returns a map of card ID to source item info
	- used by inventory UI to show where cards come from (ex: which item grants a card)

warmCardLibraryCaches(itemTemplates)
	- called at game initialization to pre-warm caches
	- improves lookup performance during gameplay

*/

let cachedMap: Record<string, CardDefinition> | null = null
const cardSourceCache = new WeakMap<Record<string, ItemTemplate>, Map<string, { name: string; rarity?: string }>>()

export const getCardLibraryMap = (): Record<string, CardDefinition> => {
  if (cachedMap) return cachedMap
  cachedMap = CARDS.reduce<Record<string, CardDefinition>>((acc, card) => {
    acc[card.id] = card
    return acc
  }, {})
  return cachedMap
}

const collectCardRefs = (template?: ItemTemplate | null): string[] => {
  if (!template) return []
  const refs = new Set<string>()
  template.cardRefs?.forEach((ref) => refs.add(ref))
  template.passiveCardRefs?.forEach((ref) => refs.add(ref))
  if (template.weaponCards) {
    Object.values(template.weaponCards).forEach((list) => list?.forEach((ref) => refs.add(ref)))
  }
  return [...refs]
}

export const getCardSourceMap = (itemTemplates?: Record<string, ItemTemplate> | null) => {
  if (!itemTemplates) return new Map<string, { name: string; rarity?: string }>()
  const cached = cardSourceCache.get(itemTemplates)
  if (cached) return cached
  const map = new Map<string, { name: string; rarity?: string }>()
  Object.values(itemTemplates).forEach((tpl) => {
    collectCardRefs(tpl).forEach((ref) => {
      if (!map.has(ref)) map.set(ref, { name: tpl.name, rarity: tpl.rarity })
    })
  })
  cardSourceCache.set(itemTemplates, map)
  return map
}

export const warmCardLibraryCaches = (itemTemplates?: Record<string, ItemTemplate> | null) => {
  getCardLibraryMap()
  if (itemTemplates) getCardSourceMap(itemTemplates)
}
