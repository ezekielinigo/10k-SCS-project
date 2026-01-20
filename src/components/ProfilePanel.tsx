import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, ScrollView } from "react-native"
import { Feather } from "@expo/vector-icons"
import fontConfig from "@shared/utils/fontConfig"
import { RARITY_COLORS } from "@shared/utils/ui"
import iconDefault from "../assets/icon_default.png"
import { useGame } from "@shared/game/engine/GameContext"
import { listOwnerInventory } from "@shared/game/services/inventoryService"
import { canEquip } from "@shared/game/services/equipmentService"
import type { CyberSlot, EquipmentSlot, ItemTemplate, WeaponSlot } from "@shared/game/types"
import { Canvas, Image as SkiaImage, FilterMode, MipmapMode, useImage } from "@shopify/react-native-skia"

const FACES = fontConfig.fontFaceNames()
const CELL_SIZE = 48
const MOVE_THRESHOLD = 6
const EQUIP_SLOTS = ["accessory", "top", "bottom", "primary", "secondary", "utility", "trash"]
const EQUIP_OFFSET = 100
const CYBER_SLOTS = ["neural", "ocular", "skeletal", "dermal", "systems", "external", "trash"]
const CYBER_OFFSET = 200
const INVENTORY_ROWS = 6
const INVENTORY_COLS = 7
const INVENTORY_OFFSET = 0
const MAX_GRID_SLOTS = INVENTORY_ROWS * INVENTORY_COLS
const ITEM_ICON_SIZE = CELL_SIZE - 18
const SELECTION_ICON_SIZE = 50

type ItemState = {
  id: string
  slot: number
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

export default function ProfilePanel() {
  const { state, dispatch } = useGame()
  const playerId = state.player.id
  const inventory = useMemo(() => listOwnerInventory(state, playerId), [state, playerId])
  const templateByInstance = useMemo(() => {
    const map = new Map<string, ItemTemplate>()
    // prefer inventory entries (they include resolved templates)
    inventory.forEach(({ instance, template }) => {
      map.set(instance.id, template)
    })
    // fallback to itemInstances -> itemTemplates if an entry/template was temporarily removed
    Object.values(state.itemInstances ?? {}).forEach((inst) => {
      if (inst.ownerId !== playerId) return
      if (map.has(inst.id)) return
      const tpl = state.itemTemplates?.[inst.templateId]
      if (tpl) map.set(inst.id, tpl)
    })
    return map
  }, [inventory, state.itemInstances, state.itemTemplates, playerId])

  const [items, setItems] = useState<ItemState[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"equipment" | "cyberware" | "deck">("equipment")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dragOriginSlot = useRef<number | null>(null)
  const hoveredSlotRef = useRef<number | null>(null)
  const movedRef = useRef(false)
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const containerRef = useRef<View | null>(null)
  const equipRef = useRef<View | null>(null)
  const gridRef = useRef<View | null>(null)
  const [containerLayout, setContainerLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [equipLayout, setEquipLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [gridLayout, setGridLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [selectionIconLayout, setSelectionIconLayout] = useState<{ width: number; height: number } | null>(null)

  const equipIndexForSlotId = (slotId: EquipmentSlot | WeaponSlot): number => EQUIP_OFFSET + EQUIP_SLOTS.findIndex(s => s === slotId)
  const cyberIndexForSlotId = (slotId: CyberSlot): number => CYBER_OFFSET + CYBER_SLOTS.findIndex(s => s.toLowerCase() === slotId)

  const equipTrashSlotIndex = useMemo(() => equipIndexForSlotId("trash"), [])

  const itemIconSkia = useImage(iconDefault)

  const slotItemMap = useMemo(() => {
    const map = new Map<number, ItemState>()
    items.forEach(item => {
      map.set(item.slot, item)
    })
    return map
  }, [items])

  const selectionIconOffset = useMemo(() => {
    if (!selectionIconLayout) return { x: 0, y: 0 }
    const x = Math.max((selectionIconLayout.width - SELECTION_ICON_SIZE) / 2, 0)
    const y = Math.max((selectionIconLayout.height - SELECTION_ICON_SIZE) / 2, 0)
    return { x, y }
  }, [selectionIconLayout])

  const scaleMapRef = useRef(new Map<string, Animated.Value>())
  const ensureScaleForId = useCallback(
    (id: string): Animated.Value => {
      const existing = scaleMapRef.current.get(id)
      if (existing) return existing
      const val = new Animated.Value(selectedId === id ? 1.2 : 1)
      scaleMapRef.current.set(id, val)
      return val
    },
    [selectedId],
  )

  const slotInfoFromIndex = (slot: number): { kind: "equip" | "weapon" | "cyber" | "grid"; slotId?: EquipmentSlot | WeaponSlot | CyberSlot } => {
    if (slot >= EQUIP_OFFSET && slot < EQUIP_OFFSET + EQUIP_SLOTS.length) {
      const name = EQUIP_SLOTS[slot - EQUIP_OFFSET]
      if (name === "primary" || name === "secondary") {
        return { kind: "weapon", slotId: name as WeaponSlot }
      }
      return { kind: "equip", slotId: name as EquipmentSlot }
    }
    if (slot >= CYBER_OFFSET && slot < CYBER_OFFSET + CYBER_SLOTS.length) {
        const name = CYBER_SLOTS[slot - CYBER_OFFSET].toLowerCase()
        // treat 'trash' in the cyber row as the same equipment trash slot
        if (name === "trash") return { kind: "equip", slotId: "trash" as EquipmentSlot }
        return { kind: "cyber", slotId: name as CyberSlot }
    }
    return { kind: "grid" }
  }

  // rebuild visual slots from game state while preserving grid positions when possible
  useEffect(() => {
    const equipped = new Set<string>()
    const occupiedSlots = new Set<number>()
    const nextItems: ItemState[] = []

    const loadout = state.loadout ?? { equipment: {}, weapons: {}, cyber: {} }

    // equipment slots
    Object.entries(loadout.equipment ?? {}).forEach(([slotId, instanceId]) => {
      if (!instanceId) return
      const slotIdx = equipIndexForSlotId(slotId as EquipmentSlot)
      nextItems.push({ id: instanceId, slot: slotIdx })
      equipped.add(instanceId)
      occupiedSlots.add(slotIdx)
    })

    // weapon slots
    Object.entries(loadout.weapons ?? {}).forEach(([slotId, instanceId]) => {
      if (!instanceId) return
      const slotIdx = equipIndexForSlotId(slotId as WeaponSlot)
      nextItems.push({ id: instanceId, slot: slotIdx })
      equipped.add(instanceId)
      occupiedSlots.add(slotIdx)
    })

    // cyber slots
    Object.entries(loadout.cyber ?? {}).forEach(([slotId, instanceId]) => {
      if (!instanceId) return
      const slotIdx = cyberIndexForSlotId(slotId as CyberSlot)
      nextItems.push({ id: instanceId, slot: slotIdx })
      equipped.add(instanceId)
      occupiedSlots.add(slotIdx)
    })

    // assign grid positions for unequipped items
    const prevMap = new Map(items.map(i => [i.id, i.slot]))
    const findNextFree = () => {
      for (let i = 0; i < MAX_GRID_SLOTS; i++) {
        if (!occupiedSlots.has(INVENTORY_OFFSET + i)) {
          occupiedSlots.add(INVENTORY_OFFSET + i)
          return INVENTORY_OFFSET + i
        }
      }
      return INVENTORY_OFFSET
    }

    inventory.forEach(({ instance }) => {
      if (equipped.has(instance.id)) return
      const prevSlot = prevMap.get(instance.id)
      const usePrev = prevSlot !== undefined && prevSlot < EQUIP_OFFSET && !occupiedSlots.has(prevSlot)
      const slot = usePrev ? prevSlot! : findNextFree()
      nextItems.push({ id: instance.id, slot })
    })

    setItems(nextItems)
  }, [inventory, state.loadout])

  const slotCoordinates = useCallback(
    (slot: number) => {
      if (slot >= EQUIP_OFFSET && slot < EQUIP_OFFSET + EQUIP_SLOTS.length) {
        const idx = slot - EQUIP_OFFSET
        if (equipLayout && containerLayout) {
          const slotWidth = equipLayout.width / EQUIP_SLOTS.length
          const x = equipLayout.x - containerLayout.x + idx * slotWidth + (slotWidth - CELL_SIZE) / 2
          const y = equipLayout.y - containerLayout.y + (equipLayout.height - CELL_SIZE) / 2
          return { x, y }
        }
      } else if (slot >= CYBER_OFFSET && slot < CYBER_OFFSET + CYBER_SLOTS.length) {
        const idx = slot - CYBER_OFFSET
        if (equipLayout && containerLayout) {
          const slotWidth = equipLayout.width / CYBER_SLOTS.length
          const x = equipLayout.x - containerLayout.x + idx * slotWidth + (slotWidth - CELL_SIZE) / 2
          const y = equipLayout.y - containerLayout.y + (equipLayout.height - CELL_SIZE) / 2
          return { x, y }
        }
      } else {
        // inventory slot
        const idx = slot - INVENTORY_OFFSET
        if (gridLayout && containerLayout) {
          const cellWidth = gridLayout.width / INVENTORY_COLS
          const cellHeight = gridLayout.height / INVENTORY_ROWS
          const col = idx % INVENTORY_COLS
          const row = Math.floor(idx / INVENTORY_COLS)
          const x = gridLayout.x - containerLayout.x + col * cellWidth + (cellWidth - CELL_SIZE) / 2
          const y = gridLayout.y - containerLayout.y + row * cellHeight + (cellHeight - CELL_SIZE) / 2
          return { x, y }
        }
      }
      return { x: 0, y: 0 }
    },
    [containerLayout, equipLayout, gridLayout],
  )

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

  // keep selection in sync with inventory changes; default to first item
  useEffect(() => {
    if (selectedId && items.some(i => i.id === selectedId)) return
    const first = items[0]?.id ?? null
    setSelectedId(first)
  }, [items, selectedId])

  // animate selection scale changes
  const prevSelectedRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevSelectedRef.current
    if (prev && prev !== selectedId) {
      const prevScale = ensureScaleForId(prev)
      Animated.timing(prevScale, { toValue: 1, duration: 140, useNativeDriver: true }).start()
    }
    if (selectedId) {
      const nextScale = ensureScaleForId(selectedId)
      Animated.timing(nextScale, { toValue: 1.2, duration: 140, useNativeDriver: true }).start()
    }
    prevSelectedRef.current = selectedId ?? null
  }, [ensureScaleForId, selectedId])

  const finishDrag = useCallback(
    (gesture: { dx: number; dy: number }) => {
      if (!draggingId || dragOriginSlot.current === null) {
        pan.setValue({ x: 0, y: 0 })
        setDraggingId(null)
        dragOriginSlot.current = null
        hoveredSlotRef.current = null
        movedRef.current = false
        return
      }

      const originSlot = dragOriginSlot.current
      const hovered = hoveredSlotRef.current
      const targetSlot = hovered !== null ? hovered : originSlot

      const originInfo = slotInfoFromIndex(originSlot)
      const targetInfo = slotInfoFromIndex(targetSlot)

      // compute a canonical numeric slot for the target so cyber 'trash' maps
      // to the equipment trash canonical index rather than the cyber offset index
      let canonicalTargetSlot = targetSlot
      if (targetInfo.slotId) {
        if (targetInfo.kind === "equip" || targetInfo.kind === "weapon") {
          canonicalTargetSlot = equipIndexForSlotId(targetInfo.slotId as EquipmentSlot)
        } else if (targetInfo.kind === "cyber") {
          canonicalTargetSlot = cyberIndexForSlotId(targetInfo.slotId as CyberSlot)
        }
      }

      const doSwapLocally = () => {
        setItems(prevItems => {
          const occupant = prevItems.find(item => item.slot === canonicalTargetSlot)
          if (occupant) {
            return prevItems.map(item => {
              if (item.id === draggingId) return { ...item, slot: canonicalTargetSlot }
              if (item.id === occupant.id) return { ...item, slot: originSlot! }
              return item
            })
          }
          return prevItems.map(item => (item.id === draggingId ? { ...item, slot: canonicalTargetSlot } : item))
        })
      }

      // Grid drop: if dragged from equip/cyber/weapon, unequip that slot
      if (targetInfo.kind === "grid") {
        if (originInfo.kind !== "grid" && originInfo.slotId && originInfo.slotId !== "trash") {
          dispatch({ type: "UNEQUIP_SLOT", slot: originInfo.slotId })
        }
        doSwapLocally()
      } else {
        // Equip attempt (including trash)
        const slotId = targetInfo.slotId as any
        if (slotId) {
          // special-case trash: accept any item and remove previous occupant permanently
          if (slotId === "trash") {
            // equip into trash; equipmentService will remove previous occupant and
            // ensure the instance is removed permanently. Rely on the reducer
            // to update state, then perform the local swap for immediate feedback.
            dispatch({ type: "EQUIP_ITEM", instanceId: draggingId, slot: "trash" })
            doSwapLocally()
          } else {
            const validation = canEquip(state, draggingId, slotId)
            if (!validation.ok) {
              // invalid drop; revert
              hoveredSlotRef.current = null
              dragOriginSlot.current = null
              setDraggingId(null)
              pan.setValue({ x: 0, y: 0 })
              movedRef.current = false
              return
            }
            dispatch({ type: "EQUIP_ITEM", instanceId: draggingId, slot: slotId })
            doSwapLocally()
          }
        }
      }

      // clear dragging state on the next frame to avoid snap-back while keeping latency minimal
      requestAnimationFrame(() => {
        dragOriginSlot.current = null
        hoveredSlotRef.current = null
        setDraggingId(null)
        pan.setValue({ x: 0, y: 0 })
        movedRef.current = false
      })
    },
    [dispatch, draggingId, pan, slotInfoFromIndex, state],
  )

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => draggingId !== null,
        onPanResponderMove: (_, gestureState) => {
          if (!draggingId) return
          const dx = gestureState.dx
          const dy = gestureState.dy
          pan.setValue({ x: dx, y: dy })
          // ignore tiny jitters until movement exceeds threshold
          if (!movedRef.current) {
            if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
              movedRef.current = true
            } else {
              return
            }
          }
          // use global touch coordinates to determine hovered equip slot or inventory cell
          const { moveX, moveY } = gestureState
          // if deck tab is active, treat equip area as non-interactive for equip-hover
          if (activeTab !== "deck" && equipLayout && moveX >= equipLayout.x && moveX <= equipLayout.x + equipLayout.width && moveY >= equipLayout.y && moveY <= equipLayout.y + equipLayout.height) {
            const relX = moveX - equipLayout.x
            const visibleSlots = activeTab === "equipment" ? EQUIP_SLOTS : CYBER_SLOTS
            const visibleOffset = activeTab === "equipment" ? EQUIP_OFFSET : CYBER_OFFSET
            const slotWidth = equipLayout.width / visibleSlots.length
            const idx = clamp(Math.floor(relX / slotWidth), 0, visibleSlots.length - 1)
            const slot = visibleOffset + idx
            hoveredSlotRef.current = slot
            return
          }

          if (gridLayout && moveX >= gridLayout.x && moveX <= gridLayout.x + gridLayout.width && moveY >= gridLayout.y && moveY <= gridLayout.y + gridLayout.height) {
            const relX = moveX - gridLayout.x
            const relY = moveY - gridLayout.y
            const cellWidth = gridLayout.width / INVENTORY_COLS
            const cellHeight = gridLayout.height / INVENTORY_ROWS
            const col = clamp(Math.floor(relX / cellWidth), 0, INVENTORY_COLS - 1)
            const row = clamp(Math.floor(relY / cellHeight), 0, INVENTORY_ROWS - 1)
            const slot = INVENTORY_OFFSET + row * INVENTORY_COLS + col
            hoveredSlotRef.current = slot
            return
          }
        },
        onPanResponderRelease: (_, gestureState) => finishDrag(gestureState),
        onPanResponderTerminate: (_, gestureState) => finishDrag(gestureState),
        onPanResponderGrant: () => {
          pan.setOffset({ x: 0, y: 0 })
        },
      }),
    [activeTab, draggingId, equipLayout, finishDrag, gridLayout, pan],
  )

  const handleLongPress = useCallback(
    (item: ItemState) => {
      // select and immediately enable dragging to keep finger and icon aligned
      setSelectedId(item.id)
      dragOriginSlot.current = item.slot
      hoveredSlotRef.current = item.slot
      movedRef.current = false
      setDraggingId(item.id)
      pan.setValue({ x: 0, y: 0 })
    },
    [pan],
  )

  const deckCards = useMemo(() => {
    return [...new Set(state.derivedLoadout?.equippedCards ?? [])]
  }, [state.derivedLoadout])

  const selectedTemplate = useMemo(() => {
    if (!selectedId) return null
    const inst = state.itemInstances?.[selectedId]
    if (!inst) return null
    return state.itemTemplates?.[inst.templateId] ?? null
  }, [selectedId, state.itemInstances, state.itemTemplates])

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

  const selectionBorderColor = selectedMeta?.rarity ? RARITY_COLORS[selectedMeta.rarity as any] ?? styles.selectionPanel.borderColor : styles.selectionPanel.borderColor

  

  if (activeTab === "deck") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Deck</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {deckCards.length === 0 && <Text style={styles.empty}>No cards in your deck.</Text>}
          {deckCards.map((c) => (
            <View key={c} style={styles.card}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text numberOfLines={1} style={styles.cardTitle}>{c}</Text>
                <Text style={styles.cardBody}>{""}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.toggleRow}>
          <Pressable onPress={() => setActiveTab("equipment")} style={[styles.toggleButton, activeTab === "equipment" ? styles.toggleActive : null, { marginRight: 8 }]}> 
            <Text style={[styles.toggleText, activeTab === "equipment" ? styles.toggleTextActive : null]}>Equipment</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("cyberware")} style={[styles.toggleButton, activeTab === "cyberware" ? styles.toggleActive : null, { marginRight: 8 }]}> 
            <Text style={[styles.toggleText, activeTab === "cyberware" ? styles.toggleTextActive : null]}>Cybernetics</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("deck")} style={[styles.toggleButton, activeTab === "deck" ? styles.toggleActive : null]}>
            <Text style={[styles.toggleText, activeTab === "deck" ? styles.toggleTextActive : null]}>Deck</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View
      ref={containerRef}
      onLayout={() => containerRef.current?.measureInWindow((x, y, width, height) => setContainerLayout({ x, y, width, height }))}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={[styles.selectionPanel, { borderColor: selectionBorderColor }]}>
          <View style={styles.selectionSideColumn}>
            <View
              style={styles.selectionIconWrap}
              onLayout={(event) => setSelectionIconLayout({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
            >
              <Canvas style={styles.selectionIconCanvas}>
                {itemIconSkia ? (
                  <SkiaImage
                    image={itemIconSkia}
                    x={selectionIconOffset.x}
                    y={selectionIconOffset.y}
                    width={SELECTION_ICON_SIZE}
                    height={SELECTION_ICON_SIZE}
                    fit="contain"
                    sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                  />
                ) : null}
              </Canvas>
            </View>
            <View style={styles.selectionButtonColumn}>
              <Pressable style={styles.selectionButton} android_ripple={{ color: "#1f2a3f" }}>
                <Feather name="align-center" size={16} color="#cfe1ff" />
              </Pressable>
              <Pressable style={styles.selectionButton} android_ripple={{ color: "#1f2a3f" }}>
                <Feather name="bar-chart-2" size={16} color="#cfe1ff" />
              </Pressable>
            </View>
          </View>
          <View style={styles.selectionTextWrap}>
            <Text style={styles.selectionTitle} numberOfLines={1}>{selectedMeta?.name ?? "Loading items..."}</Text>
            <Text style={styles.selectionMeta} numberOfLines={1}>{selectedMeta?.kind ?? ""}</Text>
            {selectedTemplate?.description ? <Text style={styles.selectionDesc} numberOfLines={3}>{selectedTemplate.description}</Text> : null}
            {selectedTemplate?.effects && selectedTemplate.effects.length > 0 ? (
              <Text style={styles.selectionEffects} numberOfLines={2}>{selectedTemplate.effects.map(e => e.tag ?? e.kind ?? "effect").join(", ")}</Text>
            ) : null}
          </View>
        </View>
        <View
          style={styles.gridContainer}
          ref={gridRef}
          onLayout={() => gridRef.current?.measureInWindow((x, y, width, height) => setGridLayout({ x, y, width, height }))}
        >
        {Array.from({ length: INVENTORY_ROWS }).map((_, r) => (
          <View key={r} style={styles.gridRow}>
            {Array.from({ length: INVENTORY_COLS }).map((__, c) => {
              const slotIndex = INVENTORY_OFFSET + r * INVENTORY_COLS + c
              const occupant = slotItemMap.get(slotIndex)
              const isDragging = occupant && occupant.id === draggingId
              return (
                <View key={c} style={styles.equipSlotWrap}>
                  <View style={styles.equipSlot}>
                    {occupant ? (
                      (() => {
                        const tpl = templateByInstance.get(occupant.id)
                        const borderColor = tpl?.rarity ? RARITY_COLORS[tpl.rarity as any] ?? undefined : undefined
                        return (
                          <Animated.View
                            style={[
                              styles.item,
                              { borderColor: borderColor ?? styles.item.borderColor },
                              isDragging ? styles.dragging : null,
                              {
                                transform: [
                                  ...(isDragging ? [{ translateX: pan.x }, { translateY: pan.y }] : []),
                                  { scale: ensureScaleForId(occupant.id) },
                                ],
                              },
                            ]}
                            {...(isDragging ? panResponder.panHandlers : {})}
                          >
                            <Pressable onPress={() => setSelectedId(occupant.id)} onLongPress={() => handleLongPress(occupant)} delayLongPress={200} android_ripple={false}>
                              <Canvas style={styles.iconCanvas}>
                                {itemIconSkia ? (
                                  <SkiaImage
                                    image={itemIconSkia}
                                    x={0}
                                    y={0}
                                    width={ITEM_ICON_SIZE}
                                    height={ITEM_ICON_SIZE}
                                    fit="contain"
                                    sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                                  />
                                ) : null}
                              </Canvas>
                            </Pressable>
                          </Animated.View>
                        )
                      })()
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        ))}
      </View>
        {activeTab === "deck" ? (
          <View
            style={styles.deckContainer}
            ref={equipRef}
            onLayout={() => equipRef.current?.measureInWindow((x, y, width, height) => setEquipLayout({ x, y, width, height }))}
          >
            <Text style={styles.deckTitle}>Deck ({deckCards.length})</Text>
            <View style={styles.deckList}>
              {deckCards.length === 0 ? <Text style={styles.deckEmpty}>No cards</Text> : deckCards.map((c) => (
                <View key={c} style={styles.cardBox}>
                  <Text style={styles.cardText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View
            style={styles.equipRow}
            ref={equipRef}
            onLayout={() => equipRef.current?.measureInWindow((x, y, width, height) => setEquipLayout({ x, y, width, height }))}
          >
          {(() => {
            const visibleSlots = activeTab === "equipment" ? EQUIP_SLOTS : CYBER_SLOTS
            const visibleOffset = activeTab === "equipment" ? EQUIP_OFFSET : CYBER_OFFSET
            return visibleSlots.map((label, i) => {
              const slotIndex = visibleOffset + i
              // default occupant from items (grid/equip canonical mapping)
              let occupant = slotItemMap.get(slotIndex)
              // mirror equipment.trash into the cyber 'trash' visual so both sides show same item
              // use the canonical equipment slot for the underlying item, but keep slotIndex
              // for tooltip positioning and visual layout
              if (label === "trash" && activeTab === "cyberware") {
                const found = slotItemMap.get(equipTrashSlotIndex)
                if (found) occupant = found
              }
              const isDragging = occupant && occupant.id === draggingId
              return (
                <View key={label} style={styles.equipSlotWrap}>
                  <Text style={styles.equipLabel}>{label.toUpperCase()}</Text>
                  <View style={[styles.equipSlot, label === "trash" ? styles.trashSlot : null]}>
                    {occupant ? (
                      (() => {
                        const tpl = templateByInstance.get(occupant.id)
                        const borderColor = tpl?.rarity ? RARITY_COLORS[tpl.rarity as any] ?? undefined : undefined
                        return (
                          <Animated.View
                            style={[
                              styles.item,
                              { borderColor: borderColor ?? (styles.item as any).borderColor },
                              isDragging ? styles.dragging : null,
                              {
                                transform: [
                                  ...(isDragging ? [{ translateX: pan.x }, { translateY: pan.y }] : []),
                                  { scale: ensureScaleForId(occupant.id) },
                                ],
                              },
                            ]}
                            {...(isDragging ? panResponder.panHandlers : {})}
                          >
                            <Pressable onPress={() => setSelectedId(occupant.id)} onLongPress={() => handleLongPress({ id: occupant.id, slot: label === "trash" && activeTab === "cyberware" ? equipTrashSlotIndex : occupant.slot })} delayLongPress={200} android_ripple={false}>
                              <Canvas style={styles.iconCanvas}>
                                {itemIconSkia ? (
                                  <SkiaImage
                                    image={itemIconSkia}
                                    x={0}
                                    y={0}
                                    width={ITEM_ICON_SIZE}
                                    height={ITEM_ICON_SIZE}
                                    fit="contain"
                                    sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                                  />
                                ) : null}
                              </Canvas>
                            </Pressable>
                          </Animated.View>
                        )
                      })()
                    ) : (
                      label === "trash" ? (
                        <View style={styles.trashEmptySlot}>
                          <Feather name="trash" size={20} color="#ff6b6b" />
                        </View>
                      ) : (
                        <Text></Text>
                      )
                    )}
                  </View>
                </View>
              )
            })
          })()}
          </View>
        )}
      </View>

      <View style={styles.toggleRow}>
        <Pressable onPress={() => setActiveTab("equipment")} style={[styles.toggleButton, activeTab === "equipment" ? styles.toggleActive : null, { marginRight: 8 }]}> 
          <Text style={[styles.toggleText, activeTab === "equipment" ? styles.toggleTextActive : null]}>Equipment</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("cyberware")} style={[styles.toggleButton, activeTab === "cyberware" ? styles.toggleActive : null, { marginRight: 8 }]}>
          <Text style={[styles.toggleText, activeTab === "cyberware" ? styles.toggleTextActive : null]}>Cybernetics</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("deck")} style={[styles.toggleButton, activeTab === "deck" ? styles.toggleActive : null]}>
          <Text style={[styles.toggleText, activeTab === "deck" ? styles.toggleTextActive : null]}>Deck</Text>
        </Pressable>
      </View>
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
  title: { color: "#f5f6fb", fontFamily: FACES.BOLD, fontSize: 16, marginBottom: 6 },
  subhead: { color: "#a9b1c5", fontFamily: FACES.BOLD, fontSize: 13, marginBottom: 10 },
  
  item: {
    width: CELL_SIZE - 10,
    height: CELL_SIZE - 10,
    borderRadius: 6,
    backgroundColor: "#161e30",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#222c43",
  },
  dragging: {
    position: "absolute",
    zIndex: 10,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  iconCanvas: {
    width: ITEM_ICON_SIZE,
    height: ITEM_ICON_SIZE,
  },
  placeholder: {
    position: "absolute",
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2d3950",
    backgroundColor: "rgba(45,57,80,0.2)",
  },
  tooltip: {
    position: "absolute",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1f2a3f",
    borderWidth: 1,
    borderColor: "#2f3b55",
  },
  tooltipText: {
    color: "#f5f6fb",
    fontFamily: FACES.BOLD,
    fontSize: 12,
  },
  tooltipMeta: {
    color: "#c6cedd",
    fontFamily: FACES.MEDIUM,
    fontSize: 11,
    marginTop: 2,
  },
  equipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  equipSlotWrap: {
    alignItems: "center",
    width: CELL_SIZE,
  },
  equipSlot: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e2637",
    backgroundColor: "#0f1722",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  equipLabel: {
    color: "#9aa6bf",
    fontSize: 6,
    textTransform: "capitalize",
    marginBottom: 4,
  },
  equipLabelShort: { color: "#cfe1ff", fontSize: 14, fontFamily: FACES.BOLD },
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
  gridContainer: {
    marginTop: 8,
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
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
    marginBottom: 3,
    height: "25%",
    width: "100%",
  },
  selectionSideColumn: {
    flexDirection: "column",
    alignItems: "center",
    marginRight: 10,
    gap: 6,
  },
  selectionIconWrap: {
    width: "100%",
    height: "60%",
    borderRadius: 8,
    backgroundColor: "#161e30",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionIconCanvas: {
    width: "100%",
    height: "100%",
    alignContent: "center",
    justifyContent: "center",
  },
  selectionTextWrap: { flex: 1, justifyContent: "flex-start", gap: 4 },
  selectionTitle: { color: "#f5f6fb", fontFamily: FACES.BOLD, fontSize: 14 },
  selectionMeta: { color: "#9aa6bf", fontFamily: FACES.MEDIUM, fontSize: 11 },
  selectionDesc: { color: "#c6cedd", fontSize: 11, lineHeight: 16, flexShrink: 1 },
  selectionEffects: { color: "#8eb6ff", fontSize: 11 },
  selectionButtonColumn: {
    flexDirection: "row",
    gap: 6,
  },
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
  deckContainer: {
    marginTop: 8,
    paddingVertical: 8,
  },
  deckTitle: { color: "#cfe1ff", fontFamily: FACES.BOLD, fontSize: 12, marginBottom: 6 },
  deckList: { flexDirection: "row", flexWrap: "wrap" },
  deckEmpty: { color: "#a9b1c5" },
  cardBox: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#253146",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  cardText: { color: "#dbe9ff", fontSize: 11 },
  trashSlot: {
    borderColor: "#ff4d4d",
    backgroundColor: "#2d0b0b",
  },
  trashEmptySlot: {
    alignItems: "center",
    justifyContent: "center",
    width: CELL_SIZE - 10,
    height: CELL_SIZE - 10,
  },
  list: { gap: 10 },
  empty: { color: "#8e93a8" },
  card: {
    borderWidth: 1,
    borderColor: "#252b3c",
    borderRadius: 10,
    padding: 6,
    backgroundColor: "#111624",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  cardExpanded: { backgroundColor: "#151c2c", borderColor: "#2f3a52" },
  cardResolved: { opacity: 0.6 },
  cardTitle: { color: "#f2f3f7", fontFamily: FACES.BOLD, marginBottom: 2, fontSize: 12 },
  cardBody: { color: "#c9cdd8", fontSize: 13, lineHeight: 18 },
  listContent: { paddingBottom: 12 },
  
})
