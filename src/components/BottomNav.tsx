import React from "react"
import { View, TouchableOpacity, Text, StyleSheet, type LayoutChangeEvent, ActivityIndicator } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Settings, User, Scroll, BookCheck, Map, Plus } from "lucide-react-native"
import { useGame } from "@shared/game/engine/GameContext"
import fontConfig from "@shared/utils/fontConfig"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"
import { AnimatedFlickerSwap } from "@shared/utils/ui"

const FACES = fontConfig.fontFaceNames()

export type BottomNavTab = "settings" | "profile" | "log" | "tasks" | "world" | "none"

export default function BottomNav({
  active,
  onSelect,
  onOpenDebug,
  onAdvanceMonth,
  onPendingStart,
  onNavSettled,
  loadingReleaseKey,
  navLocked,
}: {
  active?: BottomNavTab
  onSelect?: (t: BottomNavTab) => void
  onOpenDebug?: () => void
  onAdvanceMonth?: () => void
  onPendingStart?: (t: BottomNavTab, direction: 1 | -1) => void
  onNavSettled?: (t: BottomNavTab) => void
  loadingReleaseKey?: number
  navLocked?: boolean
}) {
  const insets = useSafeAreaInsets()
  const [itemLayouts, setItemLayouts] = React.useState<Partial<Record<BottomNavTab, { x: number; width: number }>>>({})
  const [loadingTab, setLoadingTab] = React.useState<BottomNavTab | null>(null)
  const [pendingTab, setPendingTab] = React.useState<BottomNavTab | null>(null)
  const pendingRef = React.useRef<BottomNavTab | null>(null)
  const lastTargetRef = React.useRef<BottomNavTab | null>(null)
  const prevActiveRef = React.useRef<BottomNavTab | undefined>(active)
  const suppressFlickerUntilRef = React.useRef(0)
  const highlightX = useSharedValue(0)
  const highlightWidth = useSharedValue(0)
  const lastHighlightX = React.useRef(0)
  const lastHighlightWidth = React.useRef(0)
  const selectedColor = "#e6e9f2"
  const inactiveColor = "#9fa3b5"

  const Item = ({ tab, label, Icon, badgeCount, animateWhenInactive = false }: { tab: BottomNavTab; label: string; Icon: any; badgeCount?: number; animateWhenInactive?: boolean }) => {
    const selected = active === tab
    const selectedVisual = (selected && !pendingTab) || loadingTab === tab || pendingTab === tab
    const suppressFlicker = Date.now() < suppressFlickerUntilRef.current
    const shouldAnimate = (selected ? true : animateWhenInactive) && !pendingTab && loadingTab !== tab && !suppressFlicker
    const handlePress = () => {
      // never toggle off any tab; always select the tab
      if (navLocked) return
      if (pendingTab || loadingTab) return
      if (selected) return
      setLoadingTab(tab)
      setPendingTab(tab)
      pendingRef.current = tab
      const currentTarget = pendingTab ?? active
      const currentLayout = currentTarget ? itemLayouts[currentTarget] : undefined
      const currentX = currentLayout?.x ?? lastHighlightX.current ?? 0
      const nextLayout = itemLayouts[tab]
      const nextX = nextLayout?.x ?? currentX
      const direction = nextX >= currentX ? 1 : -1
      onPendingStart?.(tab, direction)
    }

    const handleLayout = (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout
      setItemLayouts((prev) => {
        const current = prev[tab]
        if (current && current.x === x && current.width === width) return prev
        return { ...prev, [tab]: { x, width } }
      })
    }

    return (
      <TouchableOpacity
        style={[styles.item, selected && styles.itemActive]}
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="button"
        onLayout={handleLayout}
      >
        <AnimatedFlickerSwap
          keyProp={`${tab}-${selected}`}
          loading={loadingTab === tab}
          animate={shouldAnimate}
          active={selected}
          animateOnEnter={selected}
          loadingElement={
            <View style={styles.itemContent}>
              <ActivityIndicator size="small" color={selectedColor} />
            </View>
          }
          iconElement={
            <View style={styles.itemContent}>
              <Icon color={selectedVisual ? selectedColor : inactiveColor} size={20} />
              <Text style={[styles.label, selectedVisual ? styles.labelActive : styles.labelInactive]}>{label}</Text>
            </View>
          }
        />
        {typeof badgeCount === "number" && badgeCount > 0 && loadingTab !== tab ? (
          <View style={styles.badgeWrapper} pointerEvents="none">
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeCount}</Text>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>
    )
  }

  // Settings opens debug controls and does not change the active tab.
  // Show the ADVANCE variant only when log is the active tab and there is no pending tab.
  const isLogSelected = active === "log" && pendingTab == null

  const totalHeight = 60 + Math.max(insets.bottom, 0)
  const highlightHeight = styles.highlight.minHeight
  const highlightTop = (totalHeight - highlightHeight) / 2

  const clearLoading = React.useCallback((tab: BottomNavTab) => {
    setLoadingTab((prev) => (prev === tab ? null : prev))
  }, [])

  const highlightTarget = pendingTab ?? active
  const logJustDeselected = prevActiveRef.current === "log" && active !== "log" && !pendingTab && !loadingTab

  React.useEffect(() => {
    prevActiveRef.current = active
  }, [active])

  const finishPending = React.useCallback((tab: BottomNavTab) => {
    if (pendingRef.current !== tab) return
    pendingRef.current = null
    setPendingTab(null)

    if (tab === "settings") {
      onOpenDebug?.()
    } else if (tab === "log" && active === "log") {
      onAdvanceMonth?.()
    } else {
      onSelect?.(tab)
    }

    requestAnimationFrame(() => {
      setLoadingTab((prev) => (prev === tab ? null : prev))
      setPendingTab((prev) => (prev === tab ? null : prev))
    })
  }, [active, onAdvanceMonth, onOpenDebug, onSelect])

  React.useEffect(() => {
    if (!highlightTarget || highlightTarget === "none") {
      highlightWidth.value = 0
      return
    }
    const layout = itemLayouts[highlightTarget]
    if (!layout) return

    if (pendingTab && highlightTarget === lastTargetRef.current) {
      if (onNavSettled) runOnJS(onNavSettled)(pendingTab)
      else runOnJS(finishPending)(pendingTab)
      return
    }

    if (!pendingTab && highlightTarget === lastTargetRef.current) {
      return
    }

    lastTargetRef.current = highlightTarget

    // ensure highlight is visible immediately; width is set below

    // Animate position with a spring for a natural overshoot on X only.
    // Call finishPending from the spring callback so the pending action
    // runs only after the translate (overshoot) has settled.
    highlightX.value = withSpring(
      layout.x,
      { damping: 30, stiffness: 300, mass: 1 },
      () => {
        if (pendingTab) {
          if (onNavSettled) runOnJS(onNavSettled)(pendingTab)
          else runOnJS(finishPending)(pendingTab)
        }
      }
    )

    // Set width directly to final size (no animation).
    highlightWidth.value = layout.width

    lastHighlightX.current = layout.x
    lastHighlightWidth.current = layout.width
  }, [highlightTarget, itemLayouts, highlightWidth, highlightX, pendingTab, finishPending])

  // external release key: when App signals loading complete, clear loading state
  React.useEffect(() => {
    if (typeof loadingReleaseKey !== "number") return
    suppressFlickerUntilRef.current = Date.now() + 400
    setLoadingTab(null)
    setPendingTab(null)
    pendingRef.current = null
    lastTargetRef.current = null
  }, [loadingReleaseKey])

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highlightX.value }],
    width: highlightWidth.value,
  }))
  return (
    <View style={[styles.container, { height: totalHeight }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.highlight, { top: highlightTop, height: highlightHeight }, highlightStyle]}
      />
      <Item tab="settings" label="SETTINGS" Icon={Settings} />

      <Item tab="profile" label="PROFILE" Icon={User} />

      {/* LOG: when selected becomes ADVANCE (+) and advances month; otherwise selects the log tab */}
      {isLogSelected ? (
        <TouchableOpacity
          style={[styles.item, styles.itemActive]}
          onPress={() => {
            if (navLocked) return
            if (pendingTab || loadingTab) return
            setLoadingTab("log")
            setPendingTab("log")
            pendingRef.current = "log"
          }}
          activeOpacity={0.8}
          onLayout={(event) => {
            const { x, width } = event.nativeEvent.layout
            setItemLayouts((prev) => {
              const current = prev.log
              if (current && current.x === x && current.width === width) return prev
              return { ...prev, log: { x, width } }
            })
          }}
        >
          <AnimatedFlickerSwap
            keyProp={`log-advance-${loadingTab === "log"}`}
            loading={loadingTab === "log"}
            animate={false}
            loadingElement={
              <View style={styles.itemContent}>
                <ActivityIndicator size="small" color={selectedColor} />
              </View>
            }
            iconElement={
              <View style={styles.itemContent}>
                <Plus color={selectedColor} size={20} />
                <Text style={[styles.label, styles.labelActive]}>ADVANCE</Text>
              </View>
            }
          />
        </TouchableOpacity>
      ) : (
        <Item tab="log" label="LOG" Icon={Scroll} animateWhenInactive={logJustDeselected} />
      )}

      {/* compute pending tasks and render badge on tasks button */}
      {(() => {
        const { state } = useGame()
        const pending = (state.tasks ?? []).filter((t: any) => !t.resolved).length
        return <Item tab="tasks" label="TASKS" Icon={BookCheck} badgeCount={pending} />
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
    elevation: 0,
    zIndex: 0,
    paddingHorizontal: 8,
    // allow the highlight to overlay outside the container
    overflow: "visible",
  },
  // make each nav button take equal width
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, marginHorizontal: 4, position: "relative", zIndex: 2, elevation: 2 },
  itemActive: { backgroundColor: "transparent" },
  itemContent: { alignItems: "center", justifyContent: "center" },
  badgeWrapper: { position: "absolute", top: 6, right: 10, alignItems: "center", justifyContent: "center" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 6, backgroundColor: "#ff5f5f", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#7a1a1a" },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: FACES.BOLD },
  label: { fontSize: 10, marginTop: 4, fontFamily: FACES.BOLD },
  labelInactive: { color: "#9fa3b5" },
  labelActive: { color: "#e6e9f2" },
  highlight: {
    position: "absolute",
    left: 0,
    borderRadius: 12,
    backgroundColor: "#162033",
    borderWidth: 1,
    borderColor: "#2b3a55",
    zIndex: 1,
    elevation: 1,
    minHeight: 90,
  },
})
