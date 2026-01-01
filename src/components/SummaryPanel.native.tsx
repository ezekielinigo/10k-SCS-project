import React from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"

export type ProfileDataSummary = {
  name: string
  ageLabel: string
  gender: string
  districtLabel?: string
  tags?: string[]
  affiliations?: string[]
  vitals?: { health?: number; stress?: number; bounty?: number }
}

function SmallProgress({ value = 0, max = 100, height = 8, color = "#4caf50", bg = "#222" }: { value?: number; max?: number; height?: number; color?: string; bg?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(((value || 0) / max) * 100)))
  return (
    <View style={[styles.progressBg, { height, backgroundColor: bg }]}> 
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
    </View>
  )
}

export default function SummaryPanel({ profile, onClose }: { profile: ProfileDataSummary; onClose?: () => void }) {
  const vitals = profile.vitals || {}

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{profile.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{profile.gender}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.metaText}>{profile.ageLabel}</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.rowGrid}>
        <View style={styles.col}> 
          <Text style={styles.label}>District</Text>
          <Text style={styles.value}>{profile.districtLabel ?? "-"}</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Tags</Text>
          <Text style={styles.value}>{(profile.tags && profile.tags.length) ? profile.tags.join(", ") : "-"}</Text>
        </View>

        {(profile.affiliations && profile.affiliations.length > 0) && (
          <View style={[styles.col, styles.fullRow]}>
            <Text style={styles.label}>Affiliations</Text>
            <Text style={styles.value}>{profile.affiliations.join(", ")}</Text>
          </View>
        )}
      </View>

      <View style={[styles.vitalsRow]}> 
        <View style={styles.vitalItem}>
          <Text style={styles.vitalTitle}>Health</Text>
          <Text style={styles.vitalNumber}>{vitals.health ?? 0}</Text>
          <SmallProgress value={vitals.health ?? 0} color="#e53935" />
        </View>

        <View style={styles.vitalItem}>
          <Text style={styles.vitalTitle}>Stress</Text>
          <Text style={styles.vitalNumber}>{vitals.stress ?? 0}</Text>
          <SmallProgress value={vitals.stress ?? 0} color="#ffb300" />
        </View>

        <View style={styles.vitalItem}>
          <Text style={styles.vitalTitle}>Bounty</Text>
          <Text style={styles.vitalNumber}>{vitals.bounty ?? 0}</Text>
          <SmallProgress value={Math.min((vitals.bounty ?? 0) / 20, 100)} color="#4caf50" />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: "#0b0b0b", borderRadius: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  name: { color: "#fff", fontSize: 18, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { color: "#aaa" },
  dot: { color: "#aaa", marginHorizontal: 6 },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#222", borderRadius: 6 },
  closeText: { color: "#fff" },
  rowGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  col: { flexBasis: "48%", marginBottom: 8 },
  fullRow: { flexBasis: "100%" },
  label: { color: "#ccc", fontWeight: "700", marginBottom: 4 },
  value: { color: "#fff" },
  vitalsRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  vitalItem: { flex: 1, marginRight: 8 },
  vitalTitle: { color: "#ccc", fontSize: 12, marginBottom: 4 },
  vitalNumber: { color: "#fff", fontWeight: "700", marginBottom: 6 },
  progressBg: { width: "100%", borderRadius: 999, overflow: "hidden" },
})
