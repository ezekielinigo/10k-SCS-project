import React, { useMemo, useState } from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { useGame } from "@shared/game/GameContext"
import ProfileViewHandler from "./ProfileViewHandler.native"

function SmallStrengthBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <View style={styles.strengthBg}>
      <View style={[styles.strengthFill, { width: `${pct}%` }]} />
    </View>
  )
}

export default function RelationshipsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useGame()
  const [openNpcId, setOpenNpcId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const relationships = Object.values(state.relationships ?? {}) as any[]
    const playerId = state.player.id
    const targetIds = relationships
      .map(r => {
        if (r.aId === playerId && r.bId) return { id: r.bId, strength: r.strength }
        if (r.bId === playerId && r.aId) return { id: r.aId, strength: r.strength }
        return null
      })
      .filter(Boolean) as { id: string; strength?: number }[]

    return targetIds
      .map(entry => {
        const npc = state.npcs?.[entry.id]
        return {
          id: entry.id,
          name: npc?.name ?? entry.id,
          avatarId: npc?.avatarId,
          strength: entry.strength ?? 0,
        }
      })
      .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
  }, [state.relationships, state.npcs, state.player])

  return (
    <ModalCard open={open} onClose={onClose} title="Relationships" maxHeight="80%">
      {rows.length === 0 && <Text style={styles.muted}>No relationships recorded yet.</Text>}

      {rows.map(r => (
        <View key={r.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{r.name}</Text>
            <SmallStrengthBar value={r.strength ?? 0} />
          </View>
          <Pressable style={styles.action} onPress={() => setOpenNpcId(r.id)}>
            <Text style={styles.actionText}>View</Text>
          </Pressable>
        </View>
      ))}

      <ProfileViewHandler open={!!openNpcId} onClose={() => setOpenNpcId(null)} target={{ mode: "npc", npcId: openNpcId ?? undefined }} />
    </ModalCard>
  )
}

import ModalCard from "./ModalCard.native"

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderColor: "#1c1c28" },
  name: { color: "#fff", fontWeight: "700", marginBottom: 6 },
  muted: { color: "#9fa3b5", marginBottom: 8 },
  action: { backgroundColor: "#1b5cff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: "#fff", fontWeight: "700" },
  strengthBg: { height: 6, borderRadius: 6, backgroundColor: "#1f1f29", width: 140 },
  strengthFill: { height: "100%", borderRadius: 6, backgroundColor: "#5dd19b" },
})
