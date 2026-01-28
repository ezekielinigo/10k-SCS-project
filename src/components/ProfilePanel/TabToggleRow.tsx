import React from "react"
import { ActivityIndicator, Pressable, Text, View, InteractionManager } from "react-native"
import styles from "./profilePanelStyles"
import { useProfilePanel } from "./ProfilePanelContext"
import { AnimatedFlickerSwap } from "@shared/utils/ui"

export default function TabToggleRow() {
  const { activeTab, setActiveTab } = useProfilePanel()
  const [loadingTab, setLoadingTab] = React.useState<"equipment" | "cyberware" | "deck" | null>(null)
  const isEquipmentTab = activeTab === "equipment"
  const isCyberTab = activeTab === "cyberware"
  const isDeckTab = activeTab === "deck"

  React.useEffect(() => () => {}, [])

  const handleTabPress = (tab: "equipment" | "cyberware" | "deck") => {
    setLoadingTab(tab)
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(() => {
        setActiveTab(tab)
        requestAnimationFrame(() => {
          setLoadingTab((prev) => (prev === tab ? null : prev))
        })
      })
    })
  }

  return (
    <View style={styles.toggleRow}>
      <Pressable onPress={() => handleTabPress("equipment")} style={[styles.toggleButtonWrap, { marginRight: 8 }]}>
        <AnimatedFlickerSwap
          keyProp={`tab-equipment-${isEquipmentTab}-${loadingTab === "equipment"}`}
          loading={loadingTab === "equipment"}
          loadingElement={
            <View style={[styles.toggleButton, isEquipmentTab ? styles.toggleActive : null]}>
              <ActivityIndicator size="small" color="#cfe1ff" />
            </View>
          }
          iconElement={
            <View style={[styles.toggleButton, isEquipmentTab ? styles.toggleActive : null]}>
              <Text style={[styles.toggleText, isEquipmentTab ? styles.toggleTextActive : null]}>Equipment</Text>
            </View>
          }
          active={isEquipmentTab}
          animateOnEnter
        />
      </Pressable>
      <Pressable onPress={() => handleTabPress("cyberware")} style={[styles.toggleButtonWrap, { marginRight: 8 }]}>
        <AnimatedFlickerSwap
          keyProp={`tab-cyberware-${isCyberTab}-${loadingTab === "cyberware"}`}
          loading={loadingTab === "cyberware"}
          loadingElement={
            <View style={[styles.toggleButton, isCyberTab ? styles.toggleActive : null]}>
              <ActivityIndicator size="small" color="#cfe1ff" />
            </View>
          }
          iconElement={
            <View style={[styles.toggleButton, isCyberTab ? styles.toggleActive : null]}>
              <Text style={[styles.toggleText, isCyberTab ? styles.toggleTextActive : null]}>Cybernetics</Text>
            </View>
          }
          active={isCyberTab}
          animateOnEnter
        />
      </Pressable>
      <Pressable onPress={() => handleTabPress("deck")} style={styles.toggleButtonWrap}>
        <AnimatedFlickerSwap
          keyProp={`tab-deck-${isDeckTab}-${loadingTab === "deck"}`}
          loading={loadingTab === "deck"}
          loadingElement={
            <View style={[styles.toggleButton, isDeckTab ? styles.toggleActive : null]}>
              <ActivityIndicator size="small" color="#cfe1ff" />
            </View>
          }
          iconElement={
            <View style={[styles.toggleButton, isDeckTab ? styles.toggleActive : null]}>
              <Text style={[styles.toggleText, isDeckTab ? styles.toggleTextActive : null]}>Deck</Text>
            </View>
          }
          active={isDeckTab}
          animateOnEnter
        />
      </Pressable>
    </View>
  )
}
