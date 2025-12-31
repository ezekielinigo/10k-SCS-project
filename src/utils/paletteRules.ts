import { PALETTE_VARIATIONS, type Tone, type PaletteCategory, hexToRgb } from "./palettes"

export type PaletteSelection = Partial<Record<PaletteCategory, number>>

export type RuleViolation = {
  ruleId: string
  message: string
  categories: PaletteCategory[]
}

export type PaletteRule = {
  id: string
  description: string
  validate: (sel: PaletteSelection) => RuleViolation | null
  // Optional automatic fix: returns an adjusted selection
  fix?: (sel: PaletteSelection) => PaletteSelection
}

function colorDistance(a?: string, b?: string): number {
  if (!a || !b) return Number.POSITIVE_INFINITY
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  const dr = ra.r - rb.r
  const dg = ra.g - rb.g
  const db = ra.b - rb.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function resolveTone(category: PaletteCategory, index?: number | null): Tone | null {
  if (index == null) return null
  const arr = PALETTE_VARIATIONS[category] ?? []
  if (!arr.length) return null
  return arr[Math.max(0, Math.min(index, arr.length - 1))] ?? null
}

function pickAlternativeIndex(category: PaletteCategory, avoidIndex?: number | null): number | null {
  const arr = PALETTE_VARIATIONS[category] ?? []
  const len = arr.length
  if (!len) return null
  if (len === 1) return 0
  let idx = Math.floor(Math.random() * len)
  if (avoidIndex != null && len > 1) {
    let guard = 0
    while (idx === avoidIndex && guard++ < 16) idx = Math.floor(Math.random() * len)
  }
  return idx
}

// Example rule: skin and hair should not be too similar
export const rule_skin_vs_hair_distinct: PaletteRule = {
  id: "skin_vs_hair_distinct",
  description: "Skin and hair palettes should not be the same or too similar",
  validate: (sel) => {
    const skin = resolveTone("skin", sel.skin)
    const hair = resolveTone("hair", sel.hair)
    if (!skin || !hair) return null
    const d = colorDistance(skin.dark, hair.dark)
    // Tolerance 0 means equal; allow small distance threshold if desired
    if (d <= 0) {
      return {
        ruleId: "skin_vs_hair_distinct",
        message: "Skin and hair share the same base dark color",
        categories: ["skin", "hair"],
      }
    }
    return null
  },
  fix: (sel) => {
    const hairIdx = sel.hair ?? null
    const nextHair = pickAlternativeIndex("hair", hairIdx)
    return { ...sel, hair: nextHair ?? sel.hair }
  },
}

export const DEFAULT_RULES: PaletteRule[] = [rule_skin_vs_hair_distinct]

export function evaluateRules(sel: PaletteSelection, rules: PaletteRule[] = DEFAULT_RULES): RuleViolation[] {
  const violations: RuleViolation[] = []
  for (const r of rules) {
    const v = r.validate(sel)
    if (v) violations.push(v)
  }
  return violations
}

export function enforceRules(sel: PaletteSelection, rules: PaletteRule[] = DEFAULT_RULES): PaletteSelection {
  let current = { ...sel }
  for (const r of rules) {
    const v = r.validate(current)
    if (v && r.fix) {
      current = r.fix(current)
    }
  }
  return current
}
