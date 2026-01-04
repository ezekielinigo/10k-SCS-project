import React, { useMemo, useState } from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { useGame } from "@shared/game/GameContext"
import { generateNpcBatch } from "@shared/game/generators/npcGenerator"
import { getAffiliationById } from "@shared/game/content/affiliations"
import ProfileViewHandler from "./ProfileViewHandler"
import ModalCard from "./ModalCard"
import fontConfig from "@shared/utils/fontConfig"
const FACES = fontConfig.fontFaceNames()

export default function DebugNpcModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useGame()

  const npcs = useMemo(() => {
    if (!open) return []
    const seed = `debug-npcs-${state.month}-${state.log.length}`
    return generateNpcBatch(5, { seed, allowUnique: false })
  }, [open, state.month, state.log.length])

  const handleConnect = (idx: number) => {
    const npc = npcs[idx]
    if (!npc) return
    const strength = Math.floor(Math.random() * 101)
    dispatch({ type: "CONNECT_NPC", npc, affiliations: npc.affiliationIds, relationshipStrength: strength })
  }

  const [openNpc, setOpenNpc] = useState<any | null>(null)

  return (
    <ModalCard open={open} onClose={onClose} title="Generate NPCs" maxHeight="80%">
      <Text style={styles.muted}>5 candidates (resets each month)</Text>
      {npcs.length === 0 && <Text style={styles.muted}>No candidates.</Text>}

      {npcs.map((npc, i) => {
        const affiliations = npc.affiliationIds ?? []
        const affNames = affiliations.map(a => getAffiliationById(a)?.name ?? a).filter(Boolean).join(", ") || "None"

        return (
          <View key={npc.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{npc.name}</Text>
              <Text style={styles.muted}>Age {npc.age} · District {npc.currentDistrict}</Text>
              <Text style={styles.muted}>{npc.tags.join(", ") || "No tags"}</Text>
              <Text style={styles.muted}>Affiliations: {affNames}</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Pressable style={styles.action} onPress={() => handleConnect(i)}>
                <Text style={styles.actionText}>Connect</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => setOpenNpc(npc)}>
                <Text style={styles.secondaryText}>View</Text>
              </Pressable>
            </View>
          </View>
        )
      })}

      <ProfileViewHandler open={!!openNpc} onClose={() => setOpenNpc(null)} target={{ mode: "npc", npc: openNpc ?? undefined }} />
    </ModalCard>
  )
}

const styles = StyleSheet.create({
  muted: { color: "#9fa3b5", marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderColor: "#1c1c28" },
  name: { color: "#fff", fontFamily: FACES.BOLD },
  action: { backgroundColor: "#1b5cff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: "#fff", fontFamily: FACES.BOLD },
  secondary: { backgroundColor: "#10121c", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#1f1f29" },
  secondaryText: { color: "#fff", fontFamily: FACES.BOLD },
})
