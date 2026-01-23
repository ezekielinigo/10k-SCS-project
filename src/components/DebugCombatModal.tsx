import React, { useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native"
import ModalCard from "./ModalCard"
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
import { STATUS_ICON_MAP } from "@shared/utils/ui"
const FACES = fontConfig.fontFaceNames()

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

type LogEntry = { id: string; text: string }

const makeId = () => Math.random().toString(36).slice(2)

const limitLogs = (entries: LogEntry[]): LogEntry[] => (entries.length > 50 ? entries.slice(entries.length - 50) : entries)

const cardCost = (card: CardInstance, def: CardDefinition) => Math.max(0, card.temporaryCost ?? def.cost)

const isPlayable = (state: CombatState, card: CardInstance, def: CardDefinition, phase: Phase) => {
  if (phase !== "player") return false
  if (def.tags.some((t) => state.tagLocks.includes(t))) return false
  const cost = cardCost(card, def)
  return state.energy >= cost
}

export default function DebugCombatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state: gameState } = useGame()
  const [combat, setCombat] = useState<CombatState | null>(null)
  const [phase, setPhase] = useState<Phase>("player")
  const [selected, setSelected] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logOpen, setLogOpen] = useState(false)

  const cardMap = useMemo(() => CARDS.reduce<Record<string, CardDefinition>>((acc, c) => { acc[c.id] = c; return acc }, {}), [])

  const addLog = (text: string) => {
    setLogs((prev) => limitLogs([...prev, { id: makeId(), text }]))
  }

  const deriveDeck = () => {
    const equipped = gameState?.derivedLoadout?.equippedCards ?? []
    const valid = equipped.filter((id) => cardMap[id])
    return valid.length ? valid : STARTER_DECK
  }

  const resetCombat = () => {
    const skills = gameState.player?.skills ?? DEFAULT_SKILLS
    const deckIds = deriveDeck()
    const cs = createCombatState(
      {
        player: { hp: 100, maxHP: 100, skills },
        enemy: { hp: 100, maxHP: 100, skills },
        deckCardIds: deckIds,
        cardLibrary: cardMap,
        rngSeed: "debug",
        config: { handLimit: 5, energyPerTurn: 5 },
      },
    )
    let next = startCombat(cs)
    next = startTurn(next)
    setCombat(next)
    setPhase("player")
    setSelected(null)
    setLogs(limitLogs([{ id: makeId(), text: `Combat initialized (deck ${deckIds.length})` }]))
  }

  useEffect(() => {
    if (open) {
      resetCombat()
    } else {
      setCombat(null)
      setSelected(null)
      setPhase("player")
      setLogs([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const onPlay = () => {
    if (!combat || !selected) return
    const located = combat.zones.hand.find((c) => c.uid === selected)
    if (!located) return
    const def = cardMap[located.cardId]
    const res = playCard(combat, { cardInstanceId: located.uid, target: "enemy" })
    if (!res.ok) {
      addLog(`Play failed: ${res.reason}`)
      return
    }
    const damage = combat.enemy.hp - res.state.enemy.hp
    addLog(`Played ${def?.name ?? located.cardId}${damage > 0 ? `, dealt ${damage}` : ""}`)
    setCombat(res.state)
    setSelected(null)
  }

  const onEndTurn = () => {
    if (!combat) return
    const next = endTurn(combat)
    setCombat(next)
    setPhase("enemy")
    addLog("End Turn -> Enemy phase")
  }

  const onEnemyStep = () => {
    if (!combat) return
    let next = enemyPing(combat, 1)
    addLog("Enemy ping: 1 damage")
    next = startTurn(next)
    setCombat(next)
    setPhase("player")
    addLog("Player Turn start")
  }

  const counts = combat
    ? {
        deck: combat.zones.deck.length,
        hand: combat.zones.hand.length,
        discard: combat.zones.discard.length,
        exhaust: combat.zones.exhaust.length,
        inPlay: combat.zones.inPlay.length,
      }
    : { deck: 0, hand: 0, discard: 0, exhaust: 0, inPlay: 0 }

  const selectedCard = combat ? combat.zones.hand.find((c) => c.uid === selected) : null
  const selectedDef = selectedCard ? cardMap[selectedCard.cardId] : undefined
  const playable = combat && selectedCard && selectedDef ? isPlayable(combat, selectedCard, selectedDef, phase) : false

  return (
    <ModalCard open={open} onClose={onClose} title="Combat Debug" maxHeight="90%">
      {combat ? (
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Text style={styles.titleText}>Turn {combat.turn}</Text>
            <Text style={styles.subText}>{phase === "player" ? "Player Turn" : "Enemy Turn"}</Text>
            <Text style={styles.energyText}>Energy {combat.energy}/{combat.config.energyPerTurn}</Text>
            <Pressable onPress={() => setLogOpen((v) => !v)} style={styles.logToggle}>
              <Text style={styles.logToggleText}>{logOpen ? "Hide Log" : "Show Log"}</Text>
            </Pressable>
          </View>

          <View style={styles.panelRow}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Enemy: Dummy</Text>
              <Text style={styles.statText}>HP {combat.enemy.hp}/{combat.enemy.maxHP}</Text>
              <Text style={styles.statText}>Shield {combat.enemy.shield ?? 0}</Text>
              <StatusList statuses={combat.enemy.statuses} />
              <Pressable onPress={resetCombat} style={styles.smallButton}>
                <Text style={styles.buttonText}>Reset Dummy</Text>
              </Pressable>
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Player</Text>
              <Text style={styles.statText}>HP {combat.player.hp}/{combat.player.maxHP}</Text>
              <Text style={styles.statText}>Shield {combat.player.shield ?? 0}</Text>
              <StatusList statuses={combat.player.statuses} />
              <View style={styles.countRow}>
                <Text style={styles.countText}>Deck {counts.deck}</Text>
                <Text style={styles.countText}>Discard {counts.discard}</Text>
                <Text style={styles.countText}>Exhaust {counts.exhaust}</Text>
                <Text style={styles.countText}>In Play {counts.inPlay}</Text>
              </View>
            </View>
          </View>

          <View style={styles.handHeader}>
            <Text style={styles.sectionTitle}>Hand ({counts.hand})</Text>
          </View>
          <ScrollView style={styles.handList}>
            {combat.zones.hand.map((card) => {
              const def = cardMap[card.cardId]
              const cost = def ? cardCost(card, def) : 0
              const locked = def ? def.tags.some((t) => combat.tagLocks.includes(t)) : false
              const canPlay = def ? isPlayable(combat, card, def, phase) : false
              return (
                <Pressable
                  key={card.uid}
                  style={[styles.handItem, selected === card.uid ? styles.handItemSelected : null, !canPlay ? styles.handItemDisabled : null]}
                  onPress={() => setSelected(card.uid)}
                >
                  <Text style={styles.cardName}>{def?.name ?? card.cardId}</Text>
                  <Text style={styles.cardMeta}>Cost {cost} · {def?.type ?? "?"} · {def?.rarity ?? ""}</Text>
                  <Text style={styles.cardMeta}>Tags {def?.tags.join(", ") ?? "-"}</Text>
                  <Text style={styles.cardDesc}>{def?.description ?? ""}</Text>
                  {locked ? <Text style={styles.lockedText}>Tag locked</Text> : null}
                </Pressable>
              )
            })}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.preview}>
              <Text style={styles.sectionTitle}>Selected</Text>
              <Text style={styles.cardName}>{selectedDef?.name ?? "None"}</Text>
              {selectedDef ? (
                <>
                  <Text style={styles.cardMeta}>Cost {selectedCard ? cardCost(selectedCard, selectedDef) : selectedDef.cost}</Text>
                  <Text style={styles.cardDesc}>{selectedDef.description}</Text>
                </>
              ) : null}
            </View>
            <View style={styles.footerButtons}>
              <Pressable style={[styles.button, (!playable || phase !== "player") && styles.buttonDisabled]} onPress={onPlay} disabled={!playable || phase !== "player"}>
                <Text style={styles.buttonText}>Play</Text>
              </Pressable>
              <Pressable style={[styles.button, phase !== "player" && styles.buttonDisabled]} onPress={onEndTurn} disabled={phase !== "player"}>
                <Text style={styles.buttonText}>End Turn</Text>
              </Pressable>
              <Pressable style={[styles.button, phase !== "enemy" && styles.buttonDisabled]} onPress={onEnemyStep} disabled={phase !== "enemy"}>
                <Text style={styles.buttonText}>Resolve Enemy Turn</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={resetCombat}>
                <Text style={styles.buttonText}>Reset</Text>
              </Pressable>
            </View>
          </View>

          {logOpen ? (
            <View style={styles.logBox}>
              <Text style={styles.sectionTitle}>Event Log</Text>
              <ScrollView style={styles.logList}>
                {logs.map((l) => (
                  <Text key={l.id} style={styles.logText}>• {l.text}</Text>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      ) : null}
    </ModalCard>
  )
}

function StatusList({ statuses }: { statuses: CombatState["player"]["statuses"] }) {
  if (!statuses?.length) return <Text style={styles.cardMeta}>No statuses</Text>
  const [tooltip, setTooltip] = React.useState<StatusInstance | null>(null)
  const DEBUFF_IDS = new Set(["skip_next_turn", "hand_size_minus_one", "blood_tax"])
  return (
    <View style={styles.statusRow}>
      {statuses.map((s) => {
        const iconDef = STATUS_ICON_MAP[s.id]
        const Icon = iconDef?.Icon
        const isDebuff = DEBUFF_IDS.has(s.id)
        const accent = isDebuff ? "#ff6b7a" : "#76e39c"
        const remaining = typeof s.remaining === "number" ? String(s.remaining) : null
        return (
          <Pressable key={`${s.id}-${s.remaining}`} onPress={() => setTooltip(s)} style={[styles.statusChip, { borderColor: accent }]}>
            {Icon ? <Icon size={14} color={accent} /> : <Text style={[styles.statusLabel, { color: accent }]}>{s.name}</Text>}
            {remaining ? <Text style={[styles.statusValue, { color: accent }]}>{remaining}</Text> : null}
          </Pressable>
        )
      })}
      {tooltip ? (
        <Pressable style={styles.tooltipOverlay} onPress={() => setTooltip(null)}>
          <View style={styles.statusTooltip}>
            <Text style={styles.tooltipName}>{tooltip.name}</Text>
            {tooltip.description ? <Text style={styles.tooltipDesc}>{tooltip.description}</Text> : null}
          </View>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  titleText: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 13 },
  subText: { color: "#9aa1b5", fontFamily: FACES.REGULAR, fontSize: 12 },
  energyText: { color: "#7be0ff", fontFamily: FACES.BOLD, fontSize: 12 },
  logToggle: { paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#1c2030", borderRadius: 6 },
  logToggleText: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 12 },
  panelRow: { flexDirection: "row", gap: 6 },
  card: { flex: 1, backgroundColor: "#0e111a", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#1d2333", gap: 4 },
  sectionTitle: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 13 },
  statText: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 12 },
  countRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  countText: { color: "#9aa1b5", fontFamily: FACES.REGULAR, fontSize: 11 },
  handHeader: { marginTop: 2 },
  handList: { maxHeight: 180 },
  handItem: { padding: 8, borderRadius: 8, backgroundColor: "#141929", borderWidth: 1, borderColor: "#1f2740", marginBottom: 6 },
  handItemSelected: { borderColor: "#4ea1ff" },
  handItemDisabled: { opacity: 0.45 },
  cardName: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 13 },
  cardMeta: { color: "#9aa1b5", fontFamily: FACES.REGULAR, fontSize: 11 },
  cardDesc: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 11 },
  lockedText: { color: "#ff8a8a", fontFamily: FACES.BOLD, fontSize: 11 },
  footer: { flexDirection: "row", gap: 6 },
  preview: { flex: 1, backgroundColor: "#0e111a", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#1d2333", gap: 4 },
  footerButtons: { flex: 1, gap: 6 },
  button: { paddingVertical: 9, paddingHorizontal: 10, backgroundColor: "#2b334a", borderRadius: 8, alignItems: "center" },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 12 },
  smallButton: { paddingVertical: 7, paddingHorizontal: 8, backgroundColor: "#252c3d", borderRadius: 7, alignItems: "center" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "#1f273a", backgroundColor: "#0f1220", marginRight: 6 },
  statusValue: { color: "#cdd4e5", fontFamily: FACES.BOLD, fontSize: 12 },
  statusLabel: { color: "#9aa1b5", fontFamily: FACES.REGULAR, fontSize: 10 },
  tooltipOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  statusTooltip: { minWidth: 220, maxWidth: 360, backgroundColor: "#0b0d16", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#1a1f2f" },
  tooltipName: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 13, marginBottom: 6 },
  tooltipDesc: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 12 },
  logBox: { marginTop: 6, backgroundColor: "#0e111a", borderRadius: 8, borderWidth: 1, borderColor: "#1d2333", padding: 8, gap: 4 },
  logList: { maxHeight: 120 },
  logText: { color: "#cdd4e5", fontFamily: FACES.REGULAR, fontSize: 11 },
  logToggleContainer: { flexDirection: "row", justifyContent: "flex-end" },
})
