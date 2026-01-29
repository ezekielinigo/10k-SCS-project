import React from "react"
import { View, Pressable } from "react-native"
import Animated from "react-native-reanimated"

type Props = {
  pressable?: boolean
  onPress?: () => void
  baseStyle: any
  stretchStyle?: any
  dimStyle?: any
  activeStyle?: any
  deadStyle?: any
  topNode?: React.ReactNode
  statsNode?: React.ReactNode
  rightSlot?: React.ReactNode
}

export default function CombatantTile({ pressable = true, onPress, baseStyle, stretchStyle, dimStyle, activeStyle, deadStyle, topNode, statsNode, rightSlot }: Props) {
  const Content = (
    <Animated.View style={[baseStyle, stretchStyle, dimStyle ?? null, activeStyle ?? null, deadStyle ?? null]}>
      {topNode}
      {statsNode}
      {rightSlot}
    </Animated.View>
  )

  if (pressable) {
    return (
      <Pressable onPress={onPress} style={{ flex: 1 }}>
        {Content}
      </Pressable>
    )
  }
  // Non-pressable tiles should be content-driven; do not force flex:1 here.
  return <View>{Content}</View>
}
