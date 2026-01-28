import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, View } from "react-native"
import { useImage } from "@shopify/react-native-skia"
import { useGame } from "@shared/game/engine/GameContext"
import type { CardDefinition } from "@shared/game/engine/combatTypes"
import { getCardLibraryMap, getCardSourceMap } from "@shared/game/services/cardLibrary"
import { canEquip } from "@shared/game/services/equipmentService"
import { listOwnerInventory } from "@shared/game/services/inventoryService"
import type { CyberwareSlot, CyberwareSlotKey, EquipmentSlot, ItemTemplate, WeaponSlot } from "@shared/game/types"
import { RARITY_COLORS } from "@shared/utils/ui"
import iconDefault from "../../assets/icon_default.png"
import DeckTab from "./DeckTab"
import SelectionPanel from "./SelectionPanel"
import InventoryList from "./InventoryList"
import EquipSlotsRow from "./EquipSlotsRow"
import CardPreviewModal from "./CardPreviewModal"
import TabToggleRow from "./TabToggleRow"
import { ProfilePanelProvider } from "./ProfilePanelContext"
import styles from "./profilePanelStyles"
import type { DeckEntry, DeckSortMode, DeckViewMode, InventorySortMode, SelectionViewMode, SlotFilter } from "./profilePanelTypes"
import { collectCardRefs, describeEffect, formatItemKindLabel, rarityRank } from "./profilePanelUtils"

export default function ProfilePanel() {
  const { state, dispatch } = useGame()
  const gameState = state as any
  const playerId = state.player.id
  const inventory = useMemo(
    () =>
      listOwnerInventory(
        {
          inventoryEntries: state.inventoryEntries,
          itemInstances: state.itemInstances,
          itemTemplates: state.itemTemplates,
        } as any,
        playerId,
      ),
    [state.inventoryEntries, state.itemInstances, state.itemTemplates, playerId],
  )
  const templateByInstance = useMemo(() => {
    const map = new Map<string, ItemTemplate>()
    inventory.forEach(({ instance, template }) => {
      map.set(instance.id, template)
    })
    Object.values((gameState.itemInstances ?? {}) as Record<string, any>).forEach((inst) => {
      if (inst.ownerId !== playerId) return
      if (map.has(inst.id)) return
      const tpl = gameState.itemTemplates?.[inst.templateId]
      if (tpl) map.set(inst.id, tpl)
    })
    return map
  }, [gameState.itemInstances, gameState.itemTemplates, inventory, playerId])

  const cardMap = useMemo(() => getCardLibraryMap(), [])
  const cardSourceMap = useMemo(() => getCardSourceMap(gameState.itemTemplates), [gameState.itemTemplates])

  const [activeTab, setActiveTab] = useState<"equipment" | "cyberware" | "deck">("equipment")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inventorySortMode, setInventorySortMode] = useState<InventorySortMode>("name")
  const [slotFilter, setSlotFilter] = useState<SlotFilter>(null)
  const [selectionView, setSelectionView] = useState<SelectionViewMode>("description")
  const [deckView, setDeckView] = useState<DeckViewMode>("list")
  const [deckSortMode, setDeckSortMode] = useState<DeckSortMode>("name")
  const [cardPreview, setCardPreview] = useState<CardDefinition | null>(null)
  const [equippingIds, setEquippingIds] = useState<Set<string>>(new Set())
  const isEquipmentTab = activeTab === "equipment"
  const isCyberTab = activeTab === "cyberware"

  const itemIconSkia = useImage(iconDefault)

  const equippedBySlot = useMemo(() => {
    const map = new Map<EquipmentSlot | WeaponSlot | CyberwareSlotKey, string>()
    Object.entries(gameState.loadout?.equipment ?? {}).forEach(([slotId, instanceId]) => {
      if (!instanceId) return
      if (slotId === "trash") return
      map.set(slotId as EquipmentSlot, instanceId as string)
    })
    Object.entries(gameState.loadout?.weapons ?? {}).forEach(([slotId, instanceId]) => {
      if (!instanceId) return
      map.set(slotId as WeaponSlot, instanceId as string)
    })
    Object.entries(gameState.loadout?.cyber ?? {}).forEach(([bucket, slots]) => {
      if (!Array.isArray(slots)) return
      slots.forEach((instanceId, index) => {
        if (!instanceId) return
        map.set(`${bucket}:${index}` as CyberwareSlotKey, instanceId as string)
      })
    })
    return map
  }, [gameState.loadout])

  const equipState = useMemo(
    () =>
      ({
        itemInstances: state.itemInstances,
        itemTemplates: state.itemTemplates,
      }) as any,
    [state.itemInstances, state.itemTemplates],
  )

  const equippedSlotByItem = useMemo(() => {
    const map = new Map<string, EquipmentSlot | WeaponSlot | CyberwareSlotKey>()
    equippedBySlot.forEach((instanceId, slotId) => {
      map.set(instanceId, slotId)
    })
    return map
  }, [equippedBySlot])

  useEffect(() => {
    if (selectedId && inventory.some((item) => item.instance.id === selectedId)) return
    const first = inventory[0]?.instance.id ?? null
    setSelectedId(first)
  }, [inventory, selectedId])

  useEffect(() => {
    if (deckView === "grid" && deckSortMode === "source") setDeckSortMode("name")
  }, [deckSortMode, deckView])

  useEffect(() => {
    setSlotFilter(null)
  }, [activeTab])

  const selectedTemplate = useMemo(() => {
    if (!selectedId) return null
    const inst = gameState.itemInstances?.[selectedId]
    if (!inst) return null
    return gameState.itemTemplates?.[inst.templateId] ?? null
  }, [gameState.itemInstances, gameState.itemTemplates, selectedId])

  const selectedMeta = useMemo(() => {
    if (!selectedId) return null
    const tpl = selectedTemplate ?? templateByInstance.get(selectedId)
    if (!tpl) return null
    return {
      name: tpl.name,
      kind: formatItemKindLabel(tpl),
      rarity: tpl.rarity,
    }
  }, [selectedId, selectedTemplate, templateByInstance])

  const selectionBorderColor = selectedMeta?.rarity ? RARITY_COLORS[selectedMeta.rarity as keyof typeof RARITY_COLORS] ?? styles.selectionPanel.borderColor : styles.selectionPanel.borderColor

  const selectedEffects = useMemo((): string[] => {
    if (!selectedTemplate?.effects?.length) return []
    return selectedTemplate.effects.flatMap(describeEffect).filter(Boolean) as string[]
  }, [selectedTemplate])

  const selectedCards = useMemo<CardDefinition[]>(() => {
    if (!selectedTemplate) return [] as CardDefinition[]
    if (selectedTemplate.kind === "weapon") {
      const primaryRefs = selectedTemplate.weaponCards?.primary ?? []
      const secondaryRefs = selectedTemplate.weaponCards?.secondary ?? []
      const useRefs = slotFilter === "secondary" ? secondaryRefs : primaryRefs
      const resolved = (useRefs.length ? useRefs : primaryRefs).map((ref: string) => cardMap[ref]).filter(Boolean)
      return resolved
    }
    return collectCardRefs(selectedTemplate).map((ref) => cardMap[ref]).filter(Boolean)
  }, [cardMap, selectedTemplate, slotFilter])

  const filteredInventory = useMemo(() => {
    let next = [...inventory]
    if (isEquipmentTab) {
      next = next.filter(({ template }) => template.kind !== "cybernetic")
    }
    if (isCyberTab) {
      next = next.filter(({ template }) => template.kind === "cybernetic")
    }
    if (slotFilter) {
      next = next.filter(({ instance }) => canEquip(equipState, instance.id, slotFilter).ok)
    }
    next.sort((a, b) => {
      const aTpl = a.template
      const bTpl = b.template
      if (inventorySortMode === "rarity") {
        const aRank = rarityRank[aTpl.rarity] ?? 0
        const bRank = rarityRank[bTpl.rarity] ?? 0
        if (aRank !== bRank) return bRank - aRank
      }
      if (inventorySortMode === "type") {
        const aType = formatItemKindLabel(aTpl)
        const bType = formatItemKindLabel(bTpl)
        if (aType !== bType) return aType.localeCompare(bType)
      }
      return aTpl.name.localeCompare(bTpl.name)
    })
    return next
  }, [equipState, inventory, inventorySortMode, isCyberTab, isEquipmentTab, slotFilter])

  const deckCards = useMemo<string[]>(() => gameState.derivedLoadout?.equippedCards ?? [], [gameState.derivedLoadout])
  const deckCounts = useMemo(() => {
    const map = new Map<string, number>()
    deckCards.forEach((id: string) => map.set(id, (map.get(id) ?? 0) + 1))
    return map
  }, [deckCards])

  const deckEntries = useMemo<DeckEntry[]>(() => {
    const entries = Array.from(deckCounts.keys()).map((cardId) => {
      const def = cardMap[cardId]
      return {
        cardId,
        def,
        count: deckCounts.get(cardId) ?? 1,
        source: cardSourceMap.get(cardId),
      }
    }).filter((entry) => entry.def)
    entries.sort((a, b) => {
      if (deckSortMode === "rarity") {
        const aRank = rarityRank[a.def?.rarity ?? ""] ?? 0
        const bRank = rarityRank[b.def?.rarity ?? ""] ?? 0
        if (aRank !== bRank) return bRank - aRank
      }
      if (deckSortMode === "type") {
        const aType = a.def?.type ?? ""
        const bType = b.def?.type ?? ""
        if (aType !== bType) return aType.localeCompare(bType)
      }
      if (deckSortMode === "cost") {
        const aCost = a.def?.cost ?? 0
        const bCost = b.def?.cost ?? 0
        if (aCost !== bCost) return aCost - bCost
      }
      if (deckSortMode === "source") {
        const aSource = a.source?.name ?? ""
        const bSource = b.source?.name ?? ""
        if (aSource !== bSource) return aSource.localeCompare(bSource)
      }
      return (a.def?.name ?? "").localeCompare(b.def?.name ?? "")
    })
    return entries
  }, [cardMap, cardSourceMap, deckCounts, deckSortMode])

  const cycleInventorySort = useCallback(() => {
    const modes: InventorySortMode[] = ["name", "rarity", "type"]
    const idx = modes.indexOf(inventorySortMode)
    setInventorySortMode(modes[(idx + 1) % modes.length])
  }, [inventorySortMode])

  const cycleSelectionView = useCallback(() => {
    const modes: SelectionViewMode[] = ["description", "stats", "cards"]
    const idx = modes.indexOf(selectionView)
    setSelectionView(modes[(idx + 1) % modes.length])
  }, [selectionView])

  const cycleDeckView = useCallback(() => {
    setDeckView((prev) => (prev === "list" ? "grid" : "list"))
  }, [])

  const cycleDeckSort = useCallback(() => {
    const modes: DeckSortMode[] = deckView === "grid" ? ["name", "rarity", "type", "cost"] : ["name", "rarity", "type", "cost", "source"]
    const idx = modes.indexOf(deckSortMode)
    setDeckSortMode(modes[(idx + 1) % modes.length])
  }, [deckSortMode, deckView])

  const handleTrashPress = useCallback(() => {
    if (!selectedId) return
    Alert.alert("Delete item?", "This will permanently remove the selected item.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => dispatch({ type: "REMOVE_ITEM", instanceId: selectedId }),
      },
    ])
  }, [dispatch, selectedId])

  const handleSlotPress = useCallback((slotId: EquipmentSlot | WeaponSlot | CyberwareSlotKey | "trash") => {
    if (slotId === "trash") {
      handleTrashPress()
      return
    }
    if (slotFilter === slotId) {
      setSlotFilter(null)
      return
    }
    setSlotFilter(slotId)
    const equippedId = equippedBySlot.get(slotId) ?? null
    if (equippedId) {
      setSelectedId(equippedId)
      return
    }
    const candidate = inventory.find(({ instance }) => canEquip(equipState, instance.id, slotId).ok)
    if (candidate) setSelectedId(candidate.instance.id)
  }, [equipState, equippedBySlot, handleTrashPress, inventory, slotFilter])

  const handleItemSelect = useCallback((itemId: string) => {
    setSelectedId(itemId)
  }, [])

  const startEquip = useCallback((id: string) => {
    setEquippingIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const finishEquip = useCallback((id: string) => {
    setEquippingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const handleEquipToggle = useCallback((itemId: string, template?: ItemTemplate | null) => {
    setSelectedId(itemId)
    const equippedSlot = equippedSlotByItem.get(itemId)

    const schedule = (action: () => void) => {
      // let the spinner render before doing synchronous work
      requestAnimationFrame(() => {
        try {
          action()
        } finally {
          finishEquip(itemId)
        }
      })
    }

    if (equippedSlot) {
      if (template?.kind === "weapon" && !slotFilter) return
      startEquip(itemId)
      schedule(() => dispatch({ type: "UNEQUIP_SLOT", slot: equippedSlot }))
      return
    }
    if (!template) return

    const tryEquip = (slot?: EquipmentSlot | WeaponSlot | CyberwareSlot | CyberwareSlotKey | null) => {
      if (!slot || slot === "trash") return false
      const validation = canEquip(equipState, itemId, slot)
      if (!validation.ok) return false
      dispatch({ type: "EQUIP_ITEM", instanceId: itemId, slot })
      return true
    }

    if (template.kind === "equipment") {
      startEquip(itemId)
      schedule(() => tryEquip(template.equipSlot as EquipmentSlot))
      return
    }
    if (template.kind === "cybernetic") {
      startEquip(itemId)
      schedule(() => {
        if (slotFilter && slotFilter.includes(":")) {
          tryEquip(slotFilter as CyberwareSlotKey)
          return
        }
        tryEquip(template.equipSlot as CyberwareSlot)
      })
      return
    }
    if (template.kind === "weapon") {
      if (!slotFilter) return
      const forcedSlot = slotFilter === "primary" || slotFilter === "secondary" ? slotFilter : null
      if (!forcedSlot) return
      startEquip(itemId)
      schedule(() => tryEquip(forcedSlot))
      return
    }
  }, [dispatch, equipState, equippedSlotByItem, slotFilter, startEquip, finishEquip])

  const contextValue = useMemo(
    () => ({
      activeTab,
      setActiveTab,
      itemIconSkia,
      selectionView,
      cycleSelectionView,
      selectedTemplate,
      selectedMeta,
      selectedEffects,
      selectedCards,
      selectionBorderColor,
      deckCounts,
      inventorySortMode,
      cycleInventorySort,
      slotFilter,
      filteredInventory,
      selectedId,
      equippedSlotByItem,
      handleItemSelect,
      handleEquipToggle,
      equippedBySlot,
      templateByInstance,
      handleSlotPress,
      deckEntries,
      deckView,
      deckSortMode,
      cycleDeckView,
      cycleDeckSort,
      cardPreview,
      setCardPreview,
      closeCardPreview: () => setCardPreview(null),
      equippingIds,
      startEquip,
      finishEquip,
    }),
    [
      activeTab,
      cardPreview,
      cycleDeckSort,
      cycleDeckView,
      cycleInventorySort,
      cycleSelectionView,
      deckCounts,
      deckEntries,
      deckSortMode,
      deckView,
      equippedBySlot,
      equippedSlotByItem,
      filteredInventory,
      handleEquipToggle,
      handleItemSelect,
      handleSlotPress,
      inventorySortMode,
      itemIconSkia,
      selectedCards,
      selectedEffects,
      selectedId,
      selectedMeta,
      selectedTemplate,
      selectionBorderColor,
      selectionView,
      setActiveTab,
      setCardPreview,
      equippingIds,
      startEquip,
      finishEquip,
      slotFilter,
      templateByInstance,
    ],
  )

  return (
    <ProfilePanelProvider value={contextValue}>
      <View style={styles.container}>
        {activeTab === "deck" ? (
          <DeckTab />
        ) : (
          <View style={styles.content}>
            <SelectionPanel />
            <InventoryList />
            <EquipSlotsRow />
          </View>
        )}

        <TabToggleRow />

        <CardPreviewModal />
      </View>
    </ProfilePanelProvider>
  )
}
