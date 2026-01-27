import React, { useCallback } from "react"
import { FlatList, Image, Pressable, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import type { CardDefinition } from "@shared/game/engine/combatTypes"
import { RARITY_COLORS } from "@shared/utils/ui"
import iconDefault from "../../assets/icon_default.png"
import styles from "./profilePanelStyles"
import type { DeckEntry } from "./profilePanelTypes"
import { GRID_CARD_HEIGHT, GRID_CARD_WIDTH, GRID_COLUMNS } from "./profilePanelConstants"
import { resolveCardTypeIcon } from "./profilePanelUtils"
import { useProfilePanel } from "./ProfilePanelContext"

export default function DeckTab() {
  const { deckEntries, deckView, deckSortMode, cycleDeckView, cycleDeckSort, setCardPreview } = useProfilePanel()
  const renderDeckListItem = useCallback(({ item }: { item: DeckEntry }) => {
    const def = item.def as CardDefinition
    const rarityColor = def?.rarity ? RARITY_COLORS[def.rarity as keyof typeof RARITY_COLORS] ?? "#253146" : "#253146"
    const sourceBorder = item.source?.rarity ? RARITY_COLORS[item.source.rarity as keyof typeof RARITY_COLORS] ?? "#2b3a55" : "#2b3a55"
    return (
      <Pressable style={[styles.deckListRow, { borderColor: rarityColor }]} onPress={() => setCardPreview(def)}>
        <View style={styles.deckListCostBadge}>
          <Text style={styles.deckCostText}>{def?.cost ?? 0}</Text>
        </View>
        {item.count > 1 ? (
          <View style={styles.deckListCountBadge}>
            <Text style={styles.countBadgeText}>x{item.count}</Text>
          </View>
        ) : null}
        <View style={styles.deckSourceColumn}>
          <View style={[styles.sourceIconWrap, { borderColor: sourceBorder }]}>
            <Image source={iconDefault} style={styles.sourceIconCanvas} resizeMode="contain" />
          </View>
          <Text numberOfLines={1} style={styles.deckSourceName}>{item.source?.name ?? "Unknown"}</Text>
        </View>
        <View style={styles.deckTextWrap}>
          <View style={styles.deckTitleRow}>
            <Feather name={resolveCardTypeIcon(def?.type)} size={12} color="#9aa6bf" />
            <Text numberOfLines={1} style={styles.deckCardTitle}>{def?.name ?? item.cardId}</Text>
          </View>
          <Text numberOfLines={2} style={styles.deckCardDesc}>{def?.description ?? ""}</Text>
        </View>
      </Pressable>
    )
  }, [setCardPreview])

  const renderDeckGridItem = useCallback(({ item }: { item: DeckEntry }) => {
    const def = item.def as CardDefinition
    const rarityColor = def?.rarity ? RARITY_COLORS[def.rarity as keyof typeof RARITY_COLORS] ?? "#253146" : "#253146"
    return (
      <Pressable style={[styles.deckGridCard, { width: GRID_CARD_WIDTH, height: GRID_CARD_HEIGHT, borderColor: rarityColor }]} onPress={() => setCardPreview(def)}>
        <View style={styles.gridCostBadge}>
          <Text style={styles.gridCostText}>{def?.cost ?? 0}</Text>
        </View>
        {item.count > 1 ? (
          <View style={styles.gridCountBadge}>
            <Text style={styles.gridCountText}>x{item.count}</Text>
          </View>
        ) : null}
        <View style={styles.gridCardArt}>
          <Image source={iconDefault} style={styles.gridCardCanvas} resizeMode="contain" />
        </View>
        <View style={styles.gridCardFooter}>
          <Text numberOfLines={1} style={styles.gridCardTitle}>{def?.name ?? item.cardId}</Text>
          <Text style={styles.gridCardMeta}>{def?.type ?? "?"}</Text>
        </View>
      </Pressable>
    )
  }, [setCardPreview])

  return (
    <>
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
        <FlatList
          data={deckEntries}
          renderItem={renderDeckListItem}
          keyExtractor={(item) => item.cardId}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews
          initialNumToRender={14}
          windowSize={7}
        />
      ) : (
        <FlatList
          data={deckEntries}
          renderItem={renderDeckGridItem}
          keyExtractor={(item) => item.cardId}
          numColumns={GRID_COLUMNS}
          contentContainerStyle={styles.deckGrid}
          columnWrapperStyle={styles.deckGridRow}
          removeClippedSubviews
          initialNumToRender={15}
          windowSize={7}
        />
      )}
    </>
  )
}
