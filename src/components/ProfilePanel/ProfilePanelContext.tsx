import React, { createContext, useContext } from "react"
import type { SkImage } from "@shopify/react-native-skia"
import type { CardDefinition } from "@shared/game/engine/combatTypes"
import type { CyberSlot, EquipmentSlot, ItemTemplate, WeaponSlot } from "@shared/game/types"
import type { DeckEntry, DeckSortMode, DeckViewMode, InventorySortMode, SelectionViewMode, SlotFilter } from "./profilePanelTypes"

type ProfilePanelContextValue = {
  activeTab: "equipment" | "cyberware" | "deck"
  setActiveTab: (tab: "equipment" | "cyberware" | "deck") => void
  itemIconSkia: SkImage | null
  selectionView: SelectionViewMode
  cycleSelectionView: () => void
  selectedTemplate: ItemTemplate | null
  selectedMeta: { name: string; kind: string; rarity?: string } | null
  selectedEffects: string[]
  selectedCards: CardDefinition[]
  selectionBorderColor: string
  deckCounts: Map<string, number>
  inventorySortMode: InventorySortMode
  cycleInventorySort: () => void
  slotFilter: SlotFilter
  filteredInventory: { instance: any; template: ItemTemplate }[]
  selectedId: string | null
  equippedSlotByItem: Map<string, EquipmentSlot | WeaponSlot | CyberSlot>
  handleItemSelect: (itemId: string) => void
  handleEquipToggle: (itemId: string, template?: ItemTemplate | null) => void
  equippedBySlot: Map<EquipmentSlot | WeaponSlot | CyberSlot, string>
  templateByInstance: Map<string, ItemTemplate>
  handleSlotPress: (slotId: EquipmentSlot | WeaponSlot | CyberSlot | "trash") => void
  deckEntries: DeckEntry[]
  deckView: DeckViewMode
  deckSortMode: DeckSortMode
  cycleDeckView: () => void
  cycleDeckSort: () => void
  cardPreview: CardDefinition | null
  setCardPreview: (card: CardDefinition | null) => void
  closeCardPreview: () => void
}

const ProfilePanelContext = createContext<ProfilePanelContextValue | null>(null)

export const ProfilePanelProvider = ProfilePanelContext.Provider

export const useProfilePanel = () => {
  const context = useContext(ProfilePanelContext)
  if (!context) throw new Error("useProfilePanel must be used within ProfilePanelProvider")
  return context
}
