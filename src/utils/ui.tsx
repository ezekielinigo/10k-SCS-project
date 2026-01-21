import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { Feather } from "@expo/vector-icons"
import {
  Aperture,
  BicepsFlexed,
  Brain,
  BatteryCharging,
  Calendar,
  Droplet,
  MessageCircle,
  Minimize2,
  RefreshCw,
  SkipForward,
  Sparkles,
  Zap,
} from "lucide-react-native"

export type VitalKey = "health" | "stress" | "humanity" | "looks" | "popularity" | "money"

type VitalDefinition = {
  key: VitalKey
  label: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
  symbol?: string
  max?: number
  enabled?: boolean
}

export const VITAL_DEFINITIONS: Record<VitalKey, VitalDefinition> = {
  health: { key: "health", label: "Health", Icon: (p) => <Feather name="heart" size={p.size ?? 14} color={p.color ?? "#fff"} />, max: 100, enabled: true },
  stress: { key: "stress", label: "Stress", Icon: (p) => <Feather name="activity" size={p.size ?? 14} color={p.color ?? "#fff"} />, max: 100, enabled: true },
  humanity: { key: "humanity", label: "Humanity", Icon: (p) => <Feather name="bar-chart-2" size={p.size ?? 14} color={p.color ?? "#fff"} />, max: 100, enabled: false },
  looks: { key: "looks", label: "Looks", Icon: (p) => <Feather name="eye" size={p.size ?? 14} color={p.color ?? "#fff"} />, max: 100, enabled: false },
  popularity: { key: "popularity", label: "Popularity", Icon: (p) => <Feather name="users" size={p.size ?? 14} color={p.color ?? "#fff"} />, max: 100, enabled: false },
  money: { key: "money", label: "Money", Icon: (p) => <Feather name="dollar-sign" size={p.size ?? 14} color={p.color ?? "#fff"} />, max: 100, enabled: true },
}

type SkillDefinition = {
  key: string
  label: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
}

export const SKILL_DEFINITIONS: Record<string, SkillDefinition> = {
  STR: { key: "STR", label: "Strength", Icon: (p) => <BicepsFlexed size={p.size ?? 14} color={p.color ?? "#fff"} /> },
  INT: { key: "INT", label: "Intelligence", Icon: (p) => <Brain size={p.size ?? 14} color={p.color ?? "#fff"} /> },
  REF: { key: "REF", label: "Reflexes", Icon: (p) => <Aperture size={p.size ?? 14} color={p.color ?? "#fff"} /> },
  CHR: { key: "CHR", label: "Charisma", Icon: (p) => <MessageCircle size={p.size ?? 14} color={p.color ?? "#fff"} /> },
}

export const STAT_ICONS = {
  health: (p: { size?: number; color?: string }) => <Feather name="heart" size={p.size ?? 16} color={p.color ?? "#fff"} />,
  shield: (p: { size?: number; color?: string }) => <Feather name="shield" size={p.size ?? 16} color={p.color ?? "#fff"} />,
}

type StatusIconDefinition = {
  Icon: React.ComponentType<{ size?: number; color?: string }>
}

export const STATUS_ICON_MAP: Record<string, StatusIconDefinition> = {
  power_turn_draw: { Icon: Sparkles },
  repeat_next_attack: { Icon: RefreshCw },
  draw_next_turn: { Icon: Calendar },
  skip_next_turn: { Icon: SkipForward },
  hand_size_minus_one: { Icon: Minimize2 },
  energy_plus_one: { Icon: Zap },
  energy_plus_three: { Icon: BatteryCharging },
  blood_tax: { Icon: Droplet },
}

export const SUBSKILL_PARENT_ABBREV: Record<string, keyof typeof SKILL_DEFINITIONS> = {
  athletics: "STR",
  closeCombat: "STR",
  heavyHandling: "STR",
  hacking: "INT",
  medical: "INT",
  engineering: "INT",
  marksmanship: "REF",
  stealth: "REF",
  mobility: "REF",
  persuasion: "CHR",
  deception: "CHR",
  streetwise: "CHR",
}

export const PLAYER_VITAL_KEYS: VitalKey[] = ["health", "stress", "humanity", "looks", "popularity", "money"]

type SkillColorKey = "DEFAULT" | "STR" | "INT" | "REF" | "CHR"

export const SKILL_COLORS: Record<SkillColorKey, string> = {
  DEFAULT: "#888888",
  STR: "#ff1053",
  INT: "#47A8BD",
  REF: "#2C6E49",
  CHR: "#F5E663",
}

type RarityColorKey = "common" | "uncommon" | "rare" | "unique"

export const RARITY_COLORS: Record<RarityColorKey, string> = {
  common: "#888888",
  uncommon: "#47A8BD",
  rare: "#ff1053",
  unique: "#F5E663",
}


export const chooseIndefiniteArticle = (title?: string | null): string => {
  const jobTitle = (title ?? "").toLowerCase().trim()
  if (!jobTitle) return "a"
  if (/^(honest|hour|honour|heir)/i.test(jobTitle)) return "an"
  if (/^(uni|use|user|one|once|eu|euro)/i.test(jobTitle)) return "a"
  return /^[aeiou]/i.test(jobTitle) ? "an" : "a"
}

export function renderDeltaPills(deltas?: Record<string, number>) {
  if (!deltas) return null
  const entries = Object.entries(deltas).filter(([, v]) => Number(v) !== 0)
  if (entries.length === 0) return null

  return (
    <View style={styles.deltaContainer}>
      {entries.map(([key, rawValue]) => {
        const lower = String(key).toLowerCase()
        const value = Number(rawValue) || 0
        const signed = value > 0 ? `+${value}` : `${value}`
        const positive = value > 0
        const isStress = lower === "stress"

        let fg = positive ? "#34d399" : "#f87171"
        let bg = positive ? "#34d3991a" : "#f871711a"
        let border = positive ? "#34d39940" : "#f8717140"
        if (isStress) {
          fg = positive ? "#f87171" : "#34d399"
          bg = positive ? "#f871711a" : "#34d3991a"
          border = positive ? "#f8717140" : "#34d39940"
        }

        const pretty = (s: string) => String(s).replace(/([A-Z])/g, " $1").trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")

        const vitalDef = (VITAL_DEFINITIONS as Record<string, any>)[lower as string] as VitalDefinition | undefined
        const skillDef = (SKILL_DEFINITIONS as Record<string, any>)[String(key).toUpperCase()]
        const parentAbbrev = SUBSKILL_PARENT_ABBREV[lower]
        const parentSkillDef = parentAbbrev ? SKILL_DEFINITIONS[parentAbbrev] : undefined

        let labelText: string | null = null
        if (!vitalDef) {
          if (skillDef) {
            const isAbbrev = String(key).toUpperCase() === skillDef.key
            labelText = isAbbrev ? skillDef.key : pretty(key)
          } else {
            labelText = pretty(key)
          }
        }
        const text = labelText ? `${labelText} ${signed}` : signed

        const IconComponent: React.ComponentType<any> | null = vitalDef ? vitalDef.Icon : skillDef ? skillDef.Icon : parentSkillDef ? parentSkillDef.Icon : null

        return (
          <View key={`${key}-${signed}`} style={[styles.pill, { backgroundColor: bg, borderColor: border }] as any}>
            {IconComponent ? <IconComponent size={12} color={fg} /> : null}
            <Text style={[styles.pillText, { color: fg }]}>{text}</Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  deltaContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, marginRight: 1, marginBottom: 6 },
  pillText: { fontSize: 12 },
})

export default { chooseIndefiniteArticle, renderDeltaPills }
