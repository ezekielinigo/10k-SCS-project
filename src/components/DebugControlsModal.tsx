import React from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { useGame } from "@shared/game/GameContext"
import { performStatCheck, makeRng, type MainStatKey, type SubSkillKey, type StatCheckResult } from "@shared/game/statCheck"
import ModalCard from "./ModalCard"

export default function DebugControlsModal({ open, onClose, onShowProfile, onChangeJob, onShowAffiliationMap, onShowRelationships, onShowDebugNpcs, onOpenInk, onOpenDistrict, onOpenStatCheck, onOpenAvatarMixer }: { open: boolean; onClose: () => void; onShowProfile?: () => void; onChangeJob?: () => void; onShowAffiliationMap?: () => void; onShowRelationships?: () => void; onShowDebugNpcs?: () => void; onOpenInk?: () => void; onOpenDistrict?: () => void; onOpenStatCheck?: (config: { dc: number; mainStatKey: MainStatKey; subSkillKey: SubSkillKey }, result: StatCheckResult) => void; onOpenAvatarMixer?: () => void }) {
  const { state, dispatch } = useGame()

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
    <ModalCard open={open} onClose={onClose} title="Debug Controls" maxHeight="90%">
      <View style={styles.list}>
        <Action label="Debug: Tags" onPress={async () => {
          const res = await awaitBuildContentContext(state)
          dispatch({ type: "ADD_LOG", text: res.text })
          onClose()
        }} />
        <Action label="Debug: Ink" onPress={() => { onOpenInk?.(); onClose() }} />
        <Action label="Profile" onPress={() => { onShowProfile?.(); onClose() }} />
        <Action label="Change Job" onPress={() => { onChangeJob?.(); onClose() }} />
        <Action label="Change District" onPress={() => { onOpenDistrict?.(); onClose() }} />
        <Action label="Affiliation Map" onPress={() => { onShowAffiliationMap?.(); onClose() }} />
        <Action label="Relationships" onPress={() => { onShowRelationships?.(); onClose() }} />
        <Action label="Generate NPCs" onPress={() => { onShowDebugNpcs?.(); onClose() }} />
        <Action label="Avatar Mixer" onPress={() => { onOpenAvatarMixer?.(); onClose() }} />
        <Action label="Random Stat Check" onPress={() => { launchRandomCheck(); onClose() }} />
      </View>
    </ModalCard>
  )
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
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
  list: { gap: 8 },
  action: { padding: 12, backgroundColor: "#10121c", borderRadius: 10, borderWidth: 1, borderColor: "#1f1f29" },
  actionText: { color: "#fff", fontWeight: "700" },
})
