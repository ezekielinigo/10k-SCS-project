import React, { useCallback } from "react"
import { FlatList, Image, Pressable, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import type { ItemTemplate } from "@shared/game/types"
import { RARITY_COLORS } from "@shared/utils/ui"
import iconDefault from "../../assets/icon_default.png"
import styles from "./profilePanelStyles"
import { formatItemKindLabel, formatSlotLabel, resolveItemIcon, resolveSlotIcon } from "./profilePanelUtils"
import { useProfilePanel } from "./ProfilePanelContext"

type InventoryItem = { instance: any; template: ItemTemplate }

export default function InventoryList() {
  const {
    inventorySortMode,
    cycleInventorySort,
    slotFilter,
    filteredInventory,
    selectedId,
    equippedSlotByItem,
    handleItemSelect,
    handleEquipToggle,
  } = useProfilePanel()
  const renderInventoryItem = useCallback(({ item }: { item: InventoryItem }) => {
    const { instance, template } = item
    const borderColor = template.rarity ? RARITY_COLORS[template.rarity as keyof typeof RARITY_COLORS] ?? "#2b3a55" : "#2b3a55"
    const isSelected = selectedId === instance.id
    const equippedSlot = equippedSlotByItem.get(instance.id)
    const isWeapon = template.kind === "weapon"
    const canEquipSlot = (template.kind === "equipment" || template.kind === "weapon" || template.kind === "cybernetic") && (!isWeapon || !!slotFilter)
    return (
      <Pressable style={[styles.inventoryRow, isSelected ? styles.inventoryRowSelected : null]} onPress={() => handleItemSelect(instance.id)}>
        <View style={[styles.inventoryIconWrap, { borderColor }]}>
          <Image source={iconDefault} style={styles.inventoryIconCanvas} resizeMode="contain" />
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
  }, [equippedSlotByItem, handleEquipToggle, handleItemSelect, selectedId, slotFilter])

  return (
    <>
      <View style={styles.sortRow}>
        <Pressable style={styles.sortButton} onPress={cycleInventorySort}>
          <Feather name="filter" size={14} color="#cfe1ff" />
          <Text style={styles.sortText}>Sort: {inventorySortMode}</Text>
        </Pressable>
        {slotFilter ? (
          <View style={styles.filterChip}>
            <Feather name={resolveSlotIcon(slotFilter)} size={12} color="#cfe1ff" />
            <Text style={styles.filterText}>{formatSlotLabel(slotFilter)}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={filteredInventory}
        renderItem={renderInventoryItem}
        keyExtractor={(item) => item.instance.id}
        style={styles.inventoryList}
        contentContainerStyle={styles.inventoryListContent}
        removeClippedSubviews
        initialNumToRender={12}
        windowSize={7}
        ListEmptyComponent={<Text style={styles.empty}>No items found.</Text>}
      />
    </>
  )
}
