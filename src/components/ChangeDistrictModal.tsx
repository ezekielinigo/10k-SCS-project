import React, { useMemo } from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { useGame } from "@shared/game/GameContext"
import DISTRICTS, { getDistrictById } from "@shared/game/content/districts"
import fontConfig from "@shared/utils/fontConfig"
const FACES = fontConfig.fontFaceNames()
import ModalCard from "./ModalCard"

export default function ChangeDistrictModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useGame()

  const districts = useMemo(() => Object.values(DISTRICTS), [])
  const currentId = state.player?.currentDistrict ?? null

  const handleChange = (id: string) => {
    if (!id) return
    dispatch({ type: "SET_PLAYER_DISTRICT", districtId: id })
    onClose()
  }

  return (
    <ModalCard open={open} onClose={onClose} title="Change District">
      <Text style={styles.muted}>Current: {getDistrictById(currentId ?? "")?.name ?? (currentId ?? "-")}</Text>
      <View style={styles.listBox}>
        {districts.map(d => (
          <View key={d.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{d.name}</Text>
              {d.description ? <Text style={styles.muted}>{d.description}</Text> : null}
              {d.tags?.length ? <Text style={styles.meta}>{d.tags.join(", ")}</Text> : null}
            </View>
            <Pressable style={styles.action} onPress={() => handleChange(d.id)}>
              <Text style={styles.actionText}>Go</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ModalCard>
  )
}

const styles = StyleSheet.create({
  muted: { color: "#9fa3b5", marginBottom: 6 },
  listBox: { borderWidth: 1, borderColor: "#1f1f29", borderRadius: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderBottomWidth: 1, borderColor: "#1f1f29" },
  title: { color: "#fff", fontFamily: FACES.BOLD },
  meta: { color: "#9fa3b5", fontSize: 12, marginTop: 2 },
  action: { backgroundColor: "#1b5cff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: "#fff", fontFamily: FACES.BOLD },
})
