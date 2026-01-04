import React, { useMemo, useState } from "react"
import { StyleSheet, Text, TouchableOpacity, View, Image } from "react-native"
import fontConfig from "@shared/utils/fontConfig"
const FACES = fontConfig.fontFaceNames()
import { Feather } from "@expo/vector-icons"
import ProfileViewHandler from "./ProfileViewHandler"
import { useGame } from "@shared/game/engine/GameContext"
import { getJobById } from "@shared/game/content/careers"
import type { PlayerState } from "@shared/game/types"
import { PLAYER_VITAL_KEYS, SKILL_COLORS, VITAL_DEFINITIONS, SKILL_DEFINITIONS, type VitalKey } from "@shared/utils/ui"

type SubSkillKey = keyof PlayerState["skills"]["subSkills"]
type MainSkillKey = "str" | "int" | "ref" | "chr"

type SkillGroupDefinition = {
  key: MainSkillKey
  label: string
  color: string
  subskills: { key: SubSkillKey; label: string }[]
}

const SUBBAR_WIDTH = 5
const SUBBAR_GAP = 2
const MAIN_BAR_HEIGHT = 48
const SUBBAR_HEIGHT = MAIN_BAR_HEIGHT
const SUBBAR_CONTAINER_WIDTH = SUBBAR_WIDTH * 3 + SUBBAR_GAP * 2

const MAIN_SKILL_DEFINITIONS: SkillGroupDefinition[] = [
  {
    key: "str",
    label: "STR",
    color: SKILL_COLORS.STR,
    subskills: [
      { key: "athletics", label: "ATH" },
      { key: "closeCombat", label: "CLS" },
      { key: "heavyHandling", label: "HVY" },
    ],
  },
  {
    key: "int",
    label: "INT",
    color: SKILL_COLORS.INT,
    subskills: [
      { key: "hacking", label: "HCK" },
      { key: "medical", label: "MED" },
      { key: "engineering", label: "ENG" },
    ],
  },
  {
    key: "ref",
    label: "REF",
    color: SKILL_COLORS.REF,
    subskills: [
      { key: "marksmanship", label: "MRK" },
      { key: "stealth", label: "STL" },
      { key: "mobility", label: "MOB" },
    ],
  },
  {
    key: "chr",
    label: "CHR",
    color: SKILL_COLORS.CHR,
    subskills: [
      { key: "persuasion", label: "PRS" },
      { key: "deception", label: "DCP" },
      { key: "streetwise", label: "STW" },
    ],
  },
]

type FeatherIconName = React.ComponentProps<typeof Feather>["name"]

const VITAL_ICON_NAMES: Record<VitalKey, FeatherIconName> = {
  health: "heart",
  stress: "activity",
  humanity: "bar-chart-2",
  looks: "eye",
  popularity: "users",
  money: "dollar-sign",
}

const VITAL_COLORS: Record<VitalKey, string> = {
  health: "#ff5f5f",
  stress: "#fbbf24",
  humanity: "#a855f7",
  looks: "#38bdf8",
  popularity: "#47a8bd",
  money: "#ffd54f",
}

const InlineSmallProgress = ({ value, max = 100, height = 6, color = "#4caf50" }: { value?: number; max?: number; height?: number; color?: string }) => {
  const safeMax = Math.max(1, max)
  const pct = Math.max(0, Math.min(100, Math.round(((value ?? 0) / safeMax) * 100)))
  return (
    <View style={[styles.inlineProgressBg, { height }]}> 
      <View style={[styles.inlineProgressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  )
}

const VerticalBar = ({
  value,
  max = 100,
  height = MAIN_BAR_HEIGHT,
  width = 8,
  color = "#4f82ff",
}: {
  value?: number
  max?: number
  height?: number
  width?: number
  color?: string
}) => {
  const safeMax = Math.max(1, max)
  const clamped = Math.max(0, Math.min(safeMax, value ?? 0))
  const fillPercent = (clamped / safeMax) * 100
  return (
    <View style={[styles.verticalBar, { height, width }]}> 
      <View style={[styles.verticalBarFill, { height: `${fillPercent}%`, backgroundColor: color }]} />
    </View>
  )
}

const SmallVerticalBar = ({ value, max = 10, segments = 10, height = MAIN_BAR_HEIGHT, width = 20, color = "#4f82ff" }: { value?: number; max?: number; segments?: number; height?: number; width?: number; color?: string }) => {
  const safeMax = Math.max(1, max)
  const clamped = Math.max(0, Math.min(safeMax, value ?? 0))
  const filledSegments = Math.round((clamped / safeMax) * segments)
  const gap = 2
  const totalGap = gap * Math.max(0, segments - 1)
  // compute segmentHeight using floor so total segments + gaps do not exceed container height
  const segmentHeight = Math.max(1, Math.floor((height - totalGap) / segments))

  return (
    <View style={{ height, width, justifyContent: "flex-end" }}>
      {Array.from({ length: segments }).map((_, idx) => {
        const isFilled = idx >= segments - filledSegments
        return (
          <View
            key={idx}
            style={[
              styles.skillSegment,
              {
                height: segmentHeight,
                backgroundColor: isFilled ? color : "#1a1f2b",
                marginBottom: idx === segments - 1 ? 0 : gap,
              },
            ]}
          />
        )
      })}
    </View>
  )
}

export default function SummaryPanel() {
  const { state } = useGame()
  const player = state.player

  if (!player) {
    return null
  }

  const assignments = useMemo(
    () => Object.values(state.jobAssignments ?? {}).filter(a => a.memberId === player.id),
    [state.jobAssignments, player.id],
  )

  const jobs = useMemo(() => assignments.map(a => getJobById(a.jobId)).filter(Boolean), [assignments])

  const titles = useMemo(() => jobs.map(j => j?.title).filter(Boolean) as string[], [jobs])
  const titleText = useMemo(() => {
    if (titles.length === 0) return "Unemployed"
    return titles.join(titles.length > 2 ? ", " : " & ")
  }, [titles])

  const vitalsToShow = useMemo(
    () => PLAYER_VITAL_KEYS.map(key => VITAL_DEFINITIONS[key]).filter(v => v.enabled !== false),
    [],
  )

  const vitals = player.vitals
  const ageYears = Math.max(0, Math.floor((player.ageMonths + state.month) / 12))
  const [showSubskills, setShowSubskills] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const subSkills = player.skills.subSkills

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.leftColumn}
        onPress={() => setShowProfile(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Open profile for ${player.name}`}
      >
        <View style={styles.headerRow}>
          <Image source={require("../assets/icon_default.png")} style={styles.avatar} resizeMode="contain" />
          <View style={styles.headerColumn}>
            <Text style={styles.name}>{player.name}</Text>

            <View style={styles.vitalsList}>
              {vitalsToShow.map(vital => {
                const value = (vitals as Record<string, number>)[vital.key] ?? 0
                const iconName = VITAL_ICON_NAMES[vital.key]
                const neutral = "#9fa3b5"
                return (
                  <View key={vital.key} style={styles.vitalRow}>
                    <View style={styles.vitalTopRow}>
                      <View style={styles.vitalIconWrapper}>
                        <Feather name={iconName} size={12} color={neutral} />
                        <Text style={styles.vitalValue}>{value}</Text>
                      </View>
                      {typeof vital.max === "number" && vital.key !== "money" && (
                        <InlineSmallProgress value={value} max={vital.max} color={neutral} />
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.skillArea}>
        <TouchableOpacity
          style={styles.skillColumn}
          onPress={() => setShowSubskills(prev => !prev)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={showSubskills ? "Show main skill totals" : "Show subskill breakdown"}
        >
          {MAIN_SKILL_DEFINITIONS.map(def => {
            const mainValue = player.skills[def.key]
            const IconComponent = (SKILL_DEFINITIONS as Record<string, any>)[String(def.label).toUpperCase()]?.Icon
            return (
              <View key={def.key} style={styles.skillGroup}>
                {showSubskills ? (
                  <View style={[styles.subSkillRow, { width: SUBBAR_CONTAINER_WIDTH }]}> 
                    {def.subskills.map(sub => (
                      <View key={sub.key} style={styles.subSkillBarWrapper}>
                        <VerticalBar value={subSkills[sub.key] ?? 0} color={def.color} width={SUBBAR_WIDTH} height={SUBBAR_HEIGHT} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <SmallVerticalBar value={mainValue} color={def.color} />
                )}
                <View style={styles.skillLabel}>
                  <View style={styles.skillIcon}>
                    {IconComponent ? <IconComponent size={12} color={def.color} /> : <View style={[styles.skillIconFallback, { backgroundColor: def.color }]} />}
                  </View>
                  <Text style={styles.skillValue}>{mainValue}</Text>
                </View>
              </View>
            )
          })}
        </TouchableOpacity>
      </View>
      <ProfileViewHandler open={showProfile} onClose={() => setShowProfile(false)} target={{ mode: "player" }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#0e0f18",
    borderWidth: 1,
    borderColor: "#1d2030",
  },
  leftColumn: { flex: 1, marginRight: 12 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerColumn: { flex: 1, justifyContent: "center" },
  avatar: { width: 56, height: 56, marginRight: 10, borderRadius: 6, backgroundColor: "#0b0c12" },
  name: { color: "#f5f6fb", fontSize: 18, fontFamily: FACES.BOLD },
  ageLabel: { color: "#9fa3b5", fontSize: 12, marginTop: 4 },
  vitalsList: {  },
  vitalRow: {  },
  vitalTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vitalIconWrapper: { flexDirection: "row", alignItems: "center" },
  vitalValue: { color: "#9fa3b5", fontFamily: FACES.BOLD, marginLeft: 6, fontSize: 10, width: 25, textAlign: "left" },
  inlineProgressBg: { flex: 1, backgroundColor: "#141826", borderRadius: 6, overflow: "hidden", marginLeft: 6 },
  inlineProgressFill: { height: "100%", borderRadius: 6 },
  occupationText: { marginTop: 8, color: "#9fa3b5", fontSize: 12 },
  skillArea: { alignItems: "center", justifyContent: "center" },
  skillColumn: { flexDirection: "row", alignItems: "center", padding: 2, justifyContent: "center" },
  skillGroup: { alignItems: "center", marginHorizontal: 4 },
  skillLabel: { marginTop: 6, flexDirection: "row", alignItems: "center" },
  skillIcon: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  skillIconFallback: { width: 14, height: 14, borderRadius: 2 },
  skillValue: { fontSize: 10, color: "#9fa3b5" },
  toggleHint: { marginTop: 6, fontSize: 10, color: "#7b829a" },
  subSkillRow: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", height: SUBBAR_HEIGHT },
  subSkillBarWrapper: { marginHorizontal: SUBBAR_GAP / 2 },
  verticalBar: { backgroundColor: "#161826", borderRadius: 999, overflow: "hidden", position: "relative" },
  verticalBarFill: { position: "absolute", left: 0, right: 0, bottom: 0 },
  skillSegment: { borderRadius: 4, width: "100%" },
})
