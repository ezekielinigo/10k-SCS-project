import React, { useCallback } from "react"
import { FlatList, Pressable, Text, View, Image } from "react-native"
import { Feather } from "@expo/vector-icons"
import { Canvas, Image as SkiaImage, FilterMode, MipmapMode } from "@shopify/react-native-skia"
import type { CardDefinition } from "@shared/game/engine/combatTypes"
import { RARITY_COLORS } from "@shared/utils/ui"
import iconDefault from "../../assets/icon_default.png"
import styles from "./profilePanelStyles"
import { GRID_CARD_HEIGHT, GRID_CARD_WIDTH, SELECTION_ICON_SIZE } from "./profilePanelConstants"
import { resolveItemIcon } from "./profilePanelUtils"
import { useProfilePanel } from "./ProfilePanelContext"

export default function SelectionPanel() {
  const {
    selectionBorderColor,
    itemIconSkia,
    selectionView,
    selectedTemplate,
    selectedMeta,
    selectedEffects,
    selectedCards,
    deckCounts,
    cycleSelectionView,
    setCardPreview,
  } = useProfilePanel()
  const renderSelectionCard = useCallback(({ item }: { item: CardDefinition }) => {
    const borderColor = item.rarity ? RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] ?? "#2b3a55" : "#2b3a55"
    const count = deckCounts.get(item.id) ?? 0
    return (
      <Pressable style={[styles.deckGridCard, { width: GRID_CARD_WIDTH, height: GRID_CARD_HEIGHT, borderColor }]} onPress={() => setCardPreview(item)}>
        <View style={styles.gridCostBadge}>
          <Text style={styles.gridCostText}>{item.cost ?? 0}</Text>
        </View>
        {count > 1 ? (
          <View style={styles.gridCountBadge}>
            <Text style={styles.gridCountText}>x{count}</Text>
          </View>
        ) : null}
        <View style={[styles.gridCardArt, { height: GRID_CARD_HEIGHT - 48 }]}>
          <Image source={iconDefault} style={styles.gridCardCanvas} resizeMode="contain" />
        </View>
        <View style={styles.gridCardFooter}>
          <View style={styles.deckTitleRow}>
            <Text numberOfLines={1} style={styles.gridCardTitle}>{item.name}</Text>
          </View>
          <Text style={styles.gridCardMeta}>{item.type ?? "?"}</Text>
        </View>
      </Pressable>
    )
  }, [deckCounts, setCardPreview])

  return (
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
          <FlatList
            data={selectedCards}
            renderItem={renderSelectionCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.deckGrid, { flexWrap: "nowrap", paddingVertical: 6 }]}
            removeClippedSubviews
            initialNumToRender={8}
            windowSize={5}
            ListEmptyComponent={<Text style={styles.selectionDesc}>No cards.</Text>}
          />
        ) : null}
      </View>
    </View>
  )
}
