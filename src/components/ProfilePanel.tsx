import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import fontConfig from "@shared/utils/fontConfig"
import { RARITY_COLORS } from "@shared/utils/ui"
import iconDefault from "../assets/icon_default.png"
import { useGame } from "@shared/game/engine/GameContext"
import { listOwnerInventory } from "@shared/game/services/inventoryService"
import { canEquip } from "@shared/game/services/equipmentService"
import type { CardRef, CyberSlot, EquipmentSlot, ItemTemplate, WeaponSlot } from "@shared/game/types"
import { Canvas, Image as SkiaImage, FilterMode, MipmapMode, useImage } from "@shopify/react-native-skia"
import type { CardDefinition } from "@shared/game/engine/combatTypes"
import CARDS from "@shared/game/content/cards"

const FACES = fontConfig.fontFaceNames()
const EQUIP_SLOTS = ["accessory", "top", "bottom", "primary", "secondary", "utility", "trash"] as const
const CYBER_SLOTS = ["neural", "ocular", "skeletal", "dermal", "systems", "external", "trash"] as const
const ITEM_ICON_SIZE = 34
const SELECTION_ICON_SIZE = 56
const MINI_CARD_SIZE = 44
const SCREEN_WIDTH = Dimensions.get("window").width
const GRID_COLUMNS = SCREEN_WIDTH > 420 ? 5 : 4
const GRID_GAP = 10
const GRID_WIDTH = SCREEN_WIDTH - 80
const GRID_CARD_WIDTH = Math.max(72, Math.floor((GRID_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS))
const GRID_CARD_HEIGHT = Math.floor(GRID_CARD_WIDTH * 1.35)

type InventorySortMode = "name" | "rarity" | "type"
type DeckSortMode = "name" | "rarity" | "type" | "cost" | "source"
type DeckViewMode = "list" | "grid"
type SelectionViewMode = "description" | "stats" | "cards"
type SlotFilter = EquipmentSlot | WeaponSlot | CyberSlot | null

/*

TODO (BUGFIXING):

- equipment tab should only show equipment, consumables, and misc items (no cyberware)
  - during default filter (all), disable equip/unequip for weapons
    - when browsing primary weapons, pressing equip button should put them in primary slot
    - when browsing secondary weapons, pressing equip button should put them in secondary slot
    - include handlers like:
      - if item is currently equipped as secondary, equipping it again as primary should move (avoid duplication)
      - description panel should show cards according to menu context
        - all filter: default to primary cards
        - primary filter: primary cards only
        - secondary filter: secondary cards only
        - I want to replace the format of the mini cards to be the same as deck view cards
          - including cost and duplicate count (copy whole format from deck view cards)
  - description panel in general (both equipment and cyberware tabs)
    - move type text to be next to name as an icon
    - format: "{icon} {name}"
- cyberware tab should only show cyberware items

- deck tab
  - list view should be more compact
    - instead of centered vertically, put the cost in top left corner
    - also move duplicate count to the top right corner
    - move the source item name below the source item icon
    - card name and type should be on same line
      - replace type text with icon (use feather or lucide icons)
      - format: "{icon} {name}"
    - keep 2 line description
    - all cards should have a fixed height
  - grid view should be centered (right now it is left aligned)
    - move the duplicate count to top right corner
    - move the cost to top left corner badge

*/

const rarityRank: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  unique: 4,
}

const capitalizeSlot = (slot?: string) => {
  if (!slot) return ""
  return slot.charAt(0).toUpperCase() + slot.slice(1)
}

const formatItemKindLabel = (template: ItemTemplate) => {
  switch (template.kind) {
    case "equipment": {
      const slot = capitalizeSlot(template.equipSlot)
      return slot || "Equipment"
    }
    case "cybernetic": {
      const slot = capitalizeSlot(template.equipSlot)
      return slot ? `${slot} Cyberware` : "Cyberware"
    }
    case "weapon": {
      if (template.weaponSlotPolicy === "primaryOnly") return "Primary"
      if (template.weaponSlotPolicy === "secondaryOnly") return "Secondary"
      return "Primary/Secondary"
    }
    case "consumable":
      return "Consumable"
    case "misc":
      return "Misc"
    default:
      return capitalizeSlot(template.kind)
  }
}

const resolveItemIcon = (template: ItemTemplate) => {
  switch (template.kind) {
    case "equipment": {
      switch (template.equipSlot) {
        case "accessory":
          return "watch"
        case "top":
          return "layers"
        case "bottom":
          return "square"
        case "utility":
          return "tool"
        default:
          return "shield"
      }
    }
    case "cybernetic":
      return "cpu"
    case "weapon":
      return "crosshair"
    case "consumable":
      return "droplet"
    default:
      return "package"
  }
}

const resolveCardTypeIcon = (type?: string) => {
  switch (type) {
    case "attack":
      return "crosshair"
    case "utility":
      return "zap"
    case "skill":
      return "activity"
    case "defense":
      return "shield"
    default:
      return "layers"
  }
}

const resolveSlotIcon = (slot: EquipmentSlot | WeaponSlot | CyberSlot) => {
  switch (slot) {
    case "accessory":
      return "watch"
    case "top":
      return "layers"
    case "bottom":
      return "square"
    case "utility":
      return "tool"
    case "primary":
    case "secondary":
      return "crosshair"
    case "neural":
      return "cpu"
    case "ocular":
      return "eye"
    case "skeletal":
      return "activity"
    case "dermal":
      return "shield"
    case "systems":
      return "hard-drive"
    case "external":
      return "wifi"
    default:
      return "box"
  }
}

const collectCardRefs = (template?: ItemTemplate | null): CardRef[] => {
  if (!template) return []
  const refs = new Set<CardRef>()
  template.cardRefs?.forEach((ref) => refs.add(ref))
  template.passiveCardRefs?.forEach((ref) => refs.add(ref))
  if (template.weaponCards) {
    Object.values(template.weaponCards).forEach((list) => list?.forEach((ref) => refs.add(ref)))
  }
  return [...refs]
}

const describeEffect = (effect: any): string[] => {
  if (!effect) return []
  const lines: string[] = []
  if (effect.kind === "stat") {
    if (effect.vitals) {
      Object.entries(effect.vitals).forEach(([key, val]) => {
        lines.push(`${capitalizeSlot(key)} ${Number(val) >= 0 ? "+" : ""}${val}`)
      })
    }
    if (effect.skills) {
      Object.entries(effect.skills).forEach(([key, val]) => {
        if (key === "subSkills" && val && typeof val === "object") {
          Object.entries(val as Record<string, number>).forEach(([subKey, subVal]) => {
            lines.push(`${capitalizeSlot(subKey)} ${Number(subVal) >= 0 ? "+" : ""}${subVal}`)
          })
        } else if (typeof val === "number") {
          lines.push(`${capitalizeSlot(key)} ${Number(val) >= 0 ? "+" : ""}${val}`)
        }
      })
    }
  } else if (effect.kind === "faction") {
    if (effect.factionTags?.length) lines.push(`Faction: ${effect.factionTags.join(", ")}`)
  } else if (effect.kind === "custom") {
    lines.push("Custom effect")
  }
  return lines
}

export default function ProfilePanel() {
  const { state, dispatch } = useGame()
  const gameState = state as any
  const playerId = state.player.id
  const inventory = useMemo(() => listOwnerInventory(state, playerId), [state, playerId])
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

  const cardMap = useMemo(() => CARDS.reduce<Record<string, CardDefinition>>((acc, c) => { acc[c.id] = c; return acc }, {}), [])
  const cardSourceMap = useMemo(() => {
    const map = new Map<string, { name: string; rarity?: string }>()
    Object.values((gameState.itemTemplates ?? {}) as Record<string, ItemTemplate>).forEach((tpl) => {
      collectCardRefs(tpl).forEach((ref) => {
        if (!map.has(ref)) map.set(ref, { name: tpl.name, rarity: tpl.rarity })
      })
    })
    return map
  }, [gameState.itemTemplates])

  const [activeTab, setActiveTab] = useState<"equipment" | "cyberware" | "deck">("equipment")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inventorySortMode, setInventorySortMode] = useState<InventorySortMode>("name")
  const [slotFilter, setSlotFilter] = useState<SlotFilter>(null)
  const [selectionView, setSelectionView] = useState<SelectionViewMode>("description")
  const [deckView, setDeckView] = useState<DeckViewMode>("list")
  const [deckSortMode, setDeckSortMode] = useState<DeckSortMode>("name")
  const [cardPreview, setCardPreview] = useState<CardDefinition | null>(null)
  const isEquipmentTab = activeTab === "equipment"
  const isCyberTab = activeTab === "cyberware"
  const isDeckTab = activeTab === "deck"

  const itemIconSkia = useImage(iconDefault)

  const equippedBySlot = useMemo(() => {
    const map = new Map<EquipmentSlot | WeaponSlot | CyberSlot, string>()
    Object.entries(gameState.loadout?.equipment ?? {}).forEach(([slotId, instanceId]) => {
      if (!instanceId) return
      if (slotId === "trash") return
      map.set(slotId as EquipmentSlot, instanceId as string)
    })
    Object.entries(gameState.loadout?.weapons ?? {}).forEach(([slotId, instanceId]) => {
      if (!instanceId) return
      map.set(slotId as WeaponSlot, instanceId as string)
    })
    Object.entries(gameState.loadout?.cyber ?? {}).forEach(([slotId, instanceId]) => {
      if (!instanceId) return
      map.set(slotId as CyberSlot, instanceId as string)
    })
    return map
  }, [gameState.loadout])

  const equippedSlotByItem = useMemo(() => {
    const map = new Map<string, EquipmentSlot | WeaponSlot | CyberSlot>()
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
      next = next.filter(({ instance }) => canEquip(state, instance.id, slotFilter).ok)
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
  }, [inventory, inventorySortMode, slotFilter, state])

  const deckCards = useMemo<string[]>(() => gameState.derivedLoadout?.equippedCards ?? [], [gameState.derivedLoadout])
  const deckCounts = useMemo(() => {
    const map = new Map<string, number>()
    deckCards.forEach((id: string) => map.set(id, (map.get(id) ?? 0) + 1))
    return map
  }, [deckCards])

  const deckEntries = useMemo(() => {
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

  const handleSlotPress = useCallback((slotId: EquipmentSlot | WeaponSlot | CyberSlot | "trash") => {
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
    const candidate = inventory.find(({ instance }) => canEquip(state, instance.id, slotId).ok)
    if (candidate) setSelectedId(candidate.instance.id)
  }, [equippedBySlot, handleTrashPress, inventory, slotFilter, state])

  const handleItemSelect = useCallback((itemId: string) => {
    setSelectedId(itemId)
  }, [])

  const handleEquipToggle = useCallback((itemId: string, template?: ItemTemplate | null) => {
    setSelectedId(itemId)
    const equippedSlot = equippedSlotByItem.get(itemId)
    if (equippedSlot) {
      if (template?.kind === "weapon" && !slotFilter) return
      dispatch({ type: "UNEQUIP_SLOT", slot: equippedSlot })
      return
    }
    if (!template) return

    const tryEquip = (slot?: EquipmentSlot | WeaponSlot | CyberSlot | null) => {
      if (!slot || slot === "trash") return false
      const validation = canEquip(state, itemId, slot)
      if (!validation.ok) return false
      dispatch({ type: "EQUIP_ITEM", instanceId: itemId, slot })
      return true
    }

    if (template.kind === "equipment") {
      tryEquip(template.equipSlot as EquipmentSlot)
      return
    }
    if (template.kind === "cybernetic") {
      tryEquip(template.equipSlot as CyberSlot)
      return
    }
    if (template.kind === "weapon") {
      if (!slotFilter) return
      const forcedSlot = slotFilter === "primary" || slotFilter === "secondary" ? slotFilter : null
      if (!forcedSlot) return
      tryEquip(forcedSlot)
      return
    }
  }, [dispatch, equippedSlotByItem, slotFilter, state])

  if (activeTab === "deck") {
    return (
      <View style={styles.container}>
        <View style={styles.deckControls}>
          <Pressable style={styles.deckToggleButton} onPress={cycleDeckView}>
            <Feather name={deckView === "list" ? "grid" : "list"} size={16} color="#cfe1ff" />
          </Pressable>
          <Pressable style={styles.deckSortButton} onPress={cycleDeckSort}>
            <Feather name="filter" size={14} color="#cfe1ff" />
            <Text style={styles.deckSortText}>Sort: {deckSortMode}</Text>
          </Pressable>
        </View>

        {deckEntries.length === 0 ? (
          <Text style={styles.empty}>No cards in your deck.</Text>
        ) : deckView === "list" ? (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {deckEntries.map((entry) => {
              const def = entry.def as CardDefinition
              const rarityColor = def?.rarity ? RARITY_COLORS[def.rarity as keyof typeof RARITY_COLORS] ?? "#253146" : "#253146"
              const sourceBorder = entry.source?.rarity ? RARITY_COLORS[entry.source.rarity as keyof typeof RARITY_COLORS] ?? "#2b3a55" : "#2b3a55"
              return (
                <Pressable key={entry.cardId} style={[styles.deckListRow, { borderColor: rarityColor }]} onPress={() => setCardPreview(def)}>
                  <View style={styles.deckListCostBadge}>
                    <Text style={styles.deckCostText}>{def?.cost ?? 0}</Text>
                  </View>
                  {entry.count > 1 ? (
                    <View style={styles.deckListCountBadge}>
                      <Text style={styles.countBadgeText}>x{entry.count}</Text>
                    </View>
                  ) : null}
                  <View style={styles.deckSourceColumn}>
                    <View style={[styles.sourceIconWrap, { borderColor: sourceBorder }]}>
                      <Canvas style={styles.sourceIconCanvas}>
                        {itemIconSkia ? (
                          <SkiaImage
                            image={itemIconSkia}
                            x={2}
                            y={2}
                            width={ITEM_ICON_SIZE - 6}
                            height={ITEM_ICON_SIZE - 6}
                            fit="contain"
                            sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                          />
                        ) : null}
                      </Canvas>
                    </View>
                    <Text numberOfLines={1} style={styles.deckSourceName}>{entry.source?.name ?? "Unknown"}</Text>
                  </View>
                  <View style={styles.deckTextWrap}>
                    <View style={styles.deckTitleRow}>
                      <Feather name={resolveCardTypeIcon(def?.type)} size={12} color="#9aa6bf" />
                      <Text numberOfLines={1} style={styles.deckCardTitle}>{def?.name ?? entry.cardId}</Text>
                    </View>
                    <Text numberOfLines={2} style={styles.deckCardDesc}>{def?.description ?? ""}</Text>
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.deckGrid}>
            {deckEntries.map((entry) => {
              const def = entry.def as CardDefinition
              const rarityColor = def?.rarity ? RARITY_COLORS[def.rarity as keyof typeof RARITY_COLORS] ?? "#253146" : "#253146"
              return (
                <Pressable key={entry.cardId} style={[styles.deckGridCard, { width: GRID_CARD_WIDTH, height: GRID_CARD_HEIGHT, borderColor: rarityColor }]} onPress={() => setCardPreview(def)}>
                  <View style={styles.gridCostBadge}>
                    <Text style={styles.gridCostText}>{def?.cost ?? 0}</Text>
                  </View>
                  {entry.count > 1 ? (
                    <View style={styles.gridCountBadge}>
                      <Text style={styles.gridCountText}>x{entry.count}</Text>
                    </View>
                  ) : null}
                  <View style={styles.gridCardArt}>
                    <Canvas style={styles.gridCardCanvas}>
                      {itemIconSkia ? (
                        <SkiaImage
                          image={itemIconSkia}
                          x={8}
                          y={8}
                          width={GRID_CARD_WIDTH - 16}
                          height={GRID_CARD_HEIGHT - 40}
                          fit="contain"
                          sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                        />
                      ) : null}
                    </Canvas>
                  </View>
                  <View style={styles.gridCardFooter}>
                    <Text numberOfLines={1} style={styles.gridCardTitle}>{def?.name ?? entry.cardId}</Text>
                    <Text style={styles.gridCardMeta}>{def?.type ?? "?"}</Text>
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
        )}

        <View style={styles.toggleRow}>
          <Pressable onPress={() => setActiveTab("equipment")} style={[styles.toggleButton, isEquipmentTab ? styles.toggleActive : null, { marginRight: 8 }]}> 
            <Text style={[styles.toggleText, isEquipmentTab ? styles.toggleTextActive : null]}>Equipment</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("cyberware")} style={[styles.toggleButton, isCyberTab ? styles.toggleActive : null, { marginRight: 8 }]}> 
            <Text style={[styles.toggleText, isCyberTab ? styles.toggleTextActive : null]}>Cybernetics</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("deck")} style={[styles.toggleButton, isDeckTab ? styles.toggleActive : null]}>
            <Text style={[styles.toggleText, isDeckTab ? styles.toggleTextActive : null]}>Deck</Text>
          </Pressable>
        </View>

        <Modal transparent visible={!!cardPreview} animationType="fade" onRequestClose={() => setCardPreview(null)}>
          <Pressable style={styles.cardModalOverlay} onPress={() => setCardPreview(null)}>
            <View style={styles.cardModal}>
              <View style={styles.cardModalArt}>
                <Canvas style={styles.cardModalCanvas}>
                  {itemIconSkia ? (
                    <SkiaImage
                      image={itemIconSkia}
                      x={12}
                      y={12}
                      width={140}
                      height={140}
                      fit="contain"
                      sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                    />
                  ) : null}
                </Canvas>
              </View>
              <Text style={styles.cardModalTitle}>{cardPreview?.name}</Text>
              <Text style={styles.cardModalMeta}>{cardPreview?.type ?? "?"} · Cost {cardPreview?.cost ?? 0}</Text>
              <Text style={styles.cardModalDesc}>{cardPreview?.description ?? ""}</Text>
            </View>
          </Pressable>
        </Modal>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.selectionPanel, { borderColor: selectionBorderColor }]}>
          <View style={styles.selectionSideColumn}>
            <View style={styles.selectionIconWrap}>
              <Canvas style={styles.selectionIconCanvas}>
                {itemIconSkia ? (
                  <SkiaImage
                    image={itemIconSkia}
                    x={(SELECTION_ICON_SIZE - 8) * 0.1}
                    y={(SELECTION_ICON_SIZE - 8) * 0.1}
                    width={SELECTION_ICON_SIZE}
                    height={SELECTION_ICON_SIZE}
                    fit="contain"
                    sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                  />
                ) : null}
              </Canvas>
            </View>
            <Pressable style={styles.selectionButton} onPress={cycleSelectionView}>
              <Feather
                name={selectionView === "description" ? "align-left" : selectionView === "stats" ? "bar-chart-2" : "image"}
                size={16}
                color="#cfe1ff"
              />
            </Pressable>
          </View>
          <View style={styles.selectionTextWrap}>
            <View style={styles.selectionTitleRow}>
              <Feather name={selectedTemplate ? resolveItemIcon(selectedTemplate) : "box"} size={14} color="#9aa6bf" />
              <Text style={styles.selectionTitle} numberOfLines={1}>{selectedMeta?.name ?? "Loading items..."}</Text>
            </View>
            {selectionView === "description" ? (
              <Text style={styles.selectionDesc} numberOfLines={4}>{selectedTemplate?.description ?? "No description."}</Text>
            ) : null}
            {selectionView === "stats" ? (
              <View style={styles.selectionStats}>
                {selectedEffects.length ? (
                  selectedEffects.map((line, idx) => (
                    <Text key={`${line}-${idx}`} style={styles.selectionStatText}>{line}</Text>
                  ))
                ) : (
                  <Text style={styles.selectionDesc}>No stats.</Text>
                )}
              </View>
            ) : null}
            {selectionView === "cards" ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.deckGrid, { flexWrap: "nowrap", paddingVertical: 6 }] }>
                {selectedCards.length ? selectedCards.map((card: CardDefinition) => {
                  const borderColor = card.rarity ? RARITY_COLORS[card.rarity as keyof typeof RARITY_COLORS] ?? "#2b3a55" : "#2b3a55"
                  const count = deckCounts.get(card.id) ?? 0
                  return (
                    <Pressable key={card.id} style={[styles.deckGridCard, { width: GRID_CARD_WIDTH, height: GRID_CARD_HEIGHT, borderColor }]} onPress={() => setCardPreview(card)}>
                      <View style={styles.gridCostBadge}>
                        <Text style={styles.gridCostText}>{card.cost ?? 0}</Text>
                      </View>
                      {count > 1 ? (
                        <View style={styles.gridCountBadge}>
                          <Text style={styles.gridCountText}>x{count}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.gridCardArt, { height: GRID_CARD_HEIGHT - 48 }] }>
                        <Canvas style={styles.gridCardCanvas}>
                          {itemIconSkia ? (
                            <SkiaImage
                              image={itemIconSkia}
                              x={8}
                              y={8}
                              width={GRID_CARD_WIDTH - 16}
                              height={GRID_CARD_HEIGHT - 40}
                              fit="contain"
                              sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                            />
                          ) : null}
                        </Canvas>
                      </View>
                      <View style={styles.gridCardFooter}>
                        <View style={styles.deckTitleRow}>
                          <Text numberOfLines={1} style={styles.gridCardTitle}>{card.name}</Text>
                        </View>
                        <Text style={styles.gridCardMeta}>{card.type ?? "?"}</Text>
                        
                      </View>
                    </Pressable>
                  )
                }) : (
                  <Text style={styles.selectionDesc}>No cards.</Text>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>

        <View style={styles.sortRow}>
          <Pressable style={styles.sortButton} onPress={cycleInventorySort}>
            <Feather name="filter" size={14} color="#cfe1ff" />
            <Text style={styles.sortText}>Sort: {inventorySortMode}</Text>
          </Pressable>
          {slotFilter ? (
            <View style={styles.filterChip}>
              <Feather name={resolveSlotIcon(slotFilter as any)} size={12} color="#cfe1ff" />
              <Text style={styles.filterText}>{slotFilter}</Text>
            </View>
          ) : null}
        </View>

        <ScrollView style={styles.inventoryList} contentContainerStyle={styles.inventoryListContent}>
          {filteredInventory.length === 0 ? (
            <Text style={styles.empty}>No items found.</Text>
          ) : filteredInventory.map(({ instance, template }) => {
            const borderColor = template.rarity ? RARITY_COLORS[template.rarity as keyof typeof RARITY_COLORS] ?? "#2b3a55" : "#2b3a55"
            const isSelected = selectedId === instance.id
            const equippedSlot = equippedSlotByItem.get(instance.id)
            const isWeapon = template.kind === "weapon"
            const canEquipSlot = (template.kind === "equipment" || template.kind === "weapon" || template.kind === "cybernetic") && (!isWeapon || !!slotFilter)
            return (
              <Pressable key={instance.id} style={[styles.inventoryRow, isSelected ? styles.inventoryRowSelected : null]} onPress={() => handleItemSelect(instance.id)}>
                <View style={[styles.inventoryIconWrap, { borderColor }]}>
                  <Canvas style={styles.inventoryIconCanvas}>
                    {itemIconSkia ? (
                      <SkiaImage
                        image={itemIconSkia}
                        x={3}
                        y={3}
                        width={ITEM_ICON_SIZE - 6}
                        height={ITEM_ICON_SIZE - 6}
                        fit="contain"
                        sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                      />
                    ) : null}
                  </Canvas>
                </View>
                <View style={styles.inventoryTypeIcon}>
                  <Feather name={resolveItemIcon(template) as any} size={16} color="#cfe1ff" />
                </View>
                <View style={styles.inventoryTextWrap}>
                  <Text numberOfLines={1} style={styles.inventoryName}>{template.name}</Text>
                  <Text style={styles.inventoryMeta}>{formatItemKindLabel(template)}</Text>
                </View>
                <Pressable
                  style={[styles.equipButton, equippedSlot ? styles.equipButtonActive : null, !canEquipSlot ? styles.equipButtonDisabled : null]}
                  onPress={() => handleEquipToggle(instance.id, template)}
                  disabled={!canEquipSlot}
                >
                  <Feather name={equippedSlot ? "x" : "arrow-up"} size={14} color="#cfe1ff" />
                </Pressable>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={styles.equipRow}>
          {(activeTab === "equipment" ? EQUIP_SLOTS : CYBER_SLOTS).map((label) => {
            const isTrash = label === "trash"
            const slotId = label as EquipmentSlot | WeaponSlot | CyberSlot
            const equippedId = !isTrash ? equippedBySlot.get(slotId) : null
            const template = equippedId ? templateByInstance.get(equippedId) : null
            const borderColor = template?.rarity ? RARITY_COLORS[template.rarity as keyof typeof RARITY_COLORS] ?? "#2b3a55" : "#2b3a55"
            return (
              <Pressable key={label} style={styles.equipSlotWrap} onPress={() => handleSlotPress(isTrash ? "trash" : slotId)}>
                <Text style={styles.equipLabel}>{label.toUpperCase()}</Text>
                <View style={[styles.equipSlot, isTrash ? styles.trashSlot : null, slotFilter === slotId ? styles.equipSlotActive : null]}>
                  {isTrash ? (
                    <Feather name="trash" size={18} color="#ff6b6b" />
                  ) : equippedId && itemIconSkia ? (
                    <View style={[styles.slotIconWrap, { borderColor }]}>
                      <Canvas style={styles.slotIconCanvas}>
                        <SkiaImage
                          image={itemIconSkia}
                          x={4}
                          y={4}
                          width={ITEM_ICON_SIZE - 8}
                          height={ITEM_ICON_SIZE - 8}
                          fit="contain"
                          sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                        />
                      </Canvas>
                    </View>
                  ) : (
                    <Feather name={resolveSlotIcon(slotId)} size={16} color="#44506b" />
                  )}
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Pressable onPress={() => setActiveTab("equipment")} style={[styles.toggleButton, isEquipmentTab ? styles.toggleActive : null, { marginRight: 8 }]}> 
          <Text style={[styles.toggleText, isEquipmentTab ? styles.toggleTextActive : null]}>Equipment</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("cyberware")} style={[styles.toggleButton, isCyberTab ? styles.toggleActive : null, { marginRight: 8 }]}>
          <Text style={[styles.toggleText, isCyberTab ? styles.toggleTextActive : null]}>Cybernetics</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("deck")} style={[styles.toggleButton, isDeckTab ? styles.toggleActive : null]}>
          <Text style={[styles.toggleText, isDeckTab ? styles.toggleTextActive : null]}>Deck</Text>
        </Pressable>
      </View>

      <Modal transparent visible={!!cardPreview} animationType="fade" onRequestClose={() => setCardPreview(null)}>
        <Pressable style={styles.cardModalOverlay} onPress={() => setCardPreview(null)}>
          <View style={styles.cardModal}>
            <View style={styles.cardModalArt}>
              <Canvas style={styles.cardModalCanvas}>
                {itemIconSkia ? (
                  <SkiaImage
                    image={itemIconSkia}
                    x={12}
                    y={12}
                    width={140}
                    height={140}
                    fit="contain"
                    sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                  />
                ) : null}
              </Canvas>
            </View>
            <Text style={styles.cardModalTitle}>{cardPreview?.name}</Text>
            <Text style={styles.cardModalMeta}>{cardPreview?.type ?? "?"} · Cost {cardPreview?.cost ?? 0}</Text>
            <Text style={styles.cardModalDesc}>{cardPreview?.description ?? ""}</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0c0f18",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1d2435",
    position: "relative",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
  },
  selectionPanel: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2b3a55",
    backgroundColor: "#0f1722",
    marginBottom: 8,
    height: "30%",
    width: "100%",
  },
  selectionSideColumn: {
    alignItems: "center",
    marginRight: 10,
    gap: 8,
  },
  selectionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#161e30",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionIconCanvas: {
    width: "100%",
    height: "100%",
  },
  selectionTextWrap: { flex: 1, justifyContent: "flex-start", gap: 4 },
  selectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  selectionTitle: { color: "#f5f6fb", fontFamily: FACES.BOLD, fontSize: 14 },
  selectionDesc: { color: "#c6cedd", fontSize: 11, lineHeight: 16, flexShrink: 1 },
  selectionStats: { gap: 3 },
  selectionStatText: { color: "#8eb6ff", fontSize: 11 },
  selectionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2b3a55",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#131d2f",
  },
  cardStrip: { gap: 10, paddingVertical: 4 },
  selectionCardRow: {
    width: 220,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#111624",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 78,
  },
  selectionCardBadgeLeft: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#1a2336",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2b3a55",
  },
  selectionCardBadgeRight: {
    position: "absolute",
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#1a2336",
    borderWidth: 1,
    borderColor: "#2b3a55",
  },
  selectionCardIcon: {
    width: ITEM_ICON_SIZE + 6,
    height: ITEM_ICON_SIZE + 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2b3a55",
    backgroundColor: "#121b2b",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCardText: { flex: 1, gap: 2 },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2b3a55",
    backgroundColor: "#111827",
  },
  sortText: { color: "#cfe1ff", fontFamily: FACES.BOLD, fontSize: 11 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2b3a55",
    backgroundColor: "#0f1722",
  },
  filterText: { color: "#cfe1ff", fontSize: 10, fontFamily: FACES.REGULAR },
  inventoryList: { flex: 1 },
  inventoryListContent: { paddingBottom: 12, gap: 6 },
  inventoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2a3f",
    backgroundColor: "#0f1722",
  },
  inventoryRowSelected: { borderColor: "#4ea1ff", backgroundColor: "#14233a" },
  inventoryIconWrap: {
    width: ITEM_ICON_SIZE + 6,
    height: ITEM_ICON_SIZE + 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#121b2b",
    alignItems: "center",
    justifyContent: "center",
  },
  inventoryIconCanvas: { width: ITEM_ICON_SIZE, height: ITEM_ICON_SIZE },
  inventoryTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2b3a55",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101827",
  },
  inventoryTextWrap: { flex: 1, gap: 2 },
  inventoryName: { color: "#f5f6fb", fontFamily: FACES.BOLD, fontSize: 12 },
  inventoryMeta: { color: "#9aa6bf", fontSize: 10, fontFamily: FACES.REGULAR },
  equipButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2b3a55",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#131d2f",
  },
  equipButtonActive: { borderColor: "#ff6b6b" },
  equipButtonDisabled: { opacity: 0.4 },
  equipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  equipSlotWrap: {
    alignItems: "center",
    width: 48,
  },
  equipSlot: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e2637",
    backgroundColor: "#0f1722",
    alignItems: "center",
    justifyContent: "center",
  },
  equipSlotActive: {
    borderColor: "#4ea1ff",
    backgroundColor: "#14233a",
  },
  equipLabel: {
    color: "#9aa6bf",
    fontSize: 6,
    textTransform: "capitalize",
    marginBottom: 4,
  },
  trashSlot: {
    borderColor: "#ff4d4d",
    backgroundColor: "#2d0b0b",
  },
  slotIconWrap: {
    width: ITEM_ICON_SIZE + 4,
    height: ITEM_ICON_SIZE + 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#121b2b",
    alignItems: "center",
    justifyContent: "center",
  },
  slotIconCanvas: { width: ITEM_ICON_SIZE, height: ITEM_ICON_SIZE },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  toggleActive: {
    backgroundColor: "#162033",
    borderWidth: 1,
    borderColor: "#2b3a55",
  },
  toggleText: {
    color: "#9aa6bf",
    fontSize: 12,
    fontFamily: FACES.BOLD,
    textAlign: "center",
  },
  toggleTextActive: {
    color: "#cfe1ff",
  },
  list: { gap: 10 },
  listContent: { paddingBottom: 12, gap: 8 },
  empty: { color: "#8e93a8" },
  deckControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  deckToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2b3a55",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  deckSortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2b3a55",
    backgroundColor: "#111827",
  },
  deckSortText: { color: "#cfe1ff", fontFamily: FACES.BOLD, fontSize: 11 },
  deckListRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#111624",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 86,
  },
  deckListCostBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "#2b3a55",
  },
  deckListCountBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "#2b3a55",
  },
  deckCostText: { color: "#cfe1ff", fontFamily: FACES.BOLD, fontSize: 11 },
  deckSourceColumn: { alignItems: "center", width: ITEM_ICON_SIZE + 10, gap: 4 },
  deckSourceName: { color: "#9aa6bf", fontSize: 6, textAlign: "center" },
  sourceIconWrap: {
    width: ITEM_ICON_SIZE + 6,
    height: ITEM_ICON_SIZE + 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#121b2b",
    alignItems: "center",
    justifyContent: "center",
  },
  sourceIconCanvas: { width: ITEM_ICON_SIZE, height: ITEM_ICON_SIZE },
  deckTextWrap: { flex: 1, gap: 2 },
  deckTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  deckCardTitle: { color: "#f2f3f7", fontFamily: FACES.BOLD, fontSize: 12 },
  deckCardDesc: { color: "#c9cdd8", fontSize: 10, lineHeight: 14 },
  countBadgeText: { color: "#cfe1ff", fontSize: 10, fontFamily: FACES.BOLD },
  deckGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    paddingBottom: 12,
    justifyContent: "center",
  },
  deckGridCard: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#0f1722",
    overflow: "hidden",
  },
  gridCardArt: { flex: 1, alignItems: "center", justifyContent: "center" },
  gridCardCanvas: { flex: 1 },
  gridCardFooter: { paddingHorizontal: 6, paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#1e2637" },
  gridCardTitle: { color: "#f5f6fb", fontFamily: FACES.BOLD, fontSize: 10 },
  gridCardMeta: { color: "#9aa6bf", fontSize: 9 },
  gridCountBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "#2b3a55",
  },
  gridCountText: { color: "#fff", fontSize: 9, fontFamily: FACES.BOLD },
  gridCostBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "#2b3a55",
  },
  gridCostText: { color: "#fff", fontSize: 9, fontFamily: FACES.BOLD },
  cardModalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  cardModal: { width: SCREEN_WIDTH - 60, backgroundColor: "#0b0d16", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1f2738", gap: 8 },
  cardModalArt: { alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  cardModalCanvas: { width: 180, height: 180 },
  cardModalTitle: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 16 },
  cardModalMeta: { color: "#9aa1b5", fontFamily: FACES.REGULAR, fontSize: 12 },
  cardModalDesc: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 12 },
})
