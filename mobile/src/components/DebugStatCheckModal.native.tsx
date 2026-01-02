import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import ModalCard from "./ModalCard.native"
import { makeRng, performStatCheck, type StatCheckMapping, type StatCheckResult } from "@shared/game/statCheck"

export type DebugStatCheckModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  dc: number
  mainStatKey: string
  mainStatValue: number
  subSkillKey?: string
  subSkillValue?: number
  mapping?: StatCheckMapping
  rngSeed?: string
  autoRun?: boolean
  onResolve?: (result: StatCheckResult) => void
  initialResult?: StatCheckResult
}

export default function DebugStatCheckModal({ open, onClose, title = "Stat Check", dc, mainStatKey, mainStatValue, subSkillKey, subSkillValue, mapping = "quintile", rngSeed, autoRun = false, onResolve, initialResult }: DebugStatCheckModalProps) {
  const [result, setResult] = useState<StatCheckResult | null>(initialResult ?? null)
  const onResolveRef = useRef<DebugStatCheckModalProps["onResolve"]>(onResolve)
  const autoRunRef = useRef(false)

  useEffect(() => {
    onResolveRef.current = onResolve
  }, [onResolve])

  const labels = useMemo(() => ({
    main: mainStatKey.toUpperCase(),
    sub: subSkillKey ? subSkillKey.replace(/([A-Z])/g, " $1").toUpperCase() : null,
  }), [mainStatKey, subSkillKey])

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

  return (
    <ModalCard open={open} onClose={onClose} title={title} maxHeight="70%">
      <View style={styles.grid}>
        <Field label="DC" value={dc} />
        <Field label={`Main (${labels.main})`} value={mainStatValue ?? 0} />
        {subSkillKey ? <Field label={`Sub (${labels.sub})`} value={subSkillValue ?? 0} /> : null}
      </View>

      <View style={styles.btnRow}>
        <Pressable style={styles.button} onPress={runCheck}><Text style={styles.btnText}>Reroll</Text></Pressable>
        <Pressable style={styles.button} onPress={onClose}><Text style={styles.btnText}>Close</Text></Pressable>
      </View>

      {result ? (
        <ResultCard result={result} dc={dc} mainLabel={labels.main} subLabel={labels.sub} />
      ) : (
        <Text style={styles.muted}>No roll yet. Click Reroll.</Text>
      )}
    </ModalCard>
  )
}

function Field({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  )
}

function ResultCard({ result, dc, mainLabel, subLabel }: { result: StatCheckResult; dc: number; mainLabel: string; subLabel: string | null }) {
  const outcome = result.critical === "nat1"
    ? "CRITICAL FAIL"
    : result.critical === "nat20"
      ? "CRITICAL SUCCESS"
      : result.success
        ? "SUCCESS"
        : "FAILURE"

  return (
    <View style={styles.resultCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.muted}>Outcome</Text>
        <Text style={[styles.outcome, { color: result.success ? "#9cf5a6" : "#f39" }]}>{outcome}</Text>
      </View>
      <View style={styles.resultGrid}>
        <Text style={styles.resultText}>d20: {result.d20}</Text>
        <Text style={styles.resultText}>DC: {dc}</Text>
        <Text style={styles.resultText}>{mainLabel}: +{result.mainStat}</Text>
        <Text style={styles.resultText}>{subLabel ? `${subLabel}: +${result.subSkillBonus}` : "Sub: +0"}</Text>
        <Text style={styles.resultText}>Total: {result.total}</Text>
        <Text style={styles.resultText}>Margin: {result.margin}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: 12, marginBottom: 10 },
  btnRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  button: { backgroundColor: "#1b5cff", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
  muted: { color: "#9fa3b5" },
  fieldValue: { color: "#fff", fontWeight: "800", fontSize: 18 },
  resultCard: { borderWidth: 1, borderColor: "#1f1f29", borderRadius: 10, padding: 12, backgroundColor: "#10121c", gap: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  outcome: { fontWeight: "800" },
  resultGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  resultText: { color: "#c9c9d7", fontSize: 12 },
})
