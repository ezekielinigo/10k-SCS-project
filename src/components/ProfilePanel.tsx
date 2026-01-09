import React from "react"
import { View, Text, StyleSheet } from "react-native"
import fontConfig from "@shared/utils/fontConfig"
const FACES = fontConfig.fontFaceNames()

export default function ProfilePanel() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.body}>Profile panel placeholder.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0c0f18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#1d2435" },
  title: { color: "#f5f6fb", fontFamily: FACES.BOLD, fontSize: 16, marginBottom: 8 },
  body: { color: "#c9cdd8" },
})
