import React from "react"
import { Pressable, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { Canvas, Image as SkiaImage, FilterMode, MipmapMode, type SkImage } from "@shopify/react-native-skia"
import type { CyberSlot, EquipmentSlot, ItemTemplate, WeaponSlot } from "@shared/game/types"
import { RARITY_COLORS } from "@shared/utils/ui"
import styles from "./profilePanelStyles"
import { resolveSlotIcon } from "./profilePanelUtils"
import { CYBER_SLOTS, EQUIP_SLOTS, ITEM_ICON_SIZE } from "./profilePanelConstants"
import { useProfilePanel } from "./ProfilePanelContext"

export default function EquipSlotsRow() {
  const { activeTab, slotFilter, equippedBySlot, templateByInstance, handleSlotPress, itemIconSkia } = useProfilePanel()
  return (
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
  )
}
