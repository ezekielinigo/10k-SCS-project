import type { SkillBlock } from "./types"

export type StatCheckMapping = "quintile" | "scaled" | ((skill: number) => number)

export type StatCheckParams = {
  dc: number
  mainStat: number
  subSkill?: number
  mapping?: StatCheckMapping
  rng?: () => number
  allowCritical?: boolean
}

export type StatCheckResult = {
  d20: number
  mainStat: number
  subSkill?: number
  subSkillBonus: number
  total: number
  dc: number
  success: boolean
  margin: number
  critical?: "nat20" | "nat1" | null
}

export type MainStatKey = Exclude<keyof SkillBlock, "subSkills">
export type SubSkillKey = keyof SkillBlock["subSkills"]

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function makeRng(seed?: string): () => number {
  if (!seed) return Math.random
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0
  return function rng() {
    state += 0x6D2B79F5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function subSkillToBonus(subSkill: number | undefined, mapping: StatCheckMapping = "quintile"): number {
  if (subSkill == null) return 0
  const clamped = clamp(subSkill, 0, 100)
  if (typeof mapping === "function") return clamp(Math.floor(mapping(clamped)), 0, 4)
  if (mapping === "scaled") return clamp(Math.round((clamped / 100) * 4), 0, 4)
  // custom bins:
  // 0-24: 0
  // 25-49: +1
  // 50-74: +2
  // 75-94: +3
  // 95-100: +4
  if (clamped >= 95) return 4
  if (clamped >= 75) return 3
  if (clamped >= 50) return 2
  if (clamped >= 25) return 1
  return 0
}

function rollD20(rng: () => number): number {
  return Math.floor(rng() * 20) + 1
}

export function performStatCheck({ dc, mainStat, subSkill, mapping = "quintile", rng = Math.random, allowCritical = true }: StatCheckParams): StatCheckResult {
  const d20 = rollD20(rng)
  const subSkillBonus = subSkillToBonus(subSkill, mapping)
  const total = d20 + mainStat + subSkillBonus
  const margin = total - dc

  if (allowCritical && d20 === 20) {
    return {
      d20,
      mainStat,
      subSkill,
      subSkillBonus,
      total,
      dc,
      success: true,
      margin: Number.isFinite(margin) ? Math.max(1, margin) : 1,
      critical: "nat20",
    }
  }

  if (allowCritical && d20 === 1) {
    return {
      d20,
      mainStat,
      subSkill,
      subSkillBonus,
      total,
      dc,
      success: false,
      margin: Number.isFinite(margin) ? Math.min(-1, margin) : -1,
      critical: "nat1",
    }
  }

  return {
    d20,
    mainStat,
    subSkill,
    subSkillBonus,
    total,
    dc,
    success: total >= dc,
    margin,
    critical: null,
  }
}
