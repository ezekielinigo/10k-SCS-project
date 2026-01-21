import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Dimensions,
  LayoutRectangle,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { Canvas, RoundedRect } from "@shopify/react-native-skia"
import { useGame } from "@shared/game/engine/GameContext"
import {
  createCombatState,
  startCombat,
  startTurn,
  endTurn,
  playCard,
  enemyPing,
} from "@shared/game/engine/combatEngine"
import type { CardDefinition, CardInstance, CombatState, StatusInstance } from "@shared/game/engine/combatTypes"
import CARDS from "@shared/game/content/cards"
import fontConfig from "@shared/utils/fontConfig"
import { STATUS_ICON_MAP, STAT_ICONS } from "@shared/utils/ui"
const FACES = fontConfig.fontFaceNames()

const STARTER_DECK = [
  "combat_start_boost",
  "flash_focus",
  "data_loop",
  "echo_strike_setup",
  "int_overload",
  "int_overload",
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

type ZonesOverlay = "deck" | "discard" | null

const cardCost = (card: CardInstance, def: CardDefinition) => Math.max(0, card.temporaryCost ?? def.cost)

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max))

const pointInside = (box: LayoutRectangle | null, x: number, y: number) => {
  if (!box) return false
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
}

export default function CombatScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state: gameState } = useGame()
  const [combat, setCombat] = useState<CombatState | null>(null)
  const [phase, setPhase] = useState<Phase>("player")
  const [selected, setSelected] = useState<string | null>(null)
  const [hoverTarget, setHoverTarget] = useState<HoverTarget>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [zonesOpen, setZonesOpen] = useState<ZonesOverlay>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [handShift] = useState(0)

  const enemyLaneRef = useRef<View>(null)
  const enemyTileRef = useRef<View>(null)
  const [enemyLaneBox, setEnemyLaneBox] = useState<LayoutRectangle | null>(null)
  const [enemyTileBox, setEnemyTileBox] = useState<LayoutRectangle | null>(null)
  const cardRefs = useRef<Map<string, View | null>>(new Map())
  const cardLayouts = useRef<Map<string, LayoutRectangle & { x: number; y: number }>>(new Map())
  const anims = useRef<Map<string, Animated.Value>>(new Map())
  const shiftAnims = useRef<Map<string, Animated.Value>>(new Map())

  const cardMap = useMemo(() => CARDS.reduce<Record<string, CardDefinition>>((acc, c) => { acc[c.id] = c; return acc }, {}), [])

  const deriveDeck = () => {
    const equipped = (gameState as any)?.derivedLoadout?.equippedCards ?? []
    const valid = equipped.filter((id: string) => cardMap[id])
    return valid.length ? valid : STARTER_DECK
  }

  const ensureAnim = (uid: string) => {
    if (!anims.current.has(uid)) anims.current.set(uid, new Animated.Value(0))
    return anims.current.get(uid) as Animated.Value
  }

  const animateSelection = (uid: string | null) => {
    const hasSelection = !!uid
    const entries = combat?.zones.hand ?? []
    entries.forEach((ci) => {
      const val = ensureAnim(ci.uid)
      const target = hasSelection ? (ci.uid === uid ? 1 : -0.3) : 0
      Animated.timing(val, { toValue: target, duration: 180, useNativeDriver: true }).start()
    })
  }

  const ensureShiftAnim = (uid: string) => {
    if (!shiftAnims.current.has(uid)) shiftAnims.current.set(uid, new Animated.Value(0))
    return shiftAnims.current.get(uid) as Animated.Value
  }

  const resetCombat = () => {
    const skills = (gameState as any)?.player?.skills ?? DEFAULT_SKILLS
    const deckIds = deriveDeck()
    const cs = createCombatState(
      {
        player: { hp: 32, maxHP: 32, skills },
        enemy: { hp: 28, maxHP: 28, skills },
        deckCardIds: deckIds,
        cardLibrary: cardMap,
        rngSeed: "combat_screen",
        config: { handLimit: 7, energyPerTurn: 3 },
      },
    )
    let next = startCombat(cs)
    next = startTurn(next)
    setCombat(next)
    setPhase("player")
    setSelected(null)
    setMessage(null)
    setLogs([`Combat ready (deck ${deckIds.length})`])
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
      setEnemyLaneBox({ x: pageX, y: pageY, width, height })
    })
    enemyTileRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setEnemyTileBox({ x: pageX, y: pageY, width, height })
    })
  }

  const onPlayCard = (uid: string, target: "enemy" | "player" = "enemy") => {
    if (!combat) return
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
    const damage = combat.enemy.hp - res.state.enemy.hp
    if (damage > 0) setLogs((prev) => [...prev, `Dealt ${damage}`].slice(-60))
    setCombat(res.state)
    setSelected(null)
    animateSelection(null)
    setMessage(null)
  }

  const resolveEnemyPhase = (state: CombatState) => {
    let next = enemyPing(state, 1)
    next = startTurn(next)
    setCombat(next)
    setPhase("player")
    setMessage("Player phase")
  }

  const onEndTurn = () => {
    if (!combat) return
    const next = endTurn(combat)
    setCombat(next)
    setPhase("enemy")
    setMessage("Enemy phase")
    resolveEnemyPhase(next)
  }

  const selectedCard = combat ? combat.zones.hand.find((c) => c.uid === selected) : null
  const selectedDef = selectedCard ? cardMap[selectedCard.cardId] : undefined
  const playable = combat && selectedCard && selectedDef && phase === "player" && combat.energy >= cardCost(selectedCard, selectedDef)
  const hand = combat?.zones.hand ?? []
  const selectedIndex = hand.findIndex((c) => c.uid === selected)

  const counts = combat
    ? {
        deck: combat.zones.deck.length,
        hand: combat.zones.hand.length,
        discard: combat.zones.discard.length,
        exhaust: combat.zones.exhaust.length,
      }
    : { deck: 0, hand: 0, discard: 0, exhaust: 0 }

  const handleHover = (x: number, y: number) => {
    if (pointInside(enemyTileBox, x, y)) {
      setHoverTarget("enemyTile")
      return
    }
    if (pointInside(enemyLaneBox, x, y)) {
      setHoverTarget("enemyLane")
      return
    }
    setHoverTarget(null)
  }

  const handleRelease = (uid: string, x: number, y: number) => {
    const insideTile = pointInside(enemyTileBox, x, y)
    const insideLane = pointInside(enemyLaneBox, x, y)
    if (!insideTile && !insideLane) {
      setMessage("No target found")
      setHoverTarget(null)
      return
    }
    onPlayCard(uid, "enemy")
    setHoverTarget(null)
  }

  const renderStatusBadge = (status: StatusInstance) => {
    const iconDef = STATUS_ICON_MAP[status.id]
    const Icon = iconDef?.Icon
    // classify as debuff or buff (simple explicit list)
    const DEBUFF_IDS = new Set(["skip_next_turn", "hand_size_minus_one", "blood_tax"])
    const isDebuff = DEBUFF_IDS.has(status.id)
    const accent = isDebuff ? "#ff6b7a" : "#76e39c"
    const remaining = typeof status.remaining === "number" ? String(status.remaining) : null

    return (
      <Pressable key={`${status.id}-${status.remaining}`} onPress={() => setTooltipPayload({ kind: "status", status })} style={[styles.statusChip, { borderColor: accent }] as any}>
        {Icon ? <Icon size={16} color={accent} /> : <Text style={[styles.statusName, { color: accent }]}>{status.name}</Text>}
        {remaining ? <Text style={[styles.statusValue, { color: accent }]}>{remaining}</Text> : null}
      </Pressable>
    )
  }

  const renderHandCard = (card: CardInstance, index: number, total: number) => {
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
    const shiftAnim = ensureShiftAnim(card.uid)
    Animated.spring(shiftAnim, { toValue: shiftTarget, useNativeDriver: true, bounciness: 0, speed: 14 }).start()

    const anim = ensureAnim(card.uid)

    const TAP_SLOP = 4

    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > TAP_SLOP || Math.abs(gesture.dy) > TAP_SLOP,
      onPanResponderGrant: () => {
        setTooltipPayload(null)
        setSelected(card.uid)
        animateSelection(card.uid)
      },
      onPanResponderMove: (_, gesture) => {
        setTooltipPayload(null)
        setSelected(card.uid)
        animateSelection(card.uid)
        handleHover(gesture.moveX, gesture.moveY)
      },
      onPanResponderRelease: (_, gesture) => {
        const dist = Math.abs(gesture.dx) + Math.abs(gesture.dy)
        if (dist < TAP_SLOP) {
          if (selected === card.uid) {
            setSelected(null)
            animateSelection(null)
            setTooltipPayload(null)
          } else {
            setTooltipPayload(null)
            setSelected(card.uid)
            animateSelection(card.uid)
          }
          setHoverTarget(null)
          return
        }
        handleRelease(card.uid, gesture.moveX, gesture.moveY)
      },
      onPanResponderTerminate: () => {
        setHoverTarget(null)
      },
    })

    const locked = def ? def.tags.some((t) => combat?.tagLocks.includes(t) ?? false) : false
    const cost = def ? cardCost(card, def) : 0

    return (
      <Animated.View
        key={card.uid}
        ref={(node: View | null) => {
          cardRefs.current.set(card.uid, node as any)
        }}
        onLayout={() => {
          const ref = cardRefs.current.get(card.uid)
          ;(ref as any)?.measureInWindow((x: number, y: number, width: number, height: number) => {
            cardLayouts.current.set(card.uid, { x, y, width, height })
          })
        }}
        style={[
          styles.handCard,
          {
            transform: [
              { translateX: shiftAnim },
              { translateY: anim.interpolate({ inputRange: [-0.3, 0, 1], outputRange: [60, 0, -26] }) },
              { rotate: anim.interpolate({ inputRange: [-0.3, 0, 1], outputRange: [`${angle}deg`, `${angle}deg`, `0deg`] }) },
            ],
            zIndex: selected === card.uid ? 20 : index,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <MiniCard
          name={def?.name ?? card.cardId}
          type={def?.type ?? "?"}
          cost={cost}
          selected={selected === card.uid}
          locked={locked}
          playable={!!playable && selected === card.uid}
          description={def?.description ?? ""}
            onPress={() => {
              if (selected === card.uid) {
                setSelected(null)
                animateSelection(null)
                setHoverTarget(null)
                setTooltipPayload(null)
              } else {
                setTooltipPayload(null)
                setSelected(card.uid)
                animateSelection(card.uid)
              }
            }}
          onLongPress={() => {
            if (def) setTooltipPayload({ kind: "card", def })
          }}
        />
      </Animated.View>
    )
  }

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

  const renderZonesOverlay = () => {
    if (!zonesOpen || !combat) return null
    const cards = zonesOpen === "deck" ? combat.zones.deck : [...combat.zones.discard, ...combat.zones.exhaust]
    return (
      <Pressable style={styles.overlay} onPress={() => setZonesOpen(null)}>
        <View style={styles.overlayCard}>
          <Text style={styles.overlayTitle}>{zonesOpen === "deck" ? "Deck" : "Discard | Exhaust"}</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {cards.map((ci) => {
              const def = cardMap[ci.cardId]
              return (
                <View key={ci.uid} style={styles.overlayRow}>
                  <Text style={styles.overlayText}>{def?.name ?? ci.cardId}</Text>
                  <Text style={styles.overlayMeta}>{def?.type ?? "?"} · {def?.cost ?? 0}</Text>
                </View>
              )
            })}
          </ScrollView>
        </View>
      </Pressable>
    )
  }

  if (!open || !combat) return null

  return (
    <Modal visible={open} animationType="fade" presentationStyle="fullScreen" onShow={updateLaneBoxes} onRequestClose={onClose}>
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
              <View
                ref={enemyTileRef}
                style={[
                  styles.enemyTile,
                  selected ? styles.enemyTileDim : null,
                  hoverTarget ? styles.enemyTileActive : null,
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
                  {(combat.enemy.statuses ?? []).map(renderStatusBadge)}
                </View>
              </View>
            </View>

			<View style={styles.zoneControls}>
				<Pressable style={[styles.cardStackButton, styles.deckButton]} onPress={() => setZonesOpen("deck")}> 
					<Text style={styles.deckButtonCount}>{counts.deck}</Text>
				</Pressable>
				<View style={styles.energyCounter}>
					<Feather name="zap" size={14} color="#7be0ff" />
					<Text style={styles.energyValue}>{combat.energy}/{combat.config.energyPerTurn}</Text>
				</View>
				<View style={styles.zoneSpacer} />
				<Pressable style={[styles.endTurnButton, phase !== "player" && styles.buttonDisabled]} onPress={onEndTurn} disabled={phase !== "player"}>
					<Text style={styles.endTurnText}>End Turn</Text>
				</Pressable>
				<Pressable style={[styles.cardStackButton, styles.discardButton]} onPress={() => setZonesOpen("discard")}> 
					<Text style={styles.discardButtonCount}>{counts.discard}|{counts.exhaust}</Text>
				</Pressable>
			</View>
            <View style={styles.playerLane}>
              <Text style={styles.sectionTitle}>Player</Text>
              <View style={styles.playerCard}>
                <StatLine Icon={STAT_ICONS.health} value={combat.player.hp} max={combat.player.maxHP} barColor="#76e39c" accentColor="#9cf7b4" />
                <StatLine Icon={STAT_ICONS.shield} value={combat.player.shield ?? 0} max={40} barColor="#66d1ff" accentColor="#7bb5ff" />
                <View style={styles.statusRow}>
                  {(combat.player.statuses ?? []).map(renderStatusBadge)}
                </View>
              </View>
            </View>
          </View>

          {/* helper strip removed: use long-press on cards to open tooltip */}

          <View style={styles.handTray}>
            {hand.map((c, idx) => renderHandCard(c, idx, hand.length))}
          </View>

          {renderStatusTooltip()}

          {logOpen ? (
            <View style={styles.logBox}>
              <Text style={styles.sectionTitle}>Log</Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {logs.map((l, idx) => (<Text key={`${l}-${idx}`} style={styles.logText}>• {l}</Text>))}
              </ScrollView>
            </View>
          ) : null}
        </View>
        {renderZonesOverlay()}
      </SafeAreaView>
    </Modal>
  )
}

function StatLine({ Icon, value, max, barColor, accentColor }: { Icon: React.ComponentType<{ size?: number; color?: string }>; value: number; max: number; barColor: string; accentColor?: string }) {
  const pct = max > 0 ? clamp(value / max, 0, 1) : 0
  const accent = accentColor ?? barColor
  return (
    <View style={styles.statLine}>
      <View style={styles.statIconLabel}>
        <Icon size={14} color={accent} />
        <Text style={[styles.statValueText, { color: accent }]}>{Math.round(value)}</Text>
      </View>
      <View style={styles.statBarTrack}>
        <View style={[styles.statBarFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  )
}

function MiniCard({ name, type, cost, selected, locked, playable, description, onPress, onLongPress }: { name: string; type: string; cost: number; selected: boolean; locked: boolean; playable: boolean; description: string; onPress: () => void; onLongPress?: () => void }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={[styles.miniCard, selected ? styles.miniCardSelected : null, locked ? styles.miniCardLocked : null]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <RoundedRect x={10} y={10} width={24} height={24} r={8} color={locked ? "#5c5c68" : "#2e74ff"} />
      </Canvas>
      <Text style={styles.cardCost}>{locked ? "X" : cost}</Text>
      <View style={styles.cardTop}>
        <Text numberOfLines={1} style={styles.cardName}>{name}</Text>
      </View>
      <Text style={styles.cardType}>{type}</Text>
      <Text numberOfLines={3} style={styles.cardDesc}>{description}</Text>
      {locked ? <Text style={styles.cardLock}>Locked</Text> : null}
    </Pressable>
  )
}

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
  enemyTile: { marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#21283b", backgroundColor: "#0f1220", gap: 6 },
  enemyTileDim: { borderColor: "#32547f", backgroundColor: "#0d1424", shadowColor: "#32547f", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  enemyTileActive: { borderColor: "#7be0ff", backgroundColor: "#13263d", shadowColor: "#7be0ff", shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  enemyCanvas: { width: 110, height: 110, borderRadius: 12 },
  enemyName: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 14 },
  playerLane: { backgroundColor: "#0b0d16", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#1a1f2f" },
  playerCard: { gap: 1 },
  sectionTitle: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 14 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "#1f273a", backgroundColor: "#0f1220", marginRight: 6 },
  statusValue: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 12 },
  statusName: { color: "#9aa1b5", fontFamily: FACES.REGULAR, fontSize: 10 },
  statLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  statIconLabel: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 35 },
  statValueText: { fontFamily: FACES.BOLD, fontSize: 11 },
  statBarTrack: { flex: 1, height: 10, borderRadius: 3, backgroundColor: "#0d101c" },
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
  tooltipName: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 13 },
  tooltipDesc: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 12 },
  handTray: { height: 240, justifyContent: "flex-end", alignItems: "center" },
  handCard: { position: "absolute", bottom: -10, width: 140, height: 190, alignItems: "center" },
  miniCard: { width: 140, height: 180, borderRadius: 14, overflow: "hidden", padding: 10, gap: 6, borderWidth: 1, borderColor: "#1f2738", backgroundColor: "#0d101c" },
  miniCardSelected: { borderColor: "#4ea1ff", shadowColor: "#4ea1ff", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  miniCardLocked: { opacity: 0.6 },
  cardCost: { position: "absolute", top: 12, left: 16, color: "#fff", fontFamily: FACES.EXTRABOLD, fontSize: 14 },
  cardTop: { paddingTop: 8 },
  cardName: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 13, marginLeft: 30, marginTop: -5 },
  cardType: { color: "#9aa1b5", fontFamily: FACES.BOLD, fontSize: 11 },
  cardDesc: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 11 },
  cardLock: { color: "#ff8a8a", fontFamily: FACES.BOLD, fontSize: 11 },
  cardHint: { color: "#7aa6ff", fontFamily: FACES.BOLD, fontSize: 10 },
  logBox: { backgroundColor: "#0b0d16", borderRadius: 12, borderWidth: 1, borderColor: "#1a1f2f", padding: 10, gap: 4 },
  logText: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 11 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  overlayCard: { width: Dimensions.get("window").width - 60, backgroundColor: "#0b0d16", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1f2738", gap: 8 },
  overlayTitle: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 16 },
  overlayRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#161b2a" },
  overlayText: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 12 },
  overlayMeta: { color: "#9aa1b5", fontFamily: FACES.REGULAR, fontSize: 11 },
  tooltipOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  statusTooltip: { minWidth: 220, maxWidth: 360, backgroundColor: "#0b0d16", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#1a1f2f" },
  tooltipName: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 13, marginBottom: 6 },
  tooltipDesc: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 12 },
})
