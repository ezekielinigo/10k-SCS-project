import React, { useMemo } from "react"
import { Modal, View, Text, StyleSheet, ScrollView, Pressable } from "react-native"
import type { InkFrame, InkStatCheckEvent } from "@shared/game/ink"

const extractDeltas = (vars?: Record<string, any>) => {
  const deltas: Record<string, number> = {}
  if (!vars) return deltas
  const keys = Object.keys(vars)
  for (const key of keys) {
    if (!key.startsWith("delta_")) continue
    const name = key.slice(6)
    const val = Number(vars[key] ?? 0)
    if (!val) continue
    deltas[name] = val
  }
  return deltas
}

export default function InkModal({ open, onClose, frames, onChoose, statsVars, inkStatCheck, title }: { open: boolean; onClose: () => void; frames: InkFrame[]; onChoose: (choiceIndex: number) => void; statsVars?: any; inkStatCheck?: InkStatCheckEvent | null; title?: string | null }) {
  const top = frames[frames.length - 1]

  const deltas = useMemo(() => extractDeltas(statsVars), [statsVars])

  if (!top) return null

  const hasChoices = (top.choices?.length ?? 0) > 0

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title ?? "Story"}</Text>
          <ScrollView style={styles.body}>
            <Text style={styles.text}>{top.text}</Text>
            {inkStatCheck ? (
              <View style={styles.statBox}>
                <Text style={styles.statTitle}>Stat Check</Text>
                <Text style={styles.statText}>
                  {inkStatCheck.mainStatKey.toUpperCase()}
                  {inkStatCheck.subSkillKey ? `/${inkStatCheck.subSkillKey}` : ""} vs DC {inkStatCheck.dc}
                </Text>
                <Text style={styles.statText}>Roll: {inkStatCheck.result.d20} → Total {inkStatCheck.result.total}</Text>
                <Text style={[styles.statText, { color: inkStatCheck.result.success ? "#9ef0ae" : "#f78" }]}>
                  {inkStatCheck.result.success ? "Success" : "Failure"}
                </Text>
              </View>
            ) : null}
            {Object.keys(deltas).length ? (
              <View style={styles.deltaRow}>
                {Object.entries(deltas).map(([k, v]) => (
                  <Text key={k} style={styles.deltaPill}>{`${k}: ${v > 0 ? "+" : ""}${v}`}</Text>
                ))}
              </View>
            ) : null}
          </ScrollView>

          {hasChoices ? (
            <View style={{ gap: 8 }}>
                      {(() => {
                        const vars = statsVars ?? {}
                        const quitCount = Object.keys(vars).filter(k => k.startsWith("quit_") && vars[k]).length
                        const total = top.choices.length
                        return top.choices.map((c, idx) => {
                          const isQuit = quitCount > 0 && idx >= total - quitCount
                          return (
                            <Pressable
                              key={idx}
                              style={isQuit ? [styles.choice, styles.secondaryBtn] : styles.choice}
                              onPress={() => onChoose(c.index ?? idx)}
                            >
                              <Text style={isQuit ? styles.secondaryText : styles.choiceText}>{c.text}</Text>
                            </Pressable>
                          )
                        })
                      })()}
            </View>
          ) : (
            <Pressable style={[styles.choice, styles.primaryBtn]} onPress={onClose}>
              <Text style={styles.choiceText}>Continue</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxHeight: "90%",
    backgroundColor: "#0c0c12",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f1f2a",
    gap: 12,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  body: { flexGrow: 0 },
  text: { color: "#e5e5e5", fontSize: 15, lineHeight: 22 },
  choice: { padding: 12, backgroundColor: "#1b5cff", borderRadius: 10, alignItems: "center" },
  choiceText: { color: "#fff", fontWeight: "700" },
  primaryBtn: { backgroundColor: "#1b5cff" },
  secondaryBtn: { backgroundColor: "#1a1a22", borderWidth: 1, borderColor: "#2b2b34" },
  secondaryText: { color: "#d0d0d0", fontWeight: "600" },
  deltaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  deltaPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#1f2b33", color: "#a8e4ff", fontSize: 12 },
  statBox: { borderWidth: 1, borderColor: "#2e2e3a", borderRadius: 10, padding: 10, marginTop: 12, backgroundColor: "#101018" },
  statTitle: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  statText: { color: "#cfcfde", fontSize: 13 },
})
