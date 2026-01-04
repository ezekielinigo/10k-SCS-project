import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native"
import { FontAwesome5 } from "@expo/vector-icons"
import ModalCard from "./ModalCard"
import { renderDeltaPills } from "@shared/utils/ui"
import { makeRng, performStatCheck, type StatCheckMapping, type StatCheckResult } from "@shared/game/statCheck"
import fontConfig from "@shared/utils/fontConfig"
const FACES = fontConfig.fontFaceNames()

export type StatCheckModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  dc: number
  mainStatKey: string
  mainStatValue?: number
  subSkillKey?: string
  subSkillValue?: number
  mapping?: StatCheckMapping
  rngSeed?: string
  autoRun?: boolean
  onResolve?: (result: StatCheckResult) => void
  initialResult?: StatCheckResult
  bodyText?: string
  deltas?: Record<string, number>
}

const pretty = (value?: string | null) => {
  if (!value) return ""
  return value
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

export default function StatCheckModal({
  open,
  onClose,
  title = "Stat Check",
  dc,
  mainStatKey,
  mainStatValue = 0,
  subSkillKey,
  subSkillValue = 0,
  mapping = "quintile",
  rngSeed,
  autoRun = false,
  onResolve,
  initialResult,
  bodyText,
  deltas,
}: StatCheckModalProps) {
  const [result, setResult] = useState<StatCheckResult | null>(initialResult ?? null)
  const onResolveRef = useRef<StatCheckModalProps["onResolve"]>(onResolve)
  const autoRunRef = useRef(false)

  useEffect(() => { onResolveRef.current = onResolve }, [onResolve])

  const mainLabel = useMemo(() => (mainStatKey ? mainStatKey.toUpperCase() : "MAIN"), [mainStatKey])
  const subLabel = useMemo(() => (subSkillKey ? pretty(subSkillKey).toUpperCase() : null), [subSkillKey])

  const rollAnim = useRef(new Animated.Value(initialResult?.d20 ?? 1)).current
  const revealOpacity = useRef(new Animated.Value(initialResult ? 1 : 0)).current
  const modifierOpacity = useRef(new Animated.Value(1)).current
  const [rollDisplay, setRollDisplay] = useState<number>(initialResult?.d20 ?? 1)

  useEffect(() => {
    const sub = rollAnim.addListener(({ value }) => setRollDisplay(Math.round(value)))
    return () => rollAnim.removeListener(sub)
  }, [rollAnim])

  const modifiersLines = useMemo(() => {
    const lines: string[] = []
    lines.push(`+${mainStatValue ?? 0}${mainLabel ? ` (${mainLabel})` : ""}`)
    if (subSkillKey) {
      const subVal = result ? result.subSkillBonus : subSkillValue ?? 0
      lines.push(`+${subVal} (${pretty(subSkillKey)})`)
    }
    return lines
  }, [mainLabel, mainStatValue, result, subSkillKey, subSkillValue])

  const outcomeLabel = useMemo(() => {
    if (!result) return "—"
    if (result.critical === "nat20") return "CRITICAL SUCCESS"
    if (result.critical === "nat1") return "CRITICAL FAIL"
    return result.success ? "SUCCESS" : "FAILURE"
  }, [result])

  const runCheck = useCallback(() => {
    try {
      const rng = makeRng(rngSeed)
      const next = performStatCheck({ dc, mainStat: mainStatValue ?? 0, subSkill: subSkillValue ?? 0, mapping, rng })
      setResult(next)
      onResolveRef.current?.(next)
    } catch (e) {
      setResult(null)
    }
  }, [dc, mainStatValue, subSkillValue, mapping, rngSeed])

  useEffect(() => {
    if (initialResult) {
      setResult(initialResult)
      return
    }
    if (!open) {
      autoRunRef.current = false
      setResult(null)
      return
    }
    setResult(null)
    if (autoRun && !autoRunRef.current) {
      autoRunRef.current = true
      runCheck()
    }
  }, [open, autoRun, runCheck, initialResult])

  useEffect(() => {
    if (!result) {
      revealOpacity.setValue(0)
      modifierOpacity.setValue(1)
      rollAnim.setValue(1)
      return
    }
    revealOpacity.setValue(0)
    modifierOpacity.setValue(1)

    const target = result.d20
    const total = result.total

    const sequence: Animated.CompositeAnimation[] = [
      Animated.timing(rollAnim, { toValue: 20, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(rollAnim, { toValue: target, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(modifierOpacity, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]

    if (target !== 1) {
      sequence.push(Animated.timing(rollAnim, { toValue: total, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }))
    }

    sequence.push(Animated.timing(revealOpacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }))

    Animated.sequence(sequence).start()
  }, [result, rollAnim, revealOpacity, modifierOpacity])

  const hasDeltas = deltas && Object.keys(deltas).length > 0

  return (
    <ModalCard open={open} onClose={onClose} maxHeight="85%">
      <Text style={styles.centeredTitle}>{title}</Text>
      <View style={styles.headerBlock}>
        <Text style={styles.subtitle}>DIFFICULTY CLASS</Text>
        <Text style={styles.dc}>{dc}</Text>
      </View>

      <View style={styles.diceCard}>
        <FontAwesome5 name="dice-d20" size={70} color="#f7d07a" style={{ marginBottom: -10 }} />
        <Text style={styles.rollValue}>{result ? rollDisplay : "—"}</Text>
        <Animated.View style={[styles.modifiersRow, { opacity: modifierOpacity }]}> 
          {modifiersLines.map(line => (
            <Text key={line} style={styles.modifierText}>{line}</Text>
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[styles.revealBlock, { opacity: revealOpacity }]}> 
        <View style={styles.outcomeCard}>
          <Text style={[styles.outcomeLabel, { color: result ? (result.success ? "#9cf5a6" : "#f78") : "#cfcfde" }]}>
            {outcomeLabel}
          </Text>
        </View>

        {bodyText ? (
          <View style={styles.bodyCard}>
            <Text style={styles.bodyText}>{bodyText}</Text>
            {hasDeltas ? renderDeltaPills(deltas) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={[styles.button, styles.secondary]} onPress={runCheck}>
            <Text style={styles.buttonText}>Reroll</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.primary]} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
        </View>
      </Animated.View>
    </ModalCard>
  )
}

const styles = StyleSheet.create({
  headerBlock: { alignItems: "center", marginBottom: 6 },
  subtitle: { color: "#9fa3b5", fontSize: 12, letterSpacing: 1 },
  dc: { color: "#f5f6fb", fontSize: 26, fontFamily: FACES.EXTRABOLD, marginTop: 4 },
  diceCard: {
    backgroundColor: "#0e0f18",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1d2030",
    padding: 10,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
    width: 92,
    maxHeight: 135,
    alignSelf: "center",
    marginBottom: 10,
	marginTop: -5,
  },
  rollValue: { color: "#f5f6fb", fontSize: 32, fontFamily: FACES.EXTRABOLD, textAlign: "center", minHeight: 32 },
  modifiersRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center", alignItems: "center", minWidth: 500 },
  modifierText: { color: "#b6b9c7", fontSize: 12, textAlign: "center" },
  revealBlock: { gap: 10 },
  outcomeCard: {
    backgroundColor: "#0c0f18",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1d2030",
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  outcomeLabel: { fontSize: 20, fontFamily: FACES.EXTRABOLD },
  outcomeSub: { color: "#cfcfde", fontSize: 13, textAlign: "center" },
  centeredTitle: { color: "#fff", fontSize: 18, fontFamily: FACES.EXTRABOLD, textAlign: "center", marginBottom: 8 },
  bodyCard: {
    backgroundColor: "#0c0f18",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1d2030",
    padding: 12,
    gap: 8,
  },
  bodyText: { color: "#e1e3eb", fontSize: 13, lineHeight: 18 },
  deltaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  deltaPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#1f2b33", color: "#a8e4ff", fontSize: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  primary: { backgroundColor: "#1b5cff", borderColor: "#2c86f0" },
  secondary: { backgroundColor: "#161826", borderColor: "#25283a" },
  buttonText: { color: "#fff", fontFamily: FACES.BOLD },
})
