import React from "react"
import { View, TouchableOpacity, Text, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Settings, User, Scroll, BookCheck, Map, Plus } from "lucide-react-native"
import { useGame } from "@shared/game/engine/GameContext"
import fontConfig from "@shared/utils/fontConfig"

const FACES = fontConfig.fontFaceNames()

export type BottomNavTab = "settings" | "profile" | "log" | "tasks" | "world" | "none"

export default function BottomNav({
  active,
  onSelect,
  onOpenDebug,
  onAdvanceMonth,
}: {
  active?: BottomNavTab
  onSelect?: (t: BottomNavTab) => void
  onOpenDebug?: () => void
  onAdvanceMonth?: () => void
}) {
  const insets = useSafeAreaInsets()

  const Item = ({ tab, label, Icon }: { tab: BottomNavTab; label: string; Icon: any }) => {
    const selected = active === tab
    const handlePress = () => {
      // never toggle off any tab; always select the tab
      onSelect?.(tab)
    }

    return (
      <TouchableOpacity
        style={[styles.item, selected && styles.itemActive]}
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <View style={styles.itemContent}>
          <Icon color={selected ? "#1b5cff" : "#9fa3b5"} size={20} />
          <Text style={[styles.label, selected ? styles.labelActive : styles.labelInactive]}>{label}</Text>
        </View>
        {/* badge for tasks will be rendered by caller if needed */}
      </TouchableOpacity>
    )
  }

  // Settings opens debug controls and does not change the active tab.
  const isLogSelected = active === "log"

  const totalHeight = 60 + Math.max(insets.bottom, 0)
  return (
    <View style={[styles.container, { height: totalHeight }]}>
      <TouchableOpacity
        style={styles.item}
        onPress={() => onOpenDebug?.()}
        activeOpacity={0.8}
      >
        <Settings color="#9fa3b5" size={20} />
        <Text style={[styles.label, styles.labelInactive]}>SETTINGS</Text>
      </TouchableOpacity>

      <Item tab="profile" label="PROFILE" Icon={User} />

      {/* LOG: when selected becomes ADVANCE (+) and advances month; otherwise selects the log tab */}
      {isLogSelected ? (
        <TouchableOpacity
          style={[styles.item, styles.itemActive]}
          onPress={() => onAdvanceMonth?.()}
          activeOpacity={0.8}
        >
          <Plus color="#9fa3b5" size={20} />
          <Text style={[styles.label, styles.labelActive]}>ADVANCE</Text>
        </TouchableOpacity>
      ) : (
        <Item tab="log" label="LOG" Icon={Scroll} />
      )}

      {/* compute pending tasks and render badge on tasks button */}
      {(() => {
        const { state } = useGame()
        const pending = (state.tasks ?? []).filter((t: any) => !t.resolved).length
        return (
          <View style={{ flex: 1 }}>
            <Item tab="tasks" label="TASKS" Icon={BookCheck} />
            {pending > 0 ? (
              <View style={styles.badgeWrapper} pointerEvents="none">
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pending}</Text>
                </View>
              </View>
            ) : null}
          </View>
        )
      })()}
      <Item tab="world" label="WORLD" Icon={Map} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    // footer style (participates in layout)
    alignSelf: "stretch",
    height: 68,
    backgroundColor: "#0c0f18",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1d2435",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  // make each nav button take equal width
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, marginHorizontal: 4 },
  itemActive: { backgroundColor: "#07102a" },
  itemContent: { alignItems: "center", justifyContent: "center" },
  badgeWrapper: { position: "absolute", top: 6, right: 10, alignItems: "center", justifyContent: "center" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 6, backgroundColor: "#ff5f5f", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#7a1a1a" },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: FACES.BOLD },
  label: { fontSize: 10, marginTop: 4, fontFamily: FACES.BOLD },
  labelInactive: { color: "#9fa3b5" },
  labelActive: { color: "#1b5cff" },
})
