import React, { useCallback, useMemo, useRef, useState } from "react"
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from "react-native"
import fontConfig from "@shared/utils/fontConfig"
import iconDefault from "../assets/icon_default.png"

const FACES = fontConfig.fontFaceNames()
const CELL_SIZE = 56
const MOVE_THRESHOLD = 6
const EQUIP_SLOTS = ["accessory", "top", "bottom", "primary", "secondary", "utility"]
const EQUIP_OFFSET = 100
const CYBER_SLOTS = ["NEURAL", "OCULAR", "SKELETAL", "DERMAL", "SYSTEMS", "EXTERNAL"]
const CYBER_OFFSET = 200
const INVENTORY_ROWS = 6
const INVENTORY_COLS = 6
const INVENTORY_OFFSET = 0

type ItemState = {
  id: string
  slot: number
}

const INITIAL_ITEMS: ItemState[] = [
  { id: "item-1", slot: EQUIP_OFFSET + 0 },
  { id: "item-2", slot: EQUIP_OFFSET + 1 },
]

export default function ProfilePanel() {
  const [items, setItems] = useState<ItemState[]>(INITIAL_ITEMS)
  const [tooltip, setTooltip] = useState<{ id: string; slot: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"equipment" | "cyberware">("equipment")
  const dragOriginSlot = useRef<number | null>(null)
  const hoveredSlotRef = useRef<number | null>(null)
  const movedRef = useRef(false)
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const scale = useRef(new Animated.Value(1)).current
  const containerRef = useRef<View | null>(null)
  const equipRef = useRef<View | null>(null)
  const gridRef = useRef<View | null>(null)
  const [containerLayout, setContainerLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [equipLayout, setEquipLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [gridLayout, setGridLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

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

  const finishDrag = useCallback(
    (gesture: { dx: number; dy: number }) => {
      if (!draggingId || dragOriginSlot.current === null) {
        pan.setValue({ x: 0, y: 0 })
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start(() => {
          setDraggingId(null)
          dragOriginSlot.current = null
          setHoveredSlot(null)
          hoveredSlotRef.current = null
          movedRef.current = false
        })
        return
      }

      const originSlot = dragOriginSlot.current
      const hovered = hoveredSlotRef.current
      const targetSlot = hovered !== null ? hovered : originSlot

      if (targetSlot === null) {
        // nothing to do
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start(() => {
          dragOriginSlot.current = null
          setHoveredSlot(null)
          hoveredSlotRef.current = null
          setDraggingId(null)
          pan.setValue({ x: 0, y: 0 })
          movedRef.current = false
        })
        return
      }

      setItems(prevItems => {
        const occupant = prevItems.find(item => item.slot === targetSlot)
        if (occupant) {
          // swap between dragging item and occupant
          return prevItems.map(item => {
            if (item.id === draggingId) return { ...item, slot: targetSlot }
            if (item.id === occupant.id) return { ...item, slot: originSlot! }
            return item
          })
        }
        return prevItems.map(item => (item.id === draggingId ? { ...item, slot: targetSlot } : item))
      })

      // ensure pan resets after the slot update has applied to avoid a brief snap to origin
      requestAnimationFrame(() => {
        pan.setValue({ x: 0, y: 0 })
      })

      // animate scale back to normal then clear drag state
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start(() => {
        dragOriginSlot.current = null
        setHoveredSlot(null)
        hoveredSlotRef.current = null
        setDraggingId(null)
        pan.setValue({ x: 0, y: 0 })
        movedRef.current = false
      })
    },
    [draggingId, pan, scale],
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
          if (equipLayout && moveX >= equipLayout.x && moveX <= equipLayout.x + equipLayout.width && moveY >= equipLayout.y && moveY <= equipLayout.y + equipLayout.height) {
            const relX = moveX - equipLayout.x
            const visibleSlots = activeTab === "equipment" ? EQUIP_SLOTS : CYBER_SLOTS
            const visibleOffset = activeTab === "equipment" ? EQUIP_OFFSET : CYBER_OFFSET
            const slotWidth = equipLayout.width / visibleSlots.length
            const idx = clamp(Math.floor(relX / slotWidth), 0, visibleSlots.length - 1)
            const slot = visibleOffset + idx
            setHoveredSlot(slot)
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
            setHoveredSlot(slot)
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
    [draggingId, finishDrag, pan, slotCoordinates],
  )

  const handleLongPress = useCallback(
    (item: ItemState) => {
      setTooltip(null)
      dragOriginSlot.current = item.slot
      setHoveredSlot(item.slot)
      hoveredSlotRef.current = item.slot
      movedRef.current = false
      setDraggingId(item.id)
      pan.setValue({ x: 0, y: 0 })
      Animated.timing(scale, { toValue: 1.2, duration: 120, useNativeDriver: true }).start()
    },
    [pan, scale],
  )

  

  return (
    <View
      ref={containerRef}
      onLayout={() => containerRef.current?.measureInWindow((x, y, width, height) => setContainerLayout({ x, y, width, height }))}
      style={styles.container}
    >
      <Text style={styles.title}>Profile</Text>
      <View
        style={styles.gridContainer}
        ref={gridRef}
        onLayout={() => gridRef.current?.measureInWindow((x, y, width, height) => setGridLayout({ x, y, width, height }))}
      >
        {Array.from({ length: INVENTORY_ROWS }).map((_, r) => (
          <View key={r} style={styles.gridRow}>
            {Array.from({ length: INVENTORY_COLS }).map((__, c) => {
              const slotIndex = INVENTORY_OFFSET + r * INVENTORY_COLS + c
              const occupant = items.find(it => it.slot === slotIndex)
              const isDragging = occupant && occupant.id === draggingId
              return (
                <View key={c} style={styles.equipSlotWrap}>
                  <View style={styles.equipSlot}>
                    {occupant ? (
                      <Animated.View
                        style={[
                          styles.item,
                          isDragging ? styles.dragging : null,
                          isDragging ? { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }] } : null,
                        ]}
                        {...(isDragging ? panResponder.panHandlers : {})}
                      >
                        <Pressable onPress={() => setTooltip({ id: occupant.id, slot: slotIndex })} onLongPress={() => handleLongPress(occupant)} delayLongPress={200} android_ripple={false}>
                          <Image source={iconDefault} style={styles.icon} />
                        </Pressable>
                      </Animated.View>
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        ))}
      </View>

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
            const occupant = items.find(it => it.slot === slotIndex)
            const isDragging = occupant && occupant.id === draggingId
            return (
              <View key={label} style={styles.equipSlotWrap}>
                <Text style={styles.equipLabel}>{label.toUpperCase()}</Text>
                <View style={styles.equipSlot}>
                  {occupant ? (
                    <Animated.View
                      style={[
                        styles.item,
                        isDragging ? styles.dragging : null,
                        isDragging ? { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }] } : null,
                      ]}
                      {...(isDragging ? panResponder.panHandlers : {})}
                    >
                      <Pressable onPress={() => setTooltip({ id: occupant.id, slot: slotIndex })} onLongPress={() => handleLongPress(occupant)} delayLongPress={200} android_ripple={false}>
                        <Image source={iconDefault} style={styles.icon} />
                      </Pressable>
                    </Animated.View>
                  ) : (
                    <Text></Text>
                  )}
                </View>
              </View>
            )
          })
        })()}
      </View>

      <View style={styles.toggleRow}>
        <Pressable onPress={() => setActiveTab("equipment")} style={[styles.toggleButton, activeTab === "equipment" ? styles.toggleActive : null, { marginRight: 8 }]}> 
          <Text style={[styles.toggleText, activeTab === "equipment" ? styles.toggleTextActive : null]}>Equipment</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("cyberware")} style={[styles.toggleButton, activeTab === "cyberware" ? styles.toggleActive : null]}>
          <Text style={[styles.toggleText, activeTab === "cyberware" ? styles.toggleTextActive : null]}>Cybernetics</Text>
        </Pressable>
      </View>

      {tooltip ? (
        <Pressable onPress={() => setTooltip(null)} style={[styles.tooltip, { position: "absolute", top: slotCoordinates(tooltip.slot).y - 10, left: slotCoordinates(tooltip.slot).x + (CELL_SIZE / 2) - 44 }]}>
          <Text style={styles.tooltipText}>{tooltip.id}</Text>
        </Pressable>
      ) : null}
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
  icon: {
    width: CELL_SIZE - 18,
    height: CELL_SIZE - 18,
    resizeMode: "contain",
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
    marginBottom: 6,
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
    marginBottom: 10,
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
  
})
