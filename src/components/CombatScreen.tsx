import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Dimensions,
  FlatList,
  ScrollView,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native"
import { Canvas, Image as SkiaImage, useImage, Skia, FilterMode, MipmapMode } from "@shopify/react-native-skia"
import Animated, {
  Easing,
  Extrapolate,
  FadeInUp,
  FadeOutDown,
  Layout,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  type SharedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  withDecay,
} from "react-native-reanimated"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import { Feather } from "@expo/vector-icons"
import CombatantTile from "./CombatantTile"
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
import { getCardLibraryMap, getCardTargetType } from "@shared/game/services/cardLibrary"
import fontConfig from "@shared/utils/fontConfig"
import { STATUS_ICON_MAP, STAT_ICONS } from "@shared/utils/ui"
const FACES = fontConfig.fontFaceNames()

const ANIM_SPEED = 1.5

const STAT_ACCENT = "#7bb5ff"

const CARD_WIDTH = 140
const CARD_HEIGHT = 190
const HAND_STEP_PX = 50
const HAND_LEFT_SPACING = 70
const HAND_RIGHT_SPACING = 70
const HAND_CENTER_GAP = 36
const HAND_BUNCH_SPACING = 56
const HAND_RAISE_Y = -16
const QUICK_SWIPE_VELOCITY = 1200
const QUICK_SWIPE_DISTANCE = 240
const PLAY_ACTIVATION_Y = -120
const ITEM_SPACING = CARD_WIDTH - 48
// bias values (px) to shift left/right clamp limits (DO NOT CHANGE)
const HAND_LEFT_BIAS = 90 // move left limit this many px to the right
const HAND_RIGHT_BIAS = -80 // extend right limit this many px to the right
const HAND_VISUAL_CENTER_BIAS = -160 // visual center bias: positive moves the apparent center to the right

const DISCARD_CASCADE_STAGGER = 60
const DISCARD_CASCADE_DURATION = 260
const DRAW_CASCADE_STAGGER = 60
const DRAW_CASCADE_DURATION = 320

const enemyPlaceholder = require("../assets/icon_default.png")

const clampIndex = (index: number, count: number) => {
  "worklet"
  return Math.max(0, Math.min(count - 1, index))
}

const getCardOffset = (index: number, selectedIndex: number) => {
  "worklet"
  if (selectedIndex < 0) return 0
  if (index === selectedIndex) return 0
  if (index < selectedIndex) {
    return (index - selectedIndex) * HAND_LEFT_SPACING - HAND_CENTER_GAP
  }
  return (index - selectedIndex) * HAND_RIGHT_SPACING + HAND_CENTER_GAP
}

const clampLinearOffset = (offset: number, count: number, leftBias = 0, rightBias = 0) => {
  "worklet"
  if (!count || count <= 1) return 0
  const centerIndex = Math.max(0, Math.floor((count - 1) / 2))
  const max = centerIndex * HAND_BUNCH_SPACING + rightBias
  const min = -((count - 1 - centerIndex) * HAND_BUNCH_SPACING) + leftBias
  return Math.max(min, Math.min(max, offset))
}

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList)

/*

changes (TBA):
- remove "drag and drop to play" mechanic
  - drag left/right to scroll hand
  - slide up to play card
  - long-press to open tooltip
- hand movement & animations
  - selected card
    - raised up slightly
    - always snapped to the middle of the screen
    - always rendered on top of other cards
    - blue border
    - when clicked, nothing
    - when click + hold and drag up, card follows finger
    - when click + hold and drag left/right, hand scrolls
  - unselected cards
    - when clicked, selection transfers to that card, and hand scrolls until that card is in middle position
    - when click + hold and drag up, nothing
    - when click + hold and drag left/right, hand scrolls
    - unselected cards to the left bunch up to the left
    - unselected cards to the right bunch up to the right, with spacing to make room for selected card
  - middle card will always be selected
    - as you scroll left/right, the card that comes into the middle position becomes selected automatically
    - hand scroll is not linear
      - instead, is based on distance traveled from point of initial touch
      - ex: only move and select next card when finger has moved 50px left/right, then go to the next card if moved by another 50px, etc.
      - if a quick swipe is done
        - deselect current card, hand should now be one group of bunched up cards
        - the hand moves smoothly to the swipe direction without selecting cards
        - only select the middle card when swiping stops and hand settles

*/

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
type ZonesOverlay = "deck" | "discard" | null
type HandAnimMode = "none" | "discard" | "draw"

const cardCost = (card: CardInstance, def: CardDefinition) => Math.max(0, card.temporaryCost ?? def.cost)

const DEBUFF_IDS = new Set(["skip_next_turn", "hand_size_minus_one", "blood_tax"])

const findFirstAliveEnemyIndex = (enemies: CombatState["enemies"]) => {
  const index = enemies.findIndex((enemy) => enemy.hp > 0)
  return index >= 0 ? index : null
}

export default function CombatScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state: gameState } = useGame()
  const [combat, setCombat] = useState<CombatState | null>(null)
  const [phase, setPhase] = useState<Phase>("player")
  const [enemyAiIndex, setEnemyAiIndex] = useState(0)
  const [enemyCount, setEnemyCount] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedEnemyIndex, setSelectedEnemyIndex] = useState<number | null>(0)
  const [message, setMessage] = useState<string | null>(null)
  const [zonesOpen, setZonesOpen] = useState<ZonesOverlay>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [handAnimMode, setHandAnimMode] = useState<HandAnimMode>("none")
  const [handDisplay, setHandDisplay] = useState<CardInstance[]>([])
  const deckCountScale = useSharedValue(1)
  const discardCountScale = useSharedValue(1)
  const handScrollX = useSharedValue(0)
  const selectedIndexSV = useSharedValue(0)
  const handCountSV = useSharedValue(0)
  const handStartIndexSV = useSharedValue(0)
  const isHandDraggingSV = useSharedValue(false)
  const isScrollModeSV = useSharedValue(false)
  const handLinearOffsetSV = useSharedValue(0)
  const handFlatScrollXSV = useSharedValue(0)
  const handLinearStartOffsetSV = useSharedValue(0)
  const scrollRef = useRef<any>(null)
  const [nativeScrollEnabled, setNativeScrollEnabled] = useState(true)
  const screenCenterX = useMemo(() => Dimensions.get("window").width / 2 - CARD_WIDTH / 2, [])
  const handRef = useRef<CardInstance[]>([])
  const linearIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cascadeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const cardMap = useMemo(() => getCardLibraryMap(), [])

  // Skia image + paint for crisp pixel-art rendering (nearest-neighbor for pixel art)
  const enemySkiaImg = useImage(require("../assets/icon_default.png"))
  const nearestPaint = useMemo(() => {
    try {
      const p = Skia.Paint()
      if (p.setFilterMode) p.setFilterMode(Skia.FilterMode.Nearest)
      if (p.setMipmapMode) p.setMipmapMode(Skia.MipmapMode.None)
      return p
    } catch (e) {
      return undefined
    }
  }, [])

  const deriveDeck = () => {
    const equipped = (gameState as any)?.derivedLoadout?.equippedCards ?? []
    const valid = equipped.filter((id: string) => cardMap[id])
    return valid.length ? valid : STARTER_DECK
  }

  const clearCascadeTimers = useCallback(() => {
    if (cascadeTimersRef.current.length) {
      cascadeTimersRef.current.forEach((timer) => clearTimeout(timer))
      cascadeTimersRef.current = []
    }
  }, [])

  const scheduleCascadeTimer = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(fn, ms)
    cascadeTimersRef.current.push(timer)
    return timer
  }, [])


  const resetCombat = () => {
    const skills = (gameState as any)?.player?.skills ?? DEFAULT_SKILLS
    const deckIds = deriveDeck()
    const enemies = Array.from({ length: Math.max(1, Math.min(enemyCount, 3)) }, () => ({ hp: 100, maxHP: 100, skills }))
    const cs = createCombatState(
      {
        player: { hp: 100, maxHP: 100, skills },
        enemy: enemies[0],
        enemies,
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
    setHandAnimMode("none")
    setHandDisplay(next.zones.hand)
    const mid = Math.max(0, Math.floor(next.zones.hand.length / 2))
    selectedIndexSV.value = mid
    handScrollX.value = 0
    isScrollModeSV.value = false
    handLinearOffsetSV.value = 0
    clearLinearIdleTimer()
    setSelected(next.zones.hand[mid]?.uid ?? null)
    setSelectedEnemyIndex(findFirstAliveEnemyIndex(next.enemies))
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
      setHandAnimMode("none")
      setHandDisplay([])
      clearCascadeTimers()
      clearLinearIdleTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => () => clearCascadeTimers(), [clearCascadeTimers])

  const updateLaneBoxes = () => {
    // no-op (drag/drop targeting removed)
  }

  const setSelectedByIndex = useCallback((index: number) => {
    const next = handRef.current[index]
    setSelected(next ? next.uid : null)
  }, [])

  useAnimatedReaction(
    () => selectedIndexSV.value,
    (value, prev) => {
      if (value === prev) return
      if (value < 0) {
        runOnJS(setSelected)(null)
        return
      }
      runOnJS(setSelectedByIndex)(value)
    },
  )

  const clearLinearIdleTimer = useCallback(() => {
    if (linearIdleTimerRef.current) {
      clearTimeout(linearIdleTimerRef.current)
      linearIdleTimerRef.current = null
    }
  }, [])

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const count = handCountSV.value
      if (!count || count <= 0) {
        handLinearOffsetSV.value = 0
        return
      }
      const centerIndex = Math.max(0, Math.floor((count - 1) / 2))
      const max = centerIndex * HAND_BUNCH_SPACING
      const x = event.contentOffset.x
      handLinearOffsetSV.value = clampLinearOffset(max - x, count, HAND_LEFT_BIAS, HAND_RIGHT_BIAS)
    },
    onMomentumEnd: () => {
      runOnJS(scheduleLinearExit)()
      runOnJS(setNativeScrollEnabled)(true)
    },
    onEndDrag: () => {
      runOnJS(scheduleLinearExit)()
    },
  })

  const flatListScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      handFlatScrollXSV.value = event.contentOffset.x
    },
  })

  useAnimatedReaction(
    () => handFlatScrollXSV.value,
    (value, prev) => {
      if (value === prev) return
      const count = handCountSV.value
      if (!count || count <= 0) return
      const center = value + screenCenterX + HAND_VISUAL_CENTER_BIAS
      const raw = Math.round(center / ITEM_SPACING)
      const idx = Math.max(0, Math.min(count - 1, raw))
      // update selected on JS thread
      runOnJS(setSelectedByIndex)(idx)
      selectedIndexSV.value = idx
    },
  )

  const finalizeLinearExit = useCallback((index: number) => {
    setTimeout(() => {
      selectedIndexSV.value = index
      isScrollModeSV.value = false
    }, 1000)
  }, [isScrollModeSV, selectedIndexSV])

  const exitLinearMode = useCallback((index?: number) => {
    let nextIndex: number
    if (typeof index === "number") {
      nextIndex = index
    } else {
      const count = handCountSV.value
      if (!count || count <= 0) {
        nextIndex = 0
      } else {
        const centerIndex = Math.max(0, Math.floor((count - 1) / 2))
        const raw = centerIndex - handLinearOffsetSV.value / HAND_BUNCH_SPACING
        nextIndex = Math.max(0, Math.min(count - 1, Math.round(raw)))
      }
    }
    handLinearOffsetSV.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        runOnJS(finalizeLinearExit)(nextIndex)
      }
    })
  }, [finalizeLinearExit, handLinearOffsetSV])

  const scheduleLinearExit = useCallback(() => {
    clearLinearIdleTimer()
    linearIdleTimerRef.current = setTimeout(() => {
      exitLinearMode()
    }, 2000)
  }, [clearLinearIdleTimer, exitLinearMode])

  useEffect(() => {
    if (!combat) return
    if (handAnimMode !== "none") return
    setHandDisplay(combat.zones.hand)
  }, [combat, handAnimMode])

  const hand = handDisplay
  const middleIndex = Math.max(0, Math.floor(hand.length / 2))
  useEffect(() => {
    handRef.current = hand
    handCountSV.value = hand.length
    if (hand.length === 0) {
      selectedIndexSV.value = 0
      setSelected(null)
      return
    }
    if (selectedIndexSV.value < 0 || selectedIndexSV.value >= hand.length) {
      selectedIndexSV.value = middleIndex
      setSelectedByIndex(middleIndex)
    }
  }, [hand, handCountSV, middleIndex, selectedIndexSV, setSelectedByIndex])
  const selectedCard = combat ? combat.zones.hand.find((c) => c.uid === selected) : null
  const selectedDef = selectedCard ? cardMap[selectedCard.cardId] : undefined
  const selectedTargetType = getCardTargetType(selectedDef)
  const isPlayerHighlighted = selectedTargetType === "self"
  const playable = combat && selectedCard && selectedDef && phase === "player" && combat.energy >= cardCost(selectedCard, selectedDef)

  useEffect(() => {
    if (!combat) return
    if (selectedTargetType !== "enemySingle") return
    const nextIndex = findFirstAliveEnemyIndex(combat.enemies)
    if (nextIndex === null) {
      setSelectedEnemyIndex(null)
      return
    }
    if (selectedEnemyIndex === null || combat.enemies[selectedEnemyIndex]?.hp <= 0) {
      setSelectedEnemyIndex(nextIndex)
    }
  }, [combat, selectedEnemyIndex, selectedTargetType])

  const onPlayCard = useCallback((uid: string, target?: { side: "enemy" | "player"; index?: number }) => {
    if (handAnimMode !== "none") return
    if (!combat) return
    const located = combat.zones.hand.find((c) => c.uid === uid)
    if (!located) return
    const def = cardMap[located.cardId]
    if (!def) return
    if (phase !== "player") {
      setMessage("Enemy turn")
      return
    }
    const targetType = getCardTargetType(def)
    const resolvedTarget = (() => {
      if (targetType === "self") return { side: "player" as const }
      if (targetType === "enemySingle") {
        if (selectedEnemyIndex === null) return null
        const enemy = combat.enemies[selectedEnemyIndex]
        if (!enemy || enemy.hp <= 0) return null
        return { side: "enemy" as const, index: selectedEnemyIndex }
      }
      if (targetType === "enemiesAll") return { side: "enemy" as const }
      return target ?? { side: "enemy" as const }
    })()
    if (!resolvedTarget) {
      setMessage("No valid target")
      return
    }
    const enemyHpBefore = combat.enemies.reduce((sum, enemy) => sum + enemy.hp, 0)
    const res = playCard(combat, { cardInstanceId: located.uid, target: resolvedTarget })
    if (!res.ok) {
      setMessage(res.reason)
      return
    }
    const enemyHpAfter = res.state.enemies.reduce((sum, enemy) => sum + enemy.hp, 0)
    const damage = enemyHpBefore - enemyHpAfter
    if (damage > 0) setLogs((prev) => [...prev, `Dealt ${damage}`].slice(-60))
    setCombat(res.state)
    setMessage(null)
  }, [cardMap, combat, handAnimMode, phase, selectedEnemyIndex])

  const computeEnemyPhase = useCallback((state: CombatState) => {
    const enemyCycle = ["aimed_shot", "smoke_screen"]
    const enemyCardId = enemyCycle[enemyAiIndex % enemyCycle.length]
    let next = applyEnemyCard(state, enemyCardId)
    setLogs((prev) => [...prev, `Enemy used ${cardMap[enemyCardId]?.name ?? enemyCardId}`].slice(-60))
    setEnemyAiIndex((idx) => (idx + 1) % enemyCycle.length)
    next = startTurn(next)
    return next
  }, [cardMap, enemyAiIndex])

  const onEndTurn = () => {
    if (!combat) return
    if (handAnimMode !== "none") return

    const currentHand = combat.zones.hand
    const discardTotal = currentHand.length > 0
      ? DISCARD_CASCADE_DURATION + DISCARD_CASCADE_STAGGER * Math.max(0, currentHand.length - 1)
      : 0

    const runEnemyAndDraw = () => {
      const endState = endTurn(combat)
      setPhase("enemy")
      setMessage("Enemy phase")
      const nextState = computeEnemyPhase(endState)
      setCombat(nextState)
      setPhase("player")
      setMessage("Player phase")

      const nextHand = nextState.zones.hand
      setHandAnimMode("draw")
      setHandDisplay(nextHand)
      const drawTotal = nextHand.length > 0
        ? DRAW_CASCADE_DURATION + DRAW_CASCADE_STAGGER * Math.max(0, nextHand.length - 1)
        : 0
      scheduleCascadeTimer(() => {
        setHandAnimMode("none")
        setNativeScrollEnabled(true)
      }, drawTotal)
    }

    if (currentHand.length > 0) {
      clearCascadeTimers()
      setHandAnimMode("discard")
      setNativeScrollEnabled(false)
      setHandDisplay(currentHand)
      // trigger exit animations immediately
      scheduleCascadeTimer(() => setHandDisplay([]), 0)
      scheduleCascadeTimer(runEnemyAndDraw, discardTotal)
      return
    }

    runEnemyAndDraw()
  }

  // hold-to-confirm shared value + helper
  const endHoldProgress = useSharedValue(0)
  const endHoldConfirmedRef = useRef(false)
  const handleEndHoldStart = useCallback(() => {
    if (phase !== "player") return
    endHoldConfirmedRef.current = false
    endHoldProgress.value = withTiming(1, { duration: 500, easing: Easing.linear }, (finished) => {
      if (finished) {
        endHoldConfirmedRef.current = true
        runOnJS(onEndTurn)()
      }
    })
  }, [endHoldProgress, onEndTurn, phase])
  const handleEndHoldEnd = useCallback(() => {
    if (endHoldConfirmedRef.current) {
      endHoldProgress.value = withTiming(0, { duration: 180 })
      endHoldConfirmedRef.current = false
      return
    }
    endHoldProgress.value = withTiming(0, { duration: 180 })
  }, [endHoldProgress])

  const deckCountStyle = useAnimatedStyle(() => ({
    transform: [{ scale: deckCountScale.value }],
  }))

  const discardCountStyle = useAnimatedStyle(() => ({
    transform: [{ scale: discardCountScale.value }],
  }))

  const endFillStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: `${endHoldProgress.value * 100}%`,
    backgroundColor: "rgba(80,140,220,0.28)",
    borderRadius: 10,
  }))

  const counts = combat
    ? {
        deck: combat.zones.deck.length,
        hand: combat.zones.hand.length,
        discard: combat.zones.discard.length,
        exhaust: combat.zones.exhaust.length,
      }
    : { deck: 0, hand: 0, discard: 0, exhaust: 0 }

  useEffect(() => {
    deckCountScale.value = withTiming(1.15, { duration: 120 * ANIM_SPEED, easing: Easing.out(Easing.quad) }, () => {
      deckCountScale.value = withTiming(1, { duration: 140 * ANIM_SPEED, easing: Easing.inOut(Easing.quad) })
    })
  }, [counts.deck, deckCountScale])

  useEffect(() => {
    discardCountScale.value = withTiming(1.15, { duration: 120 * ANIM_SPEED, easing: Easing.out(Easing.quad) }, () => {
      discardCountScale.value = withTiming(1, { duration: 140 * ANIM_SPEED, easing: Easing.inOut(Easing.quad) })
    })
  }, [counts.discard, counts.exhaust, discardCountScale])

  
  const focusIndex = useCallback((index: number) => {
    if (hand.length === 0) return
    const targetOffset = index * ITEM_SPACING - (screenCenterX + HAND_VISUAL_CENTER_BIAS)
    if (Math.abs(handFlatScrollXSV.value - targetOffset) < 1) {
      selectedIndexSV.value = index
      setSelectedByIndex(index)
      return
    }
    if (!scrollRef.current) return
    scrollRef.current.scrollToOffset({ offset: targetOffset, animated: true })
  }, [hand.length, screenCenterX, setSelectedByIndex, handFlatScrollXSV, selectedIndexSV])

  const handleSelectCard = useCallback((uid: string, index: number) => {
    if (handAnimMode !== "none") return
    setTooltipPayload(null)
    if (isScrollModeSV.value) {
      // immediate exit from scroll mode: cancel idle timer, disable scroll mode,
      // animate offset back to neutral and center the tapped card.
      clearLinearIdleTimer()
      isScrollModeSV.value = false
      handLinearOffsetSV.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) })
      focusIndex(index)
      return
    }
    if (selected === uid) return
    focusIndex(index)
  }, [clearLinearIdleTimer, focusIndex, handAnimMode, isScrollModeSV, selected])


  const handleLongPressCard = useCallback((def?: CardDefinition) => {
    if (def) setTooltipPayload({ kind: "card", def })
  }, [])

  const handPan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-20, 20])
    .onStart(() => {
      isHandDraggingSV.value = true
      runOnJS(clearLinearIdleTimer)()
      // disable native scroll while manual hand pan begins
      runOnJS(setNativeScrollEnabled)(false)
      if (isScrollModeSV.value) {
        handLinearStartOffsetSV.value = handLinearOffsetSV.value
        return
      }
      const fallback = Math.max(0, Math.floor(handCountSV.value / 2))
      handStartIndexSV.value = selectedIndexSV.value >= 0 ? selectedIndexSV.value : fallback
    })
    .onUpdate((event) => {
      const count = handCountSV.value
      if (count <= 0) return
      if (isScrollModeSV.value) {
        handLinearOffsetSV.value = clampLinearOffset(handLinearStartOffsetSV.value + event.translationX, handCountSV.value, HAND_LEFT_BIAS, HAND_RIGHT_BIAS)
        return
      }
      const step = Math.trunc(event.translationX / HAND_STEP_PX)
      const nextIndex = clampIndex(handStartIndexSV.value - step, count)
      if (selectedIndexSV.value !== nextIndex) {
        selectedIndexSV.value = nextIndex
      }
      handScrollX.value = event.translationX - step * HAND_STEP_PX
    })
    .onEnd((event) => {
      isHandDraggingSV.value = false
      // re-enable native scroll when manual pan ends
      runOnJS(setNativeScrollEnabled)(true)
      if (isScrollModeSV.value) {
        // clamp current position then schedule auto-exit
        handLinearOffsetSV.value = clampLinearOffset(handLinearOffsetSV.value, handCountSV.value, HAND_LEFT_BIAS, HAND_RIGHT_BIAS)
        runOnJS(scheduleLinearExit)()
        return
      }
      const velocity = event.velocityX
      if (Math.abs(velocity) > QUICK_SWIPE_VELOCITY) {
        // enter scroll (momentum) mode — use decay for natural momentum
        isScrollModeSV.value = true
        selectedIndexSV.value = -1
        handLinearStartOffsetSV.value = handLinearOffsetSV.value
        const count = handCountSV.value
        const centerIndex = Math.max(0, Math.floor((count - 1) / 2))
        const max = centerIndex * HAND_BUNCH_SPACING + HAND_RIGHT_BIAS
        const min = -((count - 1 - centerIndex) * HAND_BUNCH_SPACING) + HAND_LEFT_BIAS
        handLinearOffsetSV.value = withDecay(
          { velocity: event.velocityX, deceleration: 0.998, clamp: [min, max] },
          (finished) => {
            if (finished) runOnJS(scheduleLinearExit)()
          },
        )
        return
      }
      handScrollX.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) })
    }),
  [clearLinearIdleTimer, handCountSV, handLinearOffsetSV, handLinearStartOffsetSV, handScrollX, handStartIndexSV, isHandDraggingSV, isScrollModeSV, scheduleLinearExit, selectedIndexSV])
  
  

  const handleStatusPress = useCallback((status: StatusInstance) => {
    setTooltipPayload({ kind: "status", status })
  }, [])

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
                setCombat((prev) => {
                  if (!prev) return prev
                  const enemies = prev.enemies.map((enemy) => ({ ...enemy, hp: enemy.maxHP, shield: 0 }))
                  return { ...prev, enemies, enemy: enemies[0] }
                })
              }}
            >
              <Text style={styles.debugText}>Reset Enemy HP</Text>
            </Pressable>
            <Pressable
              style={styles.debugButton}
              onPress={() => setEnemyCount((count) => (count % 3) + 1)}
            >
              <Text style={styles.debugText}>Enemies: {enemyCount}</Text>
            </Pressable>
            <Pressable style={styles.debugButton} onPress={() => setZonesOpen("deck")}>
              <Text style={styles.debugText}>Deck ({counts.deck})</Text>
            </Pressable>
            <Pressable style={styles.debugButton} onPress={() => setZonesOpen("discard")}>
              <Text style={styles.debugText}>Discard {counts.discard}|{counts.exhaust}</Text>
            </Pressable>
          </View>

          <View style={styles.lanes}>
            <View style={styles.enemyRow}>
              {combat.enemies.map((enemy, index) => {
                const isAlive = enemy.hp > 0
                const isSelected = selectedTargetType === "enemySingle" && selectedEnemyIndex === index
                const isHighlighted = selectedTargetType === "enemiesAll" ? isAlive : isSelected
                return (
                  <CombatantTile
                    key={`enemy-${index}`}
                    pressable
                    onPress={() => {
                      if (!isAlive) return
                      if (phase === "player" && selectedTargetType === "enemySingle") {
                        setSelectedEnemyIndex(index)
                      }
                    }}
                    baseStyle={styles.enemyTile}
                    stretchStyle={styles.enemyTileStretch}
                    dimStyle={selected ? styles.enemyTileDim : null}
                    activeStyle={isHighlighted ? styles.enemyTileActive : null}
                    deadStyle={!isAlive ? styles.enemyTileDead : null}
                    topNode={(
                      <View style={styles.enemyTop}>
                        <View style={styles.enemyPortraitFrame}>
                          {enemySkiaImg ? (
                            <Canvas style={{ width: 110, height: 110 }}>
                              <SkiaImage
                                image={enemySkiaImg}
                                x={20}
                                y={20}
                                width={70}
                                height={70}
                                paint={nearestPaint}
                                fit="contain"
                                sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                              />
                            </Canvas>
                          ) : (
                            <Image source={enemyPlaceholder} style={styles.enemyPortrait} resizeMode="contain" />
                          )}
                        </View>
                        <Text style={styles.enemyName}>Dummy</Text>
                      </View>
                    )}
                    statsNode={(
                      <View style={styles.enemyBottom}>
                        <View style={styles.statsStack}>
                          <StatLine Icon={STAT_ICONS.health} value={enemy.hp} max={enemy.maxHP} barColor="#ff6b7a" accentColor={STAT_ACCENT} />
                          <StatLine Icon={STAT_ICONS.shield} value={enemy.shield ?? 0} max={40} barColor="#66d1ff" accentColor={STAT_ACCENT} />
                          <View style={styles.statusRow}>
                            {(enemy.statuses ?? []).map((status) => (
                              <StatusBadge key={`${status.id}-${status.remaining}`} status={status} onPress={handleStatusPress} />
                            ))}
                          </View>
                        </View>
                      </View>
                    )}
                  />
                )
              })}
            </View>

      {/* energy counter removed from here; End Turn button moved into player info panel */}
                    <CombatantTile
                      pressable={false}
                      baseStyle={styles.playerTile}
                      stretchStyle={styles.enemyTileStretch}
                      activeStyle={isPlayerHighlighted ? styles.playerTileActive : null}
                      statsNode={(
                        <View style={styles.statsStack}>
                          <StatLine Icon={STAT_ICONS.health} value={combat.player.hp} max={combat.player.maxHP} barColor="#76e39c" accentColor={STAT_ACCENT} />
                          <StatLine Icon={STAT_ICONS.shield} value={combat.player.shield ?? 0} max={40} barColor="#66d1ff" accentColor={STAT_ACCENT} />
                          <View style={styles.statusRow}>
                            {(combat.player.statuses ?? []).map((status) => (
                              <StatusBadge key={`${status.id}-${status.remaining}`} status={status} onPress={handleStatusPress} />
                            ))}
                          </View>
                        </View>
                      )}
                      rightSlot={(
                        <Pressable
                          style={[styles.endTurnButton, phase !== "player" && styles.buttonDisabled]}
                          onPressIn={handleEndHoldStart}
                          onPressOut={handleEndHoldEnd}
                          disabled={phase !== "player"}
                        >
                          <View style={styles.endTurnInner}>
                            <Animated.View style={endFillStyle} />
                            <Text style={styles.endTurnText}>End Turn</Text>
                          </View>
                        </Pressable>
                      )}
                    />
          </View>

          {/* helper strip removed: use long-press on cards to open tooltip */}

          {/* Animated FlatList hand: combines FlatList momentum with per-card transforms for bunching/overlap */}
          <View style={styles.handTray}>
            <AnimatedFlatList
              data={hand as CardInstance[]}
              horizontal
              keyExtractor={(item) => (item as CardInstance).uid}
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              // prevent Android/FlatList from clipping transformed children
              removeClippedSubviews={false}
              style={{ overflow: "visible" }}
              contentContainerStyle={{ paddingLeft: screenCenterX + HAND_LEFT_BIAS, paddingRight: screenCenterX + HAND_RIGHT_BIAS, overflow: "visible" }}
              onLayout={() => { /* nothing */ }}
              onScroll={flatListScrollHandler}
              renderItem={({ item, index }) => {
                const card = item as CardInstance
                const def = cardMap[card.cardId]
                const locked = def ? def.tags.some((t) => combat?.tagLocks.includes(t) ?? false) : false
                const cost = def ? cardCost(card, def) : 0
                const canPlay = !!playable && selected === card.uid
                return (
                  <HandFlatItem
                    item={card}
                    index={index}
                    def={def}
                    cost={cost}
                    locked={locked}
                    selected={selected === card.uid}
                    canPlay={canPlay}
                      onSelect={(uid, idx) => handleSelectCard(uid, idx)}
                      onLongPress={() => setTooltipPayload({ kind: "card", def })}
                      onPlay={(uid) => onPlayCard(uid)}
                      onToggleNativeScroll={setNativeScrollEnabled}
                    cascadeMode={handAnimMode}
                    handFlatScrollXSV={handFlatScrollXSV}
                    screenCenterX={screenCenterX}
                  />
                )
              }}
              // keep snapping and momentum smooth by using native driver on scroll
              scrollEventThrottle={16}
              // attach an imperative scroll listener to update shared value used by animatedStyle
              ref={scrollRef}
            />

            {/* Deck / Discard overlay to the left of the hand */}
            <View style={styles.handControlsOverlay} pointerEvents="box-none">
              <Pressable style={[styles.handControlButton, styles.deckButton]} onPress={() => setZonesOpen("deck") }>
                <Animated.View style={[deckCountStyle, styles.handControlInner]}>
                  <Text style={styles.deckButtonCount}>{counts.deck}</Text>
                </Animated.View>
              </Pressable>

              <Pressable style={[styles.handControlButton, styles.discardButton]} onPress={() => setZonesOpen("discard") }>
                <Animated.View style={[discardCountStyle, styles.handControlInner]}>
                  <Text style={styles.discardButtonCount}>{counts.discard}|{counts.exhaust}</Text>
                </Animated.View>
              </Pressable>

              <View style={[styles.handControlButton, styles.energyControl]}>
                <View style={styles.handControlInner}>
                  <Feather name="zap" size={18} color="#7be0ff" />
                  <Text style={styles.energyValueSmall}>{combat.energy}/{combat.config.energyPerTurn}</Text>
                </View>
              </View>
            </View>
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

const HandFlatItem = React.memo(function HandFlatItem({
  item,
  index,
  def,
  cost,
  locked,
  selected,
  canPlay,
  onSelect,
  onLongPress,
  onPlay,
  onToggleNativeScroll,
  cascadeMode,
  handFlatScrollXSV,
  screenCenterX,
}: {
  item: CardInstance
  index: number
  def?: CardDefinition
  cost: number
  locked: boolean
  selected: boolean
  canPlay: boolean
  onSelect: (uid: string, index: number) => void
  onLongPress: () => void
  onPlay?: (uid: string) => void
  onToggleNativeScroll?: (enabled: boolean) => void
  cascadeMode: HandAnimMode
  handFlatScrollXSV: SharedValue<number>
  screenCenterX: number
}) {
  const dragY = useSharedValue(0)
  const pan = Gesture.Pan()
    .enabled(selected)
    .activeOffsetY([-10, 10])
    .failOffsetX([-20, 20])
    .onStart(() => {
      if (onToggleNativeScroll) runOnJS(onToggleNativeScroll)(false)
      dragY.value = 0
    })
    .onUpdate((event) => {
      // only vertical dragging when selected
      dragY.value = Math.max(event.translationY, PLAY_ACTIVATION_Y)
    })
    .onEnd((event) => {
      if (onToggleNativeScroll) runOnJS(onToggleNativeScroll)(true)
      const shouldPlay = canPlay && event.translationY <= PLAY_ACTIVATION_Y && Math.abs(event.translationY) > Math.abs(event.translationX)
      if (shouldPlay && onPlay) {
        dragY.value = withTiming(PLAY_ACTIVATION_Y, { duration: 160, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(onPlay)(item.uid)
        })
      } else {
        dragY.value = withSpring(0, { damping: 20, stiffness: 300, mass: 1 })
      }
    })
  const itemSpacing = ITEM_SPACING
  const style = useAnimatedStyle(() => {
    const scrollX = handFlatScrollXSV.value
    const itemCenter = index * itemSpacing
    const centerOffset = itemCenter - scrollX
    const distance = centerOffset - (screenCenterX + HAND_VISUAL_CENTER_BIAS)
    const absDist = Math.min(Math.abs(distance), 600)
    const scale = interpolate(absDist, [0, 300, 600], [1.06, 0.98, 0.92])
    const baseTranslateY = interpolate(absDist, [0, 300, 600], [-18, -6, 0])
    const rotateDeg = interpolate(distance, [-600, 0, 600], [-6, 0, 6])
    const z = Math.round(1000 - absDist)
    const opacity = canPlay
      ? interpolate(dragY.value, [0, PLAY_ACTIVATION_Y], [1, 0], Extrapolate.CLAMP)
      : 1
    return {
      transform: [
        { translateY: dragY.value + baseTranslateY },
        { scale },
        { rotate: `${rotateDeg}deg` },
      ],
      zIndex: z,
      opacity,
    }
  })

  const entering = cascadeMode === "draw"
    ? FadeInUp.delay(index * DRAW_CASCADE_STAGGER).duration(DRAW_CASCADE_DURATION)
    : undefined
  const exiting = cascadeMode === "discard"
    ? FadeOutDown.delay(index * DISCARD_CASCADE_STAGGER).duration(DISCARD_CASCADE_DURATION)
    : undefined

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        collapsable={false}
        entering={entering}
        exiting={exiting}
        layout={Layout.springify().damping(20).stiffness(300).mass(1)}
        style={[{ width: CARD_WIDTH, height: CARD_HEIGHT, marginRight: -48, elevation: selected ? 12 : 2, shadowColor: '#000', shadowOpacity: selected ? 0.28 : 0, shadowRadius: selected ? 6 : 1 }, style]}
      >
        <Pressable onPress={() => onSelect(item.uid, index)} onLongPress={onLongPress}>
          <MiniCard
            name={def?.name ?? item.cardId}
            type={def?.type ?? "?"}
            cost={cost}
            selected={selected}
            locked={locked}
            playable={false}
            description={def?.description ?? ""}
            onPress={() => onSelect(item.uid, index)}
            onLongPress={onLongPress}
          />
        </Pressable>
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
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 150},
  title: { color: "#fff", fontFamily: FACES.EXTRABOLD, fontSize: 18 },
  headerSpacer: { flex: 1 },
  ghostButton: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#111621", borderRadius: 10, borderWidth: 1, borderColor: "#1f2738" },
  ghostText: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 12 },
  debugRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  debugButton: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#111621", borderRadius: 8, borderWidth: 1, borderColor: "#1f2738" },
  debugText: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 12 },
  lanes: { flex: 1, gap: 8 },
  enemyLane: { backgroundColor: "#0b0d16", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#1a1f2f" },
  enemyRow: { flexDirection: "row", gap: 8 },
  enemyTile: { marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#1a1f2f", backgroundColor: "#0b0d16", gap: 6, alignItems: "center" },
  enemyTileStretch: { alignSelf: "stretch" },
  enemyTileDim: { borderColor: "#1a1f2f", backgroundColor: "#0b0d16" },
  enemyTileDead: { opacity: 0.5 },
  enemyTileActive: { borderColor: "#2e74ff" },
  playerTileActive: { borderColor: "#2e74ff" },
  enemyPortraitFrame: { width: 110, height: 110, borderRadius: 12, alignSelf: "center", backgroundColor: "#1d2235", alignItems: "center", justifyContent: "center" },
  enemyPortrait: { width: 70, height: 70 },
  enemyTop: { alignItems: "center", paddingBottom: 4 },
  enemyBottom: { width: "100%", paddingTop: 4, alignItems: "stretch", paddingHorizontal: 0, minHeight: 64, paddingBottom: 12 },
  enemyName: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 14, textAlign: "center" },
  playerTile: { backgroundColor: "#0b0d16", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#1a1f2f", flexDirection: "row", gap: 8, minHeight: 64, alignItems: "stretch" },
  statsStack: { flex: 1, flexDirection: "column", justifyContent: "flex-start", gap: 0 },
  endTurnInner: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", borderRadius: 10, overflow: 'hidden' },
  endTurnFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 10 },
  endTurnButton: { backgroundColor: "#243150", borderRadius: 10, alignItems: "center", justifyContent: "center", alignSelf: "stretch", aspectRatio: 1 },
  sectionTitle: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 14 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "flex-start", justifyContent: "flex-start", minHeight: 28, marginTop: 4 },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 3, minHeight: 18, borderRadius: 999, borderWidth: 1, borderColor: "#1f273a", backgroundColor: "#0f1220", marginRight: 6 },
  statusValue: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 11 },
  statusName: { color: "#9aa1b5", fontFamily: FACES.REGULAR, fontSize: 9 },
  statLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 0 },
  statIconLabel: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 35 },
  statValueText: { fontFamily: FACES.BOLD, fontSize: 11 , width: 25},
  statBarTrack: { flex: 1, height: 10, borderRadius: 3, backgroundColor: "#0d101c", position: "relative" },
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
  endTurnText: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 12 },
  buttonDisabled: { opacity: 0.4 },
  /* tooltipStrip removed; long-press on cards opens tooltip */
  handTray: { height: 220, paddingVertical: 8, overflow: "visible", zIndex: 100, position: "relative" },
  handStack: { flex: 1 },
  handControlsOverlay: { position: "absolute", left: 8, top: 0, bottom: 0, width: 64, zIndex: 2000, elevation: 30, alignItems: "center", flexDirection: "column" },
  handControlButton: { width: 56, height: 68, borderRadius: 14, borderWidth: 1, borderColor: "#1f2738", backgroundColor: "#0b0d16", alignItems: "center", justifyContent: "center" },
  handControlInner: { alignItems: "center", justifyContent: "center", gap: 6 },
  energyControl: { backgroundColor: "#0d101c" },
  energyValueSmall: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 12, marginTop: 4 },
  handCard: { position: "absolute", width: 140, height: 190, alignItems: "center", justifyContent: "flex-end" },
  miniCard: { width: 140, height: 180, borderRadius: 14, padding: 10, gap: 6, borderWidth: 1, borderColor: "#1f2738", backgroundColor: "#0d101c" },
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
