import React from "react"
import { Feather } from "@expo/vector-icons"
import { StyleSheet, Text, View, TouchableOpacity } from "react-native"
import ModalCard from "./ModalCard"
import { SKILL_COLORS, SKILL_DEFINITIONS, type VitalKey } from "@shared/utils/ui"
import { getDistrictById } from "@shared/game/content/districts"

type FeatherIconName = React.ComponentProps<typeof Feather>["name"]

export type ProfileOccupation = {
  id: string
  jobId?: string
  title: string
  affiliation?: string
  description?: string
  removable?: boolean
}

export type ProfileData = {
  name: string
  ageLabel: string
  gender: string
  districtLabel: string
  tags: string[]
  affiliations: string[]
  vitals: { health: number; humanity: number; stress: number; looks: number; money: number; bounty: number; popularity: number }
  skills: { str: number; int: number; ref: number; chr: number; subSkills?: Record<string, number> }
  occupations: ProfileOccupation[]
  showAffiliations?: boolean
  canEditAssignments?: boolean
}

const VITALS_ORDER: Array<{ key: VitalKey | "bounty"; label: string }> = [
  { key: "health", label: "Health" },
  { key: "stress", label: "Stress" },
  { key: "humanity", label: "Humanity" },
  { key: "looks", label: "Looks" },
  { key: "popularity", label: "Popularity" },
  { key: "money", label: "Money" },
  { key: "bounty", label: "Bounty" },
]

// Display order for the profile modal: 3 columns x 2 rows (exclude `money`)
// Desired visual layout:
// [health][stress][bounty]
// [humanity][looks][popularity]
const VITALS_DISPLAY: Array<{ key: VitalKey | "bounty"; label: string }> = [
  { key: "health", label: "Health" },
  { key: "stress", label: "Stress" },
  { key: "bounty", label: "Bounty" },
  { key: "humanity", label: "Humanity" },
  { key: "looks", label: "Looks" },
  { key: "popularity", label: "Popularity" },
]

const VITAL_MAX: Record<string, number> = {
  health: 100,
  stress: 100,
  humanity: 100,
  looks: 100,
  popularity: 100,
  money: 100,
  bounty: 2000,
}

const VITAL_ICON_NAMES: Record<string, FeatherIconName> = {
  health: "heart",
  stress: "activity",
  humanity: "bar-chart-2",
  looks: "eye",
  popularity: "users",
  money: "dollar-sign",
  bounty: "target",
}

const VITAL_COLORS: Record<string, string> = {
  health: "#ff5f5f",
  stress: "#fbbf24",
  humanity: "#a855f7",
  looks: "#38bdf8",
  popularity: "#47a8bd",
  money: "#ffd54f",
  bounty: "#ff8b3d",
}

const SUBSKILL_GROUPS: Record<string, string[]> = {
  STR: ["athletics", "closeCombat", "heavyHandling"],
  INT: ["hacking", "medical", "engineering"],
  REF: ["marksmanship", "stealth", "mobility"],
  CHR: ["persuasion", "deception", "streetwise"],
}

const MAIN_SKILLS: Array<{ key: keyof ProfileData["skills"]; label: string; color: string }> = [
  { key: "str", label: "STR", color: SKILL_COLORS.STR },
  { key: "int", label: "INT", color: SKILL_COLORS.INT },
  { key: "ref", label: "REF", color: SKILL_COLORS.REF },
  { key: "chr", label: "CHR", color: SKILL_COLORS.CHR },
]

const SKILL_FLAVORS: Record<string, string[]> = {
  STR: [
    "Physically Unremarkable",
    "Easily Overpowered",
    "Average Build",
    "Hits Hard Enough",
    "Absolute Unit"
  ],
  INT: [
    "Local Idiot",
    "Not the Brightest",
    "Functionally Intelligent",
    "Sharp Mind",
    "Mad Genius"
  ],
  REF: [
    "Trips Over Nothing",
    "Clumsy",
    "Can Keep Up",
    "Highly Coordinated",
    "Lightning Reflexes"
  ],
  CHR: [
    "Off-Putting",
    "Socially Awkward",
    "Tolerable Company",
    "People Person",
    "Magnetic Personality"
  ],
}

const flavorFor = (skillLabel: string, level: number) => {
  const arr = SKILL_FLAVORS[skillLabel] || []
  const safeLevel = Math.max(1, Math.min(10, Math.round(level || 0)))
  const idx = Math.min(4, Math.floor((safeLevel - 1) / 2))
  return arr[idx] ?? ""
}

const pretty = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/^./, char => char.toUpperCase())

function SmallProgress({ value, max = 100, color = "#4caf50" }: { value: number; max?: number; color?: string }) {
  const safeMax = Math.max(1, max)
  const pct = Math.max(0, Math.min(100, Math.round((value / safeMax) * 100)))
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  )
}

function SegmentedBar({ value, max = 10, segments = 10, height = 48, color = "#4f82ff" }: { value: number; max?: number; segments?: number; height?: number; color?: string }) {
  const safeMax = Math.max(1, max)
  const clamped = Math.max(0, Math.min(safeMax, value))
  const filledCount = Math.round((clamped / safeMax) * segments)
  const gap = 2
  const totalGap = gap * Math.max(0, segments - 1)
  const segmentHeight = Math.max(3, Math.floor((height - totalGap) / segments))

  return (
    <View style={styles.segmentedColumn}>
      {Array.from({ length: segments }).map((_, idx) => {
        const filled = idx >= segments - filledCount
        return (
          <View
            key={idx}
              style={[
                styles.segmentedBlock,
                {
                  flex: 1,
                  width: "100%",
                  backgroundColor: filled ? color : "#151621",
                  marginBottom: idx === segments - 1 ? 0 : gap,
                },
              ]}
          />
        )
      })}
    </View>
  )
}

type Props = {
  open: boolean
  onClose: () => void
  profile?: ProfileData | null
  onRemoveAssignment?: (jobId: string) => void
}

export default function ProfileModal({ open, onClose, profile, onRemoveAssignment }: Props) {
  if (!profile) return null

  const subSkills = profile.skills.subSkills ?? {}

  return (
    <ModalCard open={open} onClose={onClose} title={profile.name}>
      <View style={styles.section}>
        <Text style={styles.muted}>{profile.gender} · {profile.ageLabel}</Text>
        <Text style={styles.muted}>District: {getDistrictById(profile.districtLabel || "")?.name ?? profile.districtLabel ?? "-"}</Text>
        {(profile.showAffiliations || profile.affiliations.length > 0) && (
          <Text style={styles.muted}>Affiliations: {profile.affiliations.length ? profile.affiliations.join(", ") : "None"}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bio</Text>
        <View style={[styles.cardBase, styles.vitalsCard]}>
          <View style={styles.vitalGrid}>
            {VITALS_DISPLAY.map(vital => {
              const value = (profile.vitals as any)[vital.key] ?? 0
              const neutral = "#9fa3b5"
              return (
                <View key={vital.key} style={styles.vitalItem}>
                  <View style={styles.vitalHeader}>
                    <Feather name={VITAL_ICON_NAMES[vital.key]} size={14} color={neutral} />
                    <Text style={styles.vitalLabel}>{vital.label}</Text>
                    <Text style={styles.vitalValue}>{value}</Text>
                  </View>
                  <SmallProgress value={value} max={VITAL_MAX[vital.key]} color={neutral} />
                </View>
              )
            })}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.skillRow}>
            {MAIN_SKILLS.map(skill => (
            <View key={skill.key} style={[styles.cardBase, styles.skillColumn]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {(() => {
                  const Icon = SKILL_DEFINITIONS[skill.label]?.Icon
                  return Icon ? <Icon size={14} color={skill.color} /> : null
                })()}
                <Text style={styles.skillTitle}>{skill.label} {profile.skills[skill.key]}{`\n${flavorFor(skill.label, profile.skills[skill.key])}`}</Text>
              </View>
              <View style={styles.skillInnerRow}>
                <SegmentedBar value={profile.skills[skill.key]} color={skill.color} />
                <View style={styles.subSkillsList}>
                  {SUBSKILL_GROUPS[skill.label].map(sub => {
                    const subValue = subSkills[sub] ?? 0
                    return (
                      <View key={sub} style={styles.subSkillRow}>
                        <View style={styles.subSkillHeading}>
                          <Text style={styles.subSkillLabel}>{pretty(sub)}</Text>
                          <Text style={styles.subSkillValue}>{subValue}</Text>
                        </View>
                        <SmallProgress value={subValue} max={100} color={skill.color} />
                      </View>
                    )
                  })}
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Occupations</Text>
        {profile.occupations.length === 0 ? <Text style={styles.muted}>Unemployed</Text> : null}
        {profile.occupations.map(occupation => (
          <View key={occupation.id} style={styles.occupationRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.occupationTitle}>{occupation.title}</Text>
              {occupation.affiliation ? <Text style={styles.occupationAffiliation}>{occupation.affiliation}</Text> : null}
              {occupation.description ? <Text style={styles.muted}>{occupation.description}</Text> : null}
            </View>
            {occupation.removable && onRemoveAssignment ? (
              <TouchableOpacity onPress={() => onRemoveAssignment(occupation.jobId ?? occupation.id)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>
    </ModalCard>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: 12 },
  sectionTitle: { color: "#fff", fontWeight: "800", marginBottom: 8, fontSize: 16 },
  muted: { color: "#9fa3b5", marginBottom: 4 },
  vitalGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  // three columns layout for mobile modal: each ~32% width
  vitalItem: { width: "32%", marginBottom: 10 },
  vitalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  vitalLabel: { flex: 1, color: "#ccc", marginLeft: 6, fontSize: 12 },
  vitalValue: { color: "#9fa3b5", fontWeight: "600", fontSize: 12 },
  progressBg: { width: "100%", height: 6, borderRadius: 6, backgroundColor: "#1d1e2b", position: "relative", overflow: "hidden", minWidth: 80 },
  progressFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6 },
  skillRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  cardBase: { backgroundColor: "#0e0f18", borderRadius: 10, borderWidth: 1, borderColor: "#1d2030" },
  skillColumn: { width: "48%", padding: 8, marginBottom: 10 },
  skillInnerRow: { flexDirection: "row", alignItems: "flex-start" },
  skillMeter: { marginBottom: 8, alignItems: "center" },
  skillTitle: { color: "#9fa3b5", fontWeight: "400", marginBottom: 6, textAlign: "left", fontSize: 12 },
  segmentedColumn: { width: 28, justifyContent: "flex-end", alignItems: "center", marginRight: 4 },
  segmentedBlock: { width: 14, borderRadius: 4 },
  subSkillsList: { flex: 1, paddingLeft: 4, minWidth: 100 },
  subSkillRow: { flexDirection: "column", alignItems: "flex-start", marginBottom: 1 },
  subSkillHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 2 },
  subSkillLabel: { color: "#9fa3b5", fontSize: 12 },
  subSkillValue: { color: "#9fa3b5", fontSize: 12, fontWeight: "400" },
  occupationRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderColor: "#1c1c28" },
  occupationTitle: { color: "#fff", fontWeight: "700" },
  occupationAffiliation: { color: "#9fa3b5", fontSize: 12 },
  remove: { color: "#ff7b7b", fontWeight: "700" },
  vitalsCard: { padding: 8 },
})
