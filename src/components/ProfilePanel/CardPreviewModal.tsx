import React from "react"
import { Modal, Pressable, Text, View } from "react-native"
import styles from "./profilePanelStyles"
import { Canvas, Image as SkiaImage, FilterMode, MipmapMode } from "@shopify/react-native-skia"
import { useProfilePanel } from "./ProfilePanelContext"

export default function CardPreviewModal() {
  const { cardPreview, itemIconSkia, closeCardPreview } = useProfilePanel()
  return (
    <Modal transparent visible={!!cardPreview} animationType="fade" onRequestClose={closeCardPreview}>
      <Pressable style={styles.cardModalOverlay} onPress={closeCardPreview}>
        <View style={styles.cardModal}>
          <View style={styles.cardModalArt}>
            <Canvas style={styles.cardModalCanvas}>
              {itemIconSkia ? (
                <SkiaImage
                  image={itemIconSkia}
                  x={12}
                  y={12}
                  width={140}
                  height={140}
                  fit="contain"
                  sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
                />
              ) : null}
            </Canvas>
          </View>
          <Text style={styles.cardModalTitle}>{cardPreview?.name}</Text>
          <Text style={styles.cardModalMeta}>{cardPreview?.type ?? "?"} · Cost {cardPreview?.cost ?? 0}</Text>
          <Text style={styles.cardModalDesc}>{cardPreview?.description ?? ""}</Text>
        </View>
      </Pressable>
    </Modal>
  )
}
