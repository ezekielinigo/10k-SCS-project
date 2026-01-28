import React, { useState } from "react"
import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native"
import { useFonts } from "expo-font"
import fontConfig from "@shared/utils/fontConfig"
const FACES = fontConfig.fontFaceNames()
import { useGame } from "@shared/game/engine/GameContext"
import { performStatCheck, makeRng, type MainStatKey, type SubSkillKey, type StatCheckResult } from "@shared/game/engine/statCheck"
import DebugFilterASCIIModal from "./DebugFilterASCIIModal"

export default function DebugControlsPanel({ onShowProfile, onChangeJob, onShowAffiliationMap, onShowRelationships, onShowDebugNpcs, onOpenInk, onOpenDistrict, onOpenStatCheck, onOpenAvatarMixer, onOpenCombatDebug, onOpenCombatScreen }: { onShowProfile?: () => void; onChangeJob?: () => void; onShowAffiliationMap?: () => void; onShowRelationships?: () => void; onShowDebugNpcs?: () => void; onOpenInk?: () => void; onOpenDistrict?: () => void; onOpenStatCheck?: (config: { dc: number; mainStatKey: MainStatKey; subSkillKey: SubSkillKey }, result: StatCheckResult) => void; onOpenAvatarMixer?: () => void; onOpenCombatDebug?: () => void; onOpenCombatScreen?: () => void }) {
  const { state, dispatch } = useGame()
  const [monoLoaded] = useFonts(fontConfig.fontAssetsFor("pt-mono"))
  const [showAsciiModal, setShowAsciiModal] = useState(false)

  const launchRandomCheck = () => {
    const mainStatKey = pick(MAIN_KEYS)
    const subSkillKey = pick(SUB_SKILL_KEYS)
    const mainVal = state.player?.skills?.[mainStatKey] ?? 0
    const subVal = state.player?.skills?.subSkills?.[subSkillKey] ?? 0
    const dc = randInt(8, 22)
    const res = performStatCheck({ dc, mainStat: mainVal, subSkill: subVal, rng: makeRng() })
    const text = [
      "STAT CHECK",
      `${mainStatKey.toUpperCase()}/${subSkillKey.toUpperCase()}`,
      `d20=${res.d20}`,
      `main=+${res.mainStat}`,
      `sub=+${res.subSkillBonus}`,
      `total=${res.total}`,
      `vs DC ${res.dc}`,
      res.success ? "SUCCESS" : "FAIL",
      res.critical ? `(${res.critical})` : "",
    ].filter(Boolean).join(" ")
    if (onOpenStatCheck) onOpenStatCheck({ dc, mainStatKey, subSkillKey }, res)
    dispatch({ type: "ADD_LOG", text })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Controls</Text>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Action monoLoaded={monoLoaded} label="Debug: Tags" onPress={async () => {
          const res = await awaitBuildContentContext(state)
          dispatch({ type: "ADD_LOG", text: res.text })
        }} />
        <Action monoLoaded={monoLoaded} label="Debug: Ink" onPress={() => { onOpenInk?.() }} />
        <Action monoLoaded={monoLoaded} label="Profile" onPress={() => { onShowProfile?.() }} />
        <Action monoLoaded={monoLoaded} label="Change Job" onPress={() => { onChangeJob?.() }} />
        <Action monoLoaded={monoLoaded} label="Change District" onPress={() => { onOpenDistrict?.() }} />
        <Action monoLoaded={monoLoaded} label="Affiliation Map" onPress={() => { onShowAffiliationMap?.() }} />
        <Action monoLoaded={monoLoaded} label="Relationships" onPress={() => { onShowRelationships?.() }} />
        <Action monoLoaded={monoLoaded} label="Generate NPCs" onPress={() => { onShowDebugNpcs?.() }} />
        <Action monoLoaded={monoLoaded} label="Avatar Mixer" onPress={() => { onOpenAvatarMixer?.() }} />
        <Action monoLoaded={monoLoaded} label="Combat Debug" onPress={() => { onOpenCombatDebug?.() }} />
        <Action monoLoaded={monoLoaded} label="Combat Screen" onPress={() => { onOpenCombatScreen?.() }} />
        <Action monoLoaded={monoLoaded} label="ASCII Filter" onPress={() => { setShowAsciiModal(true) }} />
        <Action monoLoaded={monoLoaded} label="Random Stat Check" onPress={() => { launchRandomCheck() }} />
      </ScrollView>
      <DebugFilterASCIIModal open={showAsciiModal} onClose={() => setShowAsciiModal(false)} />
    </View>
  )
}

function Action({ label, onPress, monoLoaded }: { label: string; onPress: () => void; monoLoaded: boolean }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Text style={[styles.actionText, monoLoaded ? styles.monoText : null]}>{label}</Text>
    </Pressable>
  )
}

const MAIN_KEYS: MainStatKey[] = ["str", "int", "ref", "chr"]
const SUB_SKILL_KEYS: SubSkillKey[] = [
  "athletics",
  "closeCombat",
  "heavyHandling",
  "hacking",
  "medical",
  "engineering",
  "marksmanship",
  "stealth",
  "mobility",
  "persuasion",
  "deception",
  "streetwise",
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function awaitBuildContentContext(state: any) {
  try {
    const mod = await import("@shared/game/content/tagEngine")
    const ctx = mod.buildContentContext(state)
    const parts = [
      `jobTags: ${ctx.jobTags.join(", ") || "-"}`,
      `districtTags: ${ctx.districtTags.join(", ") || "-"}`,
      `npcTags: ${ctx.npcTags.join(", ") || "-"}`,
      `statTags: ${ctx.statTags.join(", ") || "-"}`,
      `playerTags: ${ctx.playerTags.join(", ") || "-"}`,
      `worldTags: ${ctx.worldTags.join(", ") || "-"}`,
    ]
    return { text: `TAGS — ${parts.join(" | ")}` }
  } catch (e) {
    return { text: `TAGS — error: ${String(e)}` }
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0c0f18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#1d2435" },
  title: { color: "#f5f6fb", fontFamily: FACES?.BOLD, fontSize: 16, marginBottom: 8 },
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: 12 },
  action: { padding: 12, backgroundColor: "#10121c", borderRadius: 10, borderWidth: 1, borderColor: "#1f1f29", marginBottom: 8 },
  actionText: { color: "#fff", fontFamily: FACES.BOLD },
  monoText: { fontFamily: fontConfig.fontFaceNames("pt-mono").REGULAR },
})
