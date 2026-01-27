import React from "react"
import { Pressable, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { Canvas, Image as SkiaImage, FilterMode, MipmapMode, type SkImage } from "@shopify/react-native-skia"
import type { CyberwareSlotKey, EquipmentSlot, WeaponSlot } from "@shared/game/types"
import { RARITY_COLORS } from "@shared/utils/ui"
import styles from "./profilePanelStyles"
import { resolveSlotIcon } from "./profilePanelUtils"
import { CYBER_BUCKETS, EQUIP_SLOTS, ITEM_ICON_SIZE } from "./profilePanelConstants"
import { useProfilePanel } from "./ProfilePanelContext"

export default function EquipSlotsRow() {
  const { activeTab, slotFilter, equippedBySlot, templateByInstance, handleSlotPress, itemIconSkia } = useProfilePanel()
  const [cyberRowWidth, setCyberRowWidth] = React.useState<number | null>(null)
  const cyberSlotGap = cyberRowWidth ? Math.max(0, (cyberRowWidth - 48 * 7) / 6) : 0
  const cyberBucketWidth = 48 * 2 + cyberSlotGap
  return (
    <View style={styles.equipRow}>
      {activeTab === "equipment"
        ? EQUIP_SLOTS.map((label) => {
            const isTrash = label === "trash"
            const slotId = label as EquipmentSlot | WeaponSlot
            const equippedId = !isTrash ? equippedBySlot.get(slotId) : null
            const template = equippedId ? templateByInstance.get(equippedId) : null
            const borderColor = template?.rarity ? RARITY_COLORS[template.rarity as keyof typeof RARITY_COLORS] ?? "#2b3a55" : "#2b3a55"
            return (
              <View key={label} style={styles.equipSlotWrap}>
                <Text style={styles.equipLabel}>{label.toUpperCase()}</Text>
                <Pressable onPress={() => handleSlotPress(isTrash ? "trash" : slotId)}>
                  <View style={[styles.equipSlot, isTrash ? styles.trashSlot : null, slotFilter === slotId ? styles.equipSlotActive : null]}>
                    {isTrash ? (
                      <Feather name="trash" size={18} color="#2d0b0b" />
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
              </View>
            )
          })
        : (
            <View style={styles.cyberRowWrap}>
              <View style={[styles.cyberLabelRow, cyberRowWidth ? { width: cyberRowWidth } : null]}>
                {CYBER_BUCKETS.map((bucket) => (
                  <View key={bucket.key} style={[styles.cyberBucket, { width: cyberBucketWidth }]}> 
                    <Text style={[styles.cyberBucketLabel, { marginBottom: 4 }]}>{bucket.label.toUpperCase()}</Text>
                  </View>
                ))}
                <View style={[styles.cyberBucket, { width: 48 }]}> 
                  <Text style={styles.equipLabel}>TRASH</Text>
                </View>
              </View>
              <View
                style={styles.cyberSlotsRow}
                onLayout={(event) => setCyberRowWidth(event.nativeEvent.layout.width)}
              >
                {CYBER_BUCKETS.flatMap((bucket) =>
                  [0, 1].map((index) => {
                    const slotKey = `${bucket.key}:${index}` as CyberwareSlotKey
                    const equippedId = equippedBySlot.get(slotKey) ?? null
                    const template = equippedId ? templateByInstance.get(equippedId) : null
                    const borderColor = template?.rarity
                      ? RARITY_COLORS[template.rarity as keyof typeof RARITY_COLORS] ?? "#2b3a55"
                      : "#2b3a55"
                    return (
                      <Pressable key={slotKey} style={styles.equipSlotWrap} onPress={() => handleSlotPress(slotKey)}>
                        <View style={[styles.equipSlot, slotFilter === slotKey ? styles.equipSlotActive : null]}>
                          {equippedId && itemIconSkia ? (
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
                            <Feather name={resolveSlotIcon(slotKey)} size={16} color="#44506b" />
                          )}
                        </View>
                      </Pressable>
                    )
                  })
                )}
                <View style={styles.equipSlotWrap}>
                  <Pressable onPress={() => handleSlotPress("trash")}>
                    <View style={[styles.equipSlot, styles.trashSlot]}>
                      <Feather name="trash" size={18} color="#2d0b0b" />
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
    </View>
  )
}
