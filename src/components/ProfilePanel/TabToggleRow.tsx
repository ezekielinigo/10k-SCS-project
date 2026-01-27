import React from "react"
import { Pressable, Text, View } from "react-native"
import styles from "./profilePanelStyles"
import { useProfilePanel } from "./ProfilePanelContext"

export default function TabToggleRow() {
  const { activeTab, setActiveTab } = useProfilePanel()
  const isEquipmentTab = activeTab === "equipment"
  const isCyberTab = activeTab === "cyberware"
  const isDeckTab = activeTab === "deck"

  return (
    <View style={styles.toggleRow}>
      <Pressable onPress={() => setActiveTab("equipment")} style={[styles.toggleButton, isEquipmentTab ? styles.toggleActive : null, { marginRight: 8 }]}>
        <Text style={[styles.toggleText, isEquipmentTab ? styles.toggleTextActive : null]}>Equipment</Text>
      </Pressable>
      <Pressable onPress={() => setActiveTab("cyberware")} style={[styles.toggleButton, isCyberTab ? styles.toggleActive : null, { marginRight: 8 }]}>
        <Text style={[styles.toggleText, isCyberTab ? styles.toggleTextActive : null]}>Cybernetics</Text>
      </Pressable>
      <Pressable onPress={() => setActiveTab("deck")} style={[styles.toggleButton, isDeckTab ? styles.toggleActive : null]}>
        <Text style={[styles.toggleText, isDeckTab ? styles.toggleTextActive : null]}>Deck</Text>
      </Pressable>
    </View>
  )
}
