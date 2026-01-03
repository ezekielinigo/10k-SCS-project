import React from "react"
import { Modal, View, Pressable, StyleSheet, Text, ScrollView } from "react-native"

export type ModalCardProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxHeight?: number | string
}

export default function ModalCard({ open, onClose, title, children, maxHeight = "80%" }: ModalCardProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* Full-screen backdrop that closes when pressed */}
        <Pressable style={styles.backdropTouchable} onPress={onClose} />

        {/* Centered container to hold the card */}
        <View style={styles.center} pointerEvents="box-none">
          <View style={[styles.card, { maxHeight }]}> 
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              {children}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    position: "absolute",
    width: "100%",
    backgroundColor: "#0b0b12",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f1f2a",
    padding: 14,
    gap: 10,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
})
