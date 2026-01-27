import type { CyberwareSlotKey, EquipmentSlot, WeaponSlot } from "@shared/game/types"

export type InventorySortMode = "name" | "rarity" | "type"
export type DeckSortMode = "name" | "rarity" | "type" | "cost" | "source"
export type DeckViewMode = "list" | "grid"
export type SelectionViewMode = "description" | "stats" | "cards"
export type SlotFilter = EquipmentSlot | WeaponSlot | CyberwareSlotKey | null

export type DeckEntry = {
  cardId: string
  def?: import("@shared/game/engine/combatTypes").CardDefinition
  count: number
  source?: { name: string; rarity?: string }
}
