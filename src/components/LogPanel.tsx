import React, { useEffect, useMemo, useRef } from "react"
import { View, Text, StyleSheet, ScrollView } from "react-native"
import { renderDeltaPills } from "@shared/utils/ui"
import { useGame } from "@shared/game/engine/GameContext"
import fontConfig from "@shared/utils/fontConfig"
const FACES = fontConfig.fontFaceNames()

const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]

const formatMonthYear = (m: number) => {
  const year = 2077 + Math.floor(m / 12)
  const mon = monthNames[((m % 12) + 12) % 12]
  return `${mon} ${year}`

}

export default function LogPanel() {
  const { state } = useGame()
  const scrollRef = useRef<ScrollView | null>(null)

  const grouped = useMemo(() => {
    const groups: Record<number, typeof state.log> = {}
    for (const entry of state.log) {
      const m = Number(entry.month ?? 0)
      if (!groups[m]) groups[m] = []
      groups[m].push(entry)
    }
    const months = Object.keys(groups).map(k => Number(k)).sort((a, b) => a - b)
    return { groups, months }
  }, [state.log])

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    }, 50)
    return () => clearTimeout(timer)
  }, [state.log])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log</Text>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ paddingBottom: 12 }}>
        {grouped.months.map(month => (
          <View key={`month-${month}`} style={{ marginBottom: 12 }}>
            <View style={styles.monthHeader}>
              <Text style={styles.monthLabel}>{formatMonthYear(month)}</Text>
              <View style={styles.monthSep} />
            </View>
            {grouped.groups[month].map(entry => (
              <View key={entry.id} style={styles.logCard}>
                <Text style={styles.logText}>{entry.text}</Text>
                {entry.deltas ? renderDeltaPills(entry.deltas) : null}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0c0f18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#1d2435" },
  title: { color: "#f5f6fb", fontFamily: FACES.BOLD, fontSize: 16, marginBottom: 8 },
  scroll: { flex: 1 },
  monthHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  monthLabel: { color: "#8e93a8", fontSize: 12, letterSpacing: 0.2 },
  monthSep: { flex: 1, height: 1, backgroundColor: "#1c2233", marginLeft: 10 },
  logCard: { paddingVertical: 8, gap: 4 },
  logText: { color: "#e5e7ef", fontSize: 14, lineHeight: 18 },
  deltaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  deltaPill: { color: "#9ad4a0", fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#132018", borderRadius: 999, borderWidth: 1, borderColor: "#1e3423" },
})
