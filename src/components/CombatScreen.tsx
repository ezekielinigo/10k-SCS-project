import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Dimensions,
  FlatList,
  LayoutRectangle,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import { Feather } from "@expo/vector-icons"
import { Canvas, RoundedRect } from "@shopify/react-native-skia"
import { useGame } from "@shared/game/engine/GameContext"
import {
  createCombatState,
  startCombat,
  startTurn,
  endTurn,
  playCard,
  applyEnemyCard,
} from "@shared/game/engine/combatEngine"
import type { CardDefinition, CardInstance, CombatState, StatusInstance } from "@shared/game/engine/combatTypes"
import { getCardLibraryMap } from "@shared/game/services/cardLibrary"
import fontConfig from "@shared/utils/fontConfig"
import { STATUS_ICON_MAP, STAT_ICONS } from "@shared/utils/ui"
const FACES = fontConfig.fontFaceNames()

const ANIM_SPEED = 1.5

const CARD_WIDTH = 140
const CARD_HEIGHT = 190
const CARD_BOTTOM = -10

const STARTER_DECK = [
  "hip_fire",
  "hip_fire",
  "dodge",
  "smoke_screen",
  "aimed_shot",
  "recover",
  "energy_surge",
]

const DEFAULT_SKILLS = {
  str: 1,
  int: 1,
  ref: 1,
  chr: 1,
  subSkills: {
    athletics: 1,
    closeCombat: 1,
    heavyHandling: 1,
    hacking: 1,
    medical: 1,
    engineering: 1,
    marksmanship: 1,
    stealth: 1,
    mobility: 1,
    persuasion: 1,
    deception: 1,
    streetwise: 1,
  },
}

type Phase = "player" | "enemy"
type HoverTarget = "enemyTile" | "enemyLane" | null
type HoverTargetValue = 0 | 1 | 2

type ZonesOverlay = "deck" | "discard" | null

const cardCost = (card: CardInstance, def: CardDefinition) => Math.max(0, card.temporaryCost ?? def.cost)

const DEBUFF_IDS = new Set(["skip_next_turn", "hand_size_minus_one", "blood_tax"])

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max))

const pointInside = (box: LayoutRectangle | null, x: number, y: number) => {
  if (!box) return false
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
}

const getHandCardLayout = (
  handTray: LayoutRectangle | null,
  index: number,
  total: number,
  selectedIndex: number,
  handShift: number,
): LayoutRectangle | null => {
  if (!handTray) return null
  const center = (total - 1) / 2
  const spread = total > 7 ? 46 : 54
  const baseShift = (index - center) * spread + handShift
  let offsetShift = 0
  if (selectedIndex >= 0 && index !== selectedIndex) {
    const distance = index - selectedIndex
    if (distance > 0) offsetShift = 20 + 10 * distance
    else if (distance < 0) offsetShift = -12 - 6 * Math.abs(distance)
  }
  const shiftTarget = baseShift + offsetShift
  const baseX = handTray.x + handTray.width / 2 - CARD_WIDTH / 2 + shiftTarget
  const baseY = handTray.y + handTray.height - CARD_HEIGHT + CARD_BOTTOM
  return { x: baseX, y: baseY, width: CARD_WIDTH, height: CARD_HEIGHT }
}

export default function CombatScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state: gameState } = useGame()
  const [combat, setCombat] = useState<CombatState | null>(null)
  const [phase, setPhase] = useState<Phase>("player")
  const [enemyAiIndex, setEnemyAiIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [, setHoverTarget] = useState<HoverTarget>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [zonesOpen, setZonesOpen] = useState<ZonesOverlay>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [handShift] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const layoutLocked = useRef(false)
  const [cardAnimTargets, setCardAnimTargets] = useState<Record<string, { x: number; y: number; scale: number; opacity: number; duration: number }>>({})
  const animatingCards = useRef<Map<string, "play" | "endTurn">>(new Map())
  const pendingPlay = useRef<{ state: CombatState; damage: number } | null>(null)
  const pendingEndTurn = useRef<{ state: CombatState; remaining: number } | null>(null)

  const deckButtonRef = useRef<View>(null)
  const discardButtonRef = useRef<View>(null)
  const [deckBox, setDeckBox] = useState<LayoutRectangle | null>(null)
  const [discardBox, setDiscardBox] = useState<LayoutRectangle | null>(null)
  const [handTrayBox, setHandTrayBox] = useState<LayoutRectangle | null>(null)
  const prevCounts = useRef({ deck: 0, discard: 0 })
  const deckCountScale = useSharedValue(1)
  const discardCountScale = useSharedValue(1)

  const enemyLaneRef = useRef<View>(null)
  const enemyTileRef = useRef<View>(null)
  const [enemyLaneBox, setEnemyLaneBox] = useState<LayoutRectangle | null>(null)
  const [enemyTileBox, setEnemyTileBox] = useState<LayoutRectangle | null>(null)
  const enemyLaneBoxSV = useSharedValue<LayoutRectangle | null>(null)
  const enemyTileBoxSV = useSharedValue<LayoutRectangle | null>(null)
  const hoverTargetSV = useSharedValue<HoverTargetValue>(0)
  const cardMap = useMemo(() => getCardLibraryMap(), [])

  const deriveDeck = () => {
    const equipped = (gameState as any)?.derivedLoadout?.equippedCards ?? []
    const valid = equipped.filter((id: string) => cardMap[id])
    return valid.length ? valid : STARTER_DECK
  }


  const resetCombat = () => {
    const skills = (gameState as any)?.player?.skills ?? DEFAULT_SKILLS
    const deckIds = deriveDeck()
    const cs = createCombatState(
      {
        player: { hp: 100, maxHP: 100, skills },
        enemy: { hp: 100, maxHP: 100, skills },
        deckCardIds: deckIds,
        cardLibrary: cardMap,
        rngSeed: "combat_screen",
        config: { handLimit: 5, energyPerTurn: 5 },
      },
    )
    let next = startCombat(cs)
    next = startTurn(next)
    setCombat(next)
    setPhase("player")
    setSelected(null)
    setMessage(null)
    setLogs([`Combat ready (deck ${deckIds.length})`])
    setEnemyAiIndex(0)
  }

  useEffect(() => {
    if (open) {
      resetCombat()
    } else {
      setCombat(null)
      setSelected(null)
      setPhase("player")
      setLogs([])
      setMessage(null)
      setZonesOpen(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const updateLaneBoxes = () => {
    enemyLaneRef.current?.measure((x, y, width, height, pageX, pageY) => {
      const box = { x: pageX, y: pageY, width, height }
      setEnemyLaneBox(box)
      enemyLaneBoxSV.value = box
    })
    enemyTileRef.current?.measure((x, y, width, height, pageX, pageY) => {
      const box = { x: pageX, y: pageY, width, height }
      setEnemyTileBox(box)
      enemyTileBoxSV.value = box
    })
  }

  const updateZoneBoxes = () => {
    deckButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setDeckBox({ x: pageX, y: pageY, width, height })
    })
    discardButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setDiscardBox({ x: pageX, y: pageY, width, height })
    })
  }

  useAnimatedReaction(
    () => hoverTargetSV.value,
    (value, prev) => {
      if (value === prev) return
      const next: HoverTarget = value === 1 ? "enemyTile" : value === 2 ? "enemyLane" : null
      runOnJS(setHoverTarget)(next)
    },
  )

  const boxCenter = useCallback((box: LayoutRectangle) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }), [])

  const hand = combat?.zones.hand ?? []
  const selectedIndex = hand.findIndex((c) => c.uid === selected)
  const selectedCard = combat ? combat.zones.hand.find((c) => c.uid === selected) : null
  const selectedDef = selectedCard ? cardMap[selectedCard.cardId] : undefined
  const playable = combat && selectedCard && selectedDef && phase === "player" && combat.energy >= cardCost(selectedCard, selectedDef)

  const onPlayCard = useCallback((uid: string, target: "enemy" | "player" = "enemy") => {
    if (!combat) return
    if (isAnimating) return
    const located = combat.zones.hand.find((c) => c.uid === uid)
    if (!located) return
    const def = cardMap[located.cardId]
    if (!def) return
    if (phase !== "player") {
      setMessage("Enemy turn")
      return
    }
    const res = playCard(combat, { cardInstanceId: located.uid, target })
    if (!res.ok) {
      setMessage(res.reason)
      return
    }
    const index = combat.zones.hand.findIndex((c) => c.uid === located.uid)
    const layout = getHandCardLayout(handTrayBox, index, combat.zones.hand.length, selectedIndex, handShift)
    if (!discardBox || !layout) {
      const damage = combat.enemy.hp - res.state.enemy.hp
      if (damage > 0) setLogs((prev) => [...prev, `Dealt ${damage}`].slice(-60))
      setCombat(res.state)
      setSelected(null)
      setMessage(null)
      return
    }

    const exhaust = def?.keywords?.some((k) => k.kind === "exhaust")
    const discardCenter = boxCenter(discardBox)
    const cardCenter = { x: layout.x + layout.width / 2, y: layout.y + layout.height / 2 }
    const delta = { x: discardCenter.x - cardCenter.x, y: discardCenter.y - cardCenter.y }
    setIsAnimating(true)
    pendingPlay.current = { state: res.state, damage: combat.enemy.hp - res.state.enemy.hp }
    animatingCards.current.set(located.uid, "play")
    setCardAnimTargets((prev) => ({
      ...prev,
      [located.uid]: { x: delta.x, y: delta.y, scale: 0.4, opacity: exhaust ? 0 : 1, duration: 190 * ANIM_SPEED },
    }))
  }, [boxCenter, cardMap, combat, discardBox, handTrayBox, handShift, isAnimating, phase, selectedIndex])

  const resolveEnemyPhase = (state: CombatState) => {
    const enemyCycle = ["aimed_shot", "smoke_screen"]
    const enemyCardId = enemyCycle[enemyAiIndex % enemyCycle.length]
    let next = applyEnemyCard(state, enemyCardId)
    setLogs((prev) => [...prev, `Enemy used ${cardMap[enemyCardId]?.name ?? enemyCardId}`].slice(-60))
    setEnemyAiIndex((idx) => (idx + 1) % enemyCycle.length)
    next = startTurn(next)
    setCombat(next)
    setPhase("player")
    setMessage("Player phase")
  }

  const onEndTurn = () => {
    if (!combat) return
    if (isAnimating) return
    setSelected(null)
    if (!discardBox || combat.zones.hand.length === 0) {
      const next = endTurn(combat)
      setCombat(next)
      setPhase("enemy")
      setMessage("Enemy phase")
      resolveEnemyPhase(next)
      return
    }

    const animatables = combat.zones.hand
      .map((card, index) => ({
        card,
        layout: getHandCardLayout(handTrayBox, index, combat.zones.hand.length, selectedIndex, handShift),
      }))
      .filter((entry) => !!entry.layout)

    if (animatables.length === 0) {
      const next = endTurn(combat)
      setCombat(next)
      setPhase("enemy")
      setMessage("Enemy phase")
      resolveEnemyPhase(next)
      return
    }

    layoutLocked.current = true
    setIsAnimating(true)
    const next = endTurn(combat)
    pendingEndTurn.current = { state: next, remaining: animatables.length }
    const updates: Record<string, { x: number; y: number; scale: number; opacity: number; duration: number }> = {}
    animatables.forEach(({ card, layout }) => {
      const discardCenter = boxCenter(discardBox)
      const cardCenter = { x: layout!.x + layout!.width / 2, y: layout!.y + layout!.height / 2 }
      const delta = { x: discardCenter.x - cardCenter.x, y: discardCenter.y - cardCenter.y }
      animatingCards.current.set(card.uid, "endTurn")
      updates[card.uid] = { x: delta.x, y: delta.y, scale: 0.5, opacity: 1, duration: 160 * ANIM_SPEED }
    })
    setCardAnimTargets((prev) => ({ ...prev, ...updates }))
  }

  const deckCountStyle = useAnimatedStyle(() => ({
    transform: [{ scale: deckCountScale.value }],
  }))

  const discardCountStyle = useAnimatedStyle(() => ({
    transform: [{ scale: discardCountScale.value }],
  }))

  const enemyTileHoverStyle = useAnimatedStyle(() => {
    if (!hoverTargetSV.value) return {}
    return {
      borderColor: "#7be0ff",
      backgroundColor: "#13263d",
      shadowColor: "#7be0ff",
      shadowOpacity: 0.5,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
    }
  })

  const counts = combat
    ? {
        deck: combat.zones.deck.length,
        hand: combat.zones.hand.length,
        discard: combat.zones.discard.length,
        exhaust: combat.zones.exhaust.length,
      }
    : { deck: 0, hand: 0, discard: 0, exhaust: 0 }

  useEffect(() => {
    if (isAnimating) return
    deckCountScale.value = withTiming(1.15, { duration: 120 * ANIM_SPEED, easing: Easing.out(Easing.quad) }, () => {
      deckCountScale.value = withTiming(1, { duration: 140 * ANIM_SPEED, easing: Easing.inOut(Easing.quad) })
    })
  }, [counts.deck, isAnimating, deckCountScale])

  useEffect(() => {
    if (isAnimating) return
    discardCountScale.value = withTiming(1.15, { duration: 120 * ANIM_SPEED, easing: Easing.out(Easing.quad) }, () => {
      discardCountScale.value = withTiming(1, { duration: 140 * ANIM_SPEED, easing: Easing.inOut(Easing.quad) })
    })
  }, [counts.discard, counts.exhaust, isAnimating, discardCountScale])

  
  const handleRelease = useCallback((uid: string, x: number, y: number) => {
    const insideTile = pointInside(enemyTileBox, x, y)
    const insideLane = pointInside(enemyLaneBox, x, y)
    if (!insideTile && !insideLane) {
      setMessage("No target found")
      setHoverTarget(null)
      hoverTargetSV.value = 0
      return
    }
    onPlayCard(uid, "enemy")
    setHoverTarget(null)
    hoverTargetSV.value = 0
  }, [enemyLaneBox, enemyTileBox, onPlayCard, hoverTargetSV])

  const handleSelectCard = useCallback((uid: string) => {
    setTooltipPayload(null)
    setSelected(uid)
  }, [])

  const handleDeselectCard = useCallback(() => {
    setSelected(null)
    setHoverTarget(null)
    setTooltipPayload(null)
    hoverTargetSV.value = 0
  }, [hoverTargetSV])

  const handleLongPressCard = useCallback((def?: CardDefinition) => {
    if (def) setTooltipPayload({ kind: "card", def })
  }, [])

  const onCardAnimComplete = (uid: string) => {
    setCardAnimTargets((prev) => {
      if (!prev[uid]) return prev
      const { [uid]: _removed, ...rest } = prev
      return rest
    })
    const mode = animatingCards.current.get(uid)
    animatingCards.current.delete(uid)
    if (mode === "play" && pendingPlay.current) {
      const { state, damage } = pendingPlay.current
      pendingPlay.current = null
      if (damage > 0) setLogs((prev) => [...prev, `Dealt ${damage}`].slice(-60))
      setCombat(state)
      setSelected(null)
      setMessage(null)
      setIsAnimating(false)
      return
    }
    if (mode === "endTurn" && pendingEndTurn.current) {
      pendingEndTurn.current.remaining -= 1
      if (pendingEndTurn.current.remaining <= 0) {
        const { state } = pendingEndTurn.current
        pendingEndTurn.current = null
        setCombat(state)
        setPhase("enemy")
        setMessage("Enemy phase")
        resolveEnemyPhase(state)
        layoutLocked.current = false
        setIsAnimating(false)
      }
    }
  }

  const handleStatusPress = useCallback((status: StatusInstance) => {
    setTooltipPayload({ kind: "status", status })
  }, [])

  const renderHandCard = useCallback((card: CardInstance, index: number, total: number) => {
    const def = cardMap[card.cardId]
    const angleRange = total > 7 ? 12 : 8
    const center = (total - 1) / 2
    const angle = ((index - center) / Math.max(1, total - 1)) * angleRange
    const spread = total > 7 ? 46 : 54
    const baseShift = (index - center) * spread + handShift
    let offsetShift = 0
    if (selectedIndex >= 0 && selected !== card.uid) {
      const distance = index - selectedIndex
      if (distance > 0) {
        offsetShift = 20 + 10 * distance // move right cards further away
      } else if (distance < 0) {
        offsetShift = -12 - 6 * Math.abs(distance) // left cards scoot left a bit
      }
    }
    const shiftTarget = baseShift + offsetShift
    const locked = def ? def.tags.some((t) => combat?.tagLocks.includes(t) ?? false) : false
    const cost = def ? cardCost(card, def) : 0

    return (
      <HandCard
        key={card.uid}
        card={card}
        def={def}
        index={index}
        total={total}
        angle={angle}
        shiftTarget={shiftTarget}
        isSelected={selected === card.uid}
        hasSelection={!!selected}
        isAnimating={isAnimating}
        locked={locked}
        cost={cost}
        playable={!!playable && selected === card.uid}
        cardAnimTarget={cardAnimTargets[card.uid]}
        onAnimComplete={onCardAnimComplete}
        onSelectCard={handleSelectCard}
        onDeselectCard={handleDeselectCard}
        onReleaseCard={handleRelease}
        onLongPressCard={handleLongPressCard}
        hoverTargetSV={hoverTargetSV}
        enemyLaneBoxSV={enemyLaneBoxSV}
        enemyTileBoxSV={enemyTileBoxSV}
      />
    )
  }, [cardAnimTargets, cardMap, combat?.tagLocks, enemyLaneBoxSV, enemyTileBoxSV, handleDeselectCard, handleLongPressCard, handleRelease, handleSelectCard, handShift, hoverTargetSV, isAnimating, onCardAnimComplete, playable, selected, selectedIndex])

  // tooltip state for status pills
  type TooltipPayload = { kind: "status"; status: StatusInstance } | { kind: "card"; def: CardDefinition }
  const [tooltipPayload, setTooltipPayload] = useState<TooltipPayload | null>(null)

  const renderStatusTooltip = () => {
    if (!tooltipPayload) return null
    return (
      <Pressable style={styles.tooltipOverlay} onPress={() => setTooltipPayload(null)}>
        <View style={styles.statusTooltip}>
          {tooltipPayload.kind === "status" ? (
            <>
              <Text style={styles.tooltipName}>{tooltipPayload.status.name}</Text>
              {tooltipPayload.status.description ? <Text style={styles.tooltipDesc}>{tooltipPayload.status.description}</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.tooltipName}>{tooltipPayload.def.name}</Text>
              {tooltipPayload.def.description ? <Text style={styles.tooltipDesc}>{tooltipPayload.def.description}</Text> : null}
            </>
          )}
        </View>
      </Pressable>
    )
  }

  const renderOverlayItem = useCallback(({ item }: { item: CardInstance }) => {
    const def = cardMap[item.cardId]
    return (
      <View style={styles.overlayRow}>
        <Text style={styles.overlayText}>{def?.name ?? item.cardId}</Text>
        <Text style={styles.overlayMeta}>{def?.type ?? "?"} · {def?.cost ?? 0}</Text>
      </View>
    )
  }, [cardMap])

  const renderZonesOverlay = () => {
    if (!zonesOpen || !combat) return null
    const cards = zonesOpen === "deck" ? combat.zones.deck : [...combat.zones.discard, ...combat.zones.exhaust]
    return (
      <Pressable style={styles.overlay} onPress={() => setZonesOpen(null)}>
        <View style={styles.overlayCard}>
          <Text style={styles.overlayTitle}>{zonesOpen === "deck" ? "Deck" : "Discard | Exhaust"}</Text>
          <FlatList
            data={cards}
            keyExtractor={(item) => item.uid}
            renderItem={renderOverlayItem}
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            removeClippedSubviews
            initialNumToRender={14}
            windowSize={7}
          />
        </View>
      </Pressable>
    )
  }

  if (!open || !combat) return null

  return (
    <Modal
      visible={open}
      animationType="fade"
      presentationStyle="fullScreen"
      onShow={() => {
        updateLaneBoxes()
        updateZoneBoxes()
      }}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.safe}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.screen}>
          <View style={styles.header}>
            <Text style={styles.title}>Combat</Text>
            <View style={styles.headerSpacer} />
            <Pressable style={styles.ghostButton} onPress={() => setLogOpen((v) => !v)}>
              <Text style={styles.ghostText}>{logOpen ? "Hide Log" : "Log"}</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={resetCombat}>
              <Text style={styles.ghostText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={onClose}>
              <Text style={styles.ghostText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.debugRow}>
            <Pressable
              style={styles.debugButton}
              onPress={() => {
                setMessage("Enemy HP reset")
                setCombat((prev) => (prev ? { ...prev, enemy: { ...prev.enemy, hp: prev.enemy.maxHP, shield: 0 } } : prev))
              }}
            >
              <Text style={styles.debugText}>Reset Enemy HP</Text>
            </Pressable>
            <Pressable style={styles.debugButton} onPress={() => setZonesOpen("deck")}>
              <Text style={styles.debugText}>Deck ({counts.deck})</Text>
            </Pressable>
            <Pressable style={styles.debugButton} onPress={() => setZonesOpen("discard")}>
              <Text style={styles.debugText}>Discard {counts.discard}|{counts.exhaust}</Text>
            </Pressable>
          </View>

          <View style={styles.lanes}>
            <View style={styles.enemyLane} ref={enemyLaneRef} onLayout={updateLaneBoxes}>
              <Animated.View
                ref={enemyTileRef}
                style={[
                  styles.enemyTile,
                  selected ? styles.enemyTileDim : null,
                  enemyTileHoverStyle,
                ]}
              >
                <Canvas style={styles.enemyCanvas}>
                  <RoundedRect x={0} y={0} width={110} height={110} r={12} color="#1d2235" />
                  <RoundedRect x={0} y={70} width={110} height={40} r={12} color="#111421" />
                </Canvas>
                <Text style={styles.enemyName}>Dummy</Text>
                <StatLine Icon={STAT_ICONS.health} value={combat.enemy.hp} max={combat.enemy.maxHP} barColor="#ff6b7a" accentColor="#ff9aa8" />
                <StatLine Icon={STAT_ICONS.shield} value={combat.enemy.shield ?? 0} max={40} barColor="#66d1ff" accentColor="#7bb5ff" />
                <View style={styles.statusRow}>
                  {(combat.enemy.statuses ?? []).map((status) => (
                    <StatusBadge key={`${status.id}-${status.remaining}`} status={status} onPress={handleStatusPress} />
                  ))}
                </View>
              </Animated.View>
            </View>

      <View style={styles.zoneControls}>
        <Pressable
          ref={deckButtonRef}
          onLayout={updateZoneBoxes}
          style={[styles.cardStackButton, styles.deckButton]}
          onPress={() => setZonesOpen("deck")}
        >
          <Animated.View style={deckCountStyle}>
            <Text style={styles.deckButtonCount}>{counts.deck}</Text>
          </Animated.View>
        </Pressable>
				<View style={styles.energyCounter}>
					<Feather name="zap" size={14} color="#7be0ff" />
					<Text style={styles.energyValue}>{combat.energy}/{combat.config.energyPerTurn}</Text>
				</View>
				<View style={styles.zoneSpacer} />
				<Pressable style={[styles.endTurnButton, phase !== "player" && styles.buttonDisabled]} onPress={onEndTurn} disabled={phase !== "player"}>
					<Text style={styles.endTurnText}>End Turn</Text>
				</Pressable>
        <Pressable
          ref={discardButtonRef}
          onLayout={updateZoneBoxes}
          style={[styles.cardStackButton, styles.discardButton]}
          onPress={() => setZonesOpen("discard")}
        >
          <Animated.View style={discardCountStyle}>
            <Text style={styles.discardButtonCount}>{counts.discard}|{counts.exhaust}</Text>
          </Animated.View>
        </Pressable>
			</View>
            <View style={styles.playerLane}>
              <Text style={styles.sectionTitle}>Player</Text>
              <View style={styles.playerCard}>
                <StatLine Icon={STAT_ICONS.health} value={combat.player.hp} max={combat.player.maxHP} barColor="#76e39c" accentColor="#9cf7b4" />
                <StatLine Icon={STAT_ICONS.shield} value={combat.player.shield ?? 0} max={40} barColor="#66d1ff" accentColor="#7bb5ff" />
                <View style={styles.statusRow}>
                  {(combat.player.statuses ?? []).map((status) => (
                    <StatusBadge key={`${status.id}-${status.remaining}`} status={status} onPress={handleStatusPress} />
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* helper strip removed: use long-press on cards to open tooltip */}

          <View
            style={styles.handTray}
            onLayout={(event) => {
              if (layoutLocked.current) return
              const { x, y, width, height } = event.nativeEvent.layout
              setHandTrayBox({ x, y, width, height })
            }}
          >
            {hand.map((c, idx) => renderHandCard(c, idx, hand.length))}
          </View>

          {renderStatusTooltip()}

          {logOpen ? (
            <View style={styles.logBox}>
              <Text style={styles.sectionTitle}>Log</Text>
              <FlatList
                data={logs}
                keyExtractor={(item, index) => `${item}-${index}`}
                renderItem={({ item }) => <Text style={styles.logText}>• {item}</Text>}
                style={{ maxHeight: 120 }}
                removeClippedSubviews
                initialNumToRender={12}
                windowSize={5}
              />
            </View>
          ) : null}
          </View>
          {renderZonesOverlay()}
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  )
}

const StatusBadge = React.memo(function StatusBadge({
  status,
  onPress,
}: {
  status: StatusInstance
  onPress: (status: StatusInstance) => void
}) {
  const iconDef = STATUS_ICON_MAP[status.id]
  const Icon = iconDef?.Icon
  const isDebuff = DEBUFF_IDS.has(status.id)
  const accent = isDebuff ? "#ff6b7a" : "#76e39c"
  const remaining = typeof status.remaining === "number" ? String(status.remaining) : null

  return (
    <Pressable onPress={() => onPress(status)} style={[styles.statusChip, { borderColor: accent }] as any}>
      {Icon ? <Icon size={16} color={accent} /> : <Text style={[styles.statusName, { color: accent }]}>{status.name}</Text>}
      {remaining ? <Text style={[styles.statusValue, { color: accent }]}>{remaining}</Text> : null}
    </Pressable>
  )
})

function StatLine({ Icon, value, max, barColor, accentColor }: { Icon: React.ComponentType<{ size?: number; color?: string }>; value: number; max: number; barColor: string; accentColor?: string }) {
  const immediate = useSharedValue(value)
  const delayed = useSharedValue(value)
  const maxValue = Math.max(1, max)

  useEffect(() => {
    immediate.value = withTiming(value, { duration: 180 * ANIM_SPEED, easing: Easing.out(Easing.quad) })
    delayed.value = withDelay(140 * ANIM_SPEED, withTiming(value, { duration: 520 * ANIM_SPEED, easing: Easing.out(Easing.cubic) }))
  }, [value, immediate, delayed])

  const immediateStyle = useAnimatedStyle(() => {
    const widthPct = interpolate(immediate.value, [0, maxValue], [0, 100])
    return { width: `${widthPct}%` }
  })

  const delayedStyle = useAnimatedStyle(() => {
    const widthPct = interpolate(delayed.value, [0, maxValue], [0, 100])
    return { width: `${widthPct}%` }
  })
  const accent = accentColor ?? barColor
  return (
    <View style={styles.statLine}>
      <View style={styles.statIconLabel}>
        <Icon size={14} color={accent} />
        <Text style={[styles.statValueText, { color: accent }]}>{Math.round(value)}</Text>
      </View>
      <View style={styles.statBarTrack}>
        <Animated.View style={[styles.statBarDelayed, delayedStyle, { backgroundColor: accent }]} />
        <Animated.View style={[styles.statBarFill, immediateStyle, { backgroundColor: barColor }]} />
      </View>
    </View>
  )
}

const HandCard = React.memo(function HandCard({
  card,
  def,
  angle,
  shiftTarget,
  isSelected,
  hasSelection,
  isAnimating,
  locked,
  cost,
  playable,
  cardAnimTarget,
  onAnimComplete,
  onSelectCard,
  onDeselectCard,
  onReleaseCard,
  onLongPressCard,
  hoverTargetSV,
  enemyLaneBoxSV,
  enemyTileBoxSV,
}: {
  card: CardInstance
  def?: CardDefinition
  index: number
  total: number
  angle: number
  shiftTarget: number
  isSelected: boolean
  hasSelection: boolean
  isAnimating: boolean
  locked: boolean
  cost: number
  playable: boolean
  cardAnimTarget?: { x: number; y: number; scale: number; opacity: number; duration: number }
  onAnimComplete: (uid: string) => void
  onSelectCard: (uid: string) => void
  onDeselectCard: () => void
  onReleaseCard: (uid: string, x: number, y: number) => void
  onLongPressCard: (def?: CardDefinition) => void
  hoverTargetSV: SharedValue<HoverTargetValue>
  enemyLaneBoxSV: SharedValue<LayoutRectangle | null>
  enemyTileBoxSV: SharedValue<LayoutRectangle | null>
}) {
  const shift = useSharedValue(shiftTarget)
  const lift = useSharedValue(0)
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const flyX = useSharedValue(0)
  const flyY = useSharedValue(0)
  const flyScale = useSharedValue(1)
  const flyOpacity = useSharedValue(1)
  const isDragging = useSharedValue(false)

  useEffect(() => {
    shift.value = withSpring(shiftTarget, { damping: 18, stiffness: 180 })
  }, [shiftTarget, shift])

  useEffect(() => {
    const target = hasSelection ? (isSelected ? 1 : -0.3) : 0
    lift.value = withTiming(target, { duration: 180 * ANIM_SPEED, easing: Easing.out(Easing.quad) })
  }, [hasSelection, isSelected, lift])

  useEffect(() => {
    if (!cardAnimTarget) return
    flyX.value = withTiming(cardAnimTarget.x, { duration: cardAnimTarget.duration, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onAnimComplete)(card.uid)
    })
    flyY.value = withTiming(cardAnimTarget.y, { duration: cardAnimTarget.duration, easing: Easing.out(Easing.cubic) })
    flyScale.value = withTiming(cardAnimTarget.scale, { duration: cardAnimTarget.duration, easing: Easing.out(Easing.quad) })
    flyOpacity.value = withTiming(cardAnimTarget.opacity, { duration: cardAnimTarget.duration, easing: Easing.out(Easing.quad) })
  }, [card.uid, cardAnimTarget, flyOpacity, flyScale, flyX, flyY, onAnimComplete])

  useEffect(() => {
    if (!cardAnimTarget) {
      flyX.value = 0
      flyY.value = 0
      flyScale.value = 1
      flyOpacity.value = 1
    }
  }, [cardAnimTarget, flyOpacity, flyScale, flyX, flyY])

  const cardStyle = useAnimatedStyle(() => {
    const liftTranslate = interpolate(lift.value, [-0.3, 0, 1], [60, 0, -26])
    const rotateValue = interpolate(lift.value, [-0.3, 0, 1], [angle, angle, 0])
    return {
      transform: [
        { translateX: shift.value + dragX.value + flyX.value },
        { translateY: liftTranslate + dragY.value + flyY.value },
        { rotate: `${rotateValue}deg` },
        { scale: flyScale.value },
      ],
      opacity: flyOpacity.value,
      zIndex: isSelected ? 20 : 1,
    }
  })

  const pan = Gesture.Pan()
    .enabled(!isAnimating)
    .onStart(() => {
      isDragging.value = true
    })
    .onUpdate((event) => {
      if (isAnimating) return
      dragX.value = event.translationX
      dragY.value = event.translationY
      const tileBox = enemyTileBoxSV.value
      const laneBox = enemyLaneBoxSV.value
      let nextHover: HoverTargetValue = 0
      if (tileBox && event.absoluteX >= tileBox.x && event.absoluteX <= tileBox.x + tileBox.width && event.absoluteY >= tileBox.y && event.absoluteY <= tileBox.y + tileBox.height) {
        nextHover = 1
      } else if (laneBox && event.absoluteX >= laneBox.x && event.absoluteX <= laneBox.x + laneBox.width && event.absoluteY >= laneBox.y && event.absoluteY <= laneBox.y + laneBox.height) {
        nextHover = 2
      }
      if (hoverTargetSV.value !== nextHover) hoverTargetSV.value = nextHover
    })
    .onEnd((event) => {
      if (isAnimating) return
      const dist = Math.abs(event.translationX) + Math.abs(event.translationY)
      dragX.value = withTiming(0, { duration: 120 * ANIM_SPEED, easing: Easing.out(Easing.quad) })
      dragY.value = withTiming(0, { duration: 120 * ANIM_SPEED, easing: Easing.out(Easing.quad) })
      if (dist < 4) {
        runOnJS(isSelected ? onDeselectCard : onSelectCard)(card.uid)
        return
      }
      runOnJS(onReleaseCard)(card.uid, event.absoluteX, event.absoluteY)
    })
    .onFinalize(() => {
      isDragging.value = false
      hoverTargetSV.value = 0
    })

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.handCard, cardStyle]}>
        <MiniCard
          name={def?.name ?? card.cardId}
          type={def?.type ?? "?"}
          cost={cost}
          selected={isSelected}
          locked={locked}
          playable={playable}
          description={def?.description ?? ""}
          onPress={() => (isSelected ? onDeselectCard() : onSelectCard(card.uid))}
          onLongPress={() => onLongPressCard(def)}
        />
      </Animated.View>
    </GestureDetector>
  )
})

const MiniCard = React.memo(function MiniCard({ name, type, cost, selected, locked, playable, description, onPress, onLongPress }: { name: string; type: string; cost: number; selected: boolean; locked: boolean; playable: boolean; description: string; onPress: () => void; onLongPress?: () => void }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={[styles.miniCard, selected ? styles.miniCardSelected : null, locked ? styles.miniCardLocked : null]}>
      <View style={[styles.cardBadge, { backgroundColor: locked ? "#5c5c68" : "#2e74ff" }]} />
      <Text style={styles.cardCost}>{locked ? "X" : cost}</Text>
      <View style={styles.cardTop}>
        <Text numberOfLines={1} style={styles.cardName}>{name}</Text>
      </View>
      <Text style={styles.cardType}>{type}</Text>
      <Text numberOfLines={3} style={styles.cardDesc}>{description}</Text>
      {locked ? <Text style={styles.cardLock}>Locked</Text> : null}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#05050b" },
  screen: { flex: 1, padding: 12, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 95},
  title: { color: "#fff", fontFamily: FACES.EXTRABOLD, fontSize: 18 },
  headerSpacer: { flex: 1 },
  ghostButton: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#111621", borderRadius: 10, borderWidth: 1, borderColor: "#1f2738" },
  ghostText: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 12 },
  debugRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  debugButton: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#111621", borderRadius: 8, borderWidth: 1, borderColor: "#1f2738" },
  debugText: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 12 },
  lanes: { flex: 1, gap: 8 },
  enemyLane: { backgroundColor: "#0b0d16", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#1a1f2f" },
  enemyTile: { marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#21283b", backgroundColor: "#0f1220", gap: 6, alignItems: "center" },
  enemyTileDim: { borderColor: "#32547f", backgroundColor: "#0d1424", shadowColor: "#32547f", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  enemyTileActive: { borderColor: "#7be0ff", backgroundColor: "#13263d", shadowColor: "#7be0ff", shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  enemyCanvas: { width: 110, height: 110, borderRadius: 12, alignSelf: "center" },
  enemyName: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 14, textAlign: "center" },
  playerLane: { backgroundColor: "#0b0d16", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#1a1f2f" },
  playerCard: { gap: 1 },
  sectionTitle: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 14 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "center" },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "#1f273a", backgroundColor: "#0f1220", marginRight: 6 },
  statusValue: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 12 },
  statusName: { color: "#9aa1b5", fontFamily: FACES.REGULAR, fontSize: 10 },
  statLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  statIconLabel: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 35 },
  statValueText: { fontFamily: FACES.BOLD, fontSize: 11 },
  statBarTrack: { flex: 1, height: 10, borderRadius: 3, backgroundColor: "#0d101c" },
  statBarDelayed: { position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 3, opacity: 0.4 },
  statBarFill: { height: "100%", borderRadius: 3 },
  zoneControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  zoneSpacer: { flex: 1 },
  energyCounter: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#1f2738", backgroundColor: "#0d101c" },
  energyValue: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 12 },
  cardStackButton: { width: 42, height: 62, borderRadius: 14, borderWidth: 1, borderColor: "#1f2738", backgroundColor: "#0b0d16", alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  deckButton: { borderColor: "#2e74ff" },
  discardButton: { borderColor: "#ff6b7a" },
  deckButtonCount: { color: "#7be0ff", fontFamily: FACES.BOLD, fontSize: 14 },
  discardButtonCount: { color: "#ff9aa8", fontFamily: FACES.BOLD, fontSize: 14 },
  endTurnButton: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#243150", borderRadius: 10 },
  endTurnText: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 12 },
  buttonDisabled: { opacity: 0.4 },
  /* tooltipStrip removed; long-press on cards opens tooltip */
  handTray: { height: 240, justifyContent: "flex-end", alignItems: "center" },
  handCard: { position: "absolute", bottom: -10, width: 140, height: 190, alignItems: "center" },
  miniCard: { width: 140, height: 180, borderRadius: 14, overflow: "hidden", padding: 10, gap: 6, borderWidth: 1, borderColor: "#1f2738", backgroundColor: "#0d101c" },
  miniCardSelected: { borderColor: "#4ea1ff", shadowColor: "#4ea1ff", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  miniCardLocked: { opacity: 0.6 },
  cardBadge: { position: "absolute", top: 10, left: 10, width: 24, height: 24, borderRadius: 8 },
  cardCost: { position: "absolute", top: 12, left: 16, color: "#fff", fontFamily: FACES.EXTRABOLD, fontSize: 14 },
  cardTop: { paddingTop: 8 },
  cardName: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 13, marginLeft: 30, marginTop: -5 },
  cardType: { color: "#9aa1b5", fontFamily: FACES.BOLD, fontSize: 11 },
  cardDesc: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 11 },
  cardLock: { color: "#ff8a8a", fontFamily: FACES.BOLD, fontSize: 11 },
  cardHint: { color: "#7aa6ff", fontFamily: FACES.BOLD, fontSize: 10 },
  logBox: { backgroundColor: "#0b0d16", borderRadius: 12, borderWidth: 1, borderColor: "#1a1f2f", padding: 10, gap: 4 },
  logText: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 11 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 20 },
  overlayCard: { width: Dimensions.get("window").width - 60, backgroundColor: "#0b0d16", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1f2738", gap: 8, zIndex: 10000, elevation: 21 },
  overlayTitle: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 16 },
  overlayRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#161b2a" },
  overlayText: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 12 },
  overlayMeta: { color: "#9aa1b5", fontFamily: FACES.REGULAR, fontSize: 11 },
  tooltipOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  statusTooltip: { minWidth: 220, maxWidth: 360, backgroundColor: "#0b0d16", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#1a1f2f" },
  tooltipName: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 13, marginBottom: 6 },
  tooltipDesc: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 12 },
})
