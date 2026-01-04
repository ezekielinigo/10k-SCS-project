import { PALETTE_VARIATIONS, type Tone, type PaletteCategory, hexToRgb } from "./avatarPaletteConfig"
import { RENDER_ORDER, type RenderKey, CONTROL_ORDER, type ControlKey } from "@shared/utils/avatarConfig"

export type CharOptionsMap = Record<string, string[]>
export type LayerSelection = Record<ControlKey, number>
export type PaletteSelection = Partial<Record<PaletteCategory, number>>

// Build available character options from asset folders (same strategy used in DebugAvatarModal)
const modules = import.meta.glob("../assets/characters/**/*.{png,jpg,jpeg,webp,svg}", { eager: true, import: "default" }) as Record<string, string>
export function getCharacterOptions(): CharOptionsMap {
  const options: CharOptionsMap = {}
  for (const [path, src] of Object.entries(modules)) {
    const parts = path.split("/")
    const folder = parts.at(-2)
    if (!folder) continue
    const key = folder.toUpperCase()
    const arr = options[key] ?? (options[key] = [])
    arr.push(src)
  }
  for (const k of Object.keys(options)) options[k] = options[k].slice().sort()
  return options
}

export function getCountForControl(options: CharOptionsMap, key: ControlKey): number {
  if (key === "OUTER_BODY") {
    const backLen = (options["BODY_BACK"] ?? []).length
    const frontLen = (options["BODY_FRONT"] ?? []).length
    return Math.min(backLen, frontLen)
  }
  return (options[key] ?? []).length
}

export function randomizeLayers(options: CharOptionsMap): LayerSelection {
  const indices = {} as LayerSelection
  for (const ctl of CONTROL_ORDER) {
    const len = getCountForControl(options, ctl.key)
    indices[ctl.key] = len > 0 ? Math.floor(Math.random() * len) : 0
  }
  return indices
}

// --- Palette rule system ---
export type RuleViolation = {
  ruleId: string
  message: string
  categories: PaletteCategory[]
}

export type PaletteRule = {
  id: string
  description: string
  validate: (sel: PaletteSelection) => RuleViolation | null
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
    while (idx === avoidIndex && guard++ < 24) idx = Math.floor(Math.random() * len)
  }
  return idx
}

// Example rule: skin and inner body should not share the same dark or mid tone
export const rule_skin_vs_inner_body_distinct: PaletteRule = {
  id: "skin_vs_inner_body_distinct",
  description: "Skin and inner body palettes should not share the same dark or mid color",
  validate: (sel) => {
    const skin = resolveTone("skin", sel.skin)
    const inner = resolveTone("inner_body", sel.inner_body)
    if (!skin || !inner) return null
    const darkMatch = colorDistance(skin.dark, inner.dark) <= 0
    const midMatch = colorDistance(skin.mid, inner.mid) <= 0
    // Violate only if both dark and mid match exactly
    if (darkMatch && midMatch) {
      return {
        ruleId: "skin_vs_inner_body_distinct",
        message: "Skin and inner body share the same dark and mid colors",
        categories: ["skin", "inner_body"],
      }
    }
    return null
  },
  fix: (sel) => {
    const skin = resolveTone("skin", sel.skin)
    let nextInner = sel.inner_body ?? null
    if (!skin) return sel
    const arr = PALETTE_VARIATIONS.inner_body ?? []
    if (!arr.length) return sel
    // Try a few times to find a distinct inner_body palette
    for (let i = 0; i < Math.min(arr.length, 12); i++) {
      const candidate = pickAlternativeIndex("inner_body", nextInner)
      const tone = resolveTone("inner_body", candidate)
      if (tone && colorDistance(skin.dark, tone.dark) > 0 && colorDistance(skin.mid, tone.mid) > 0) {
        nextInner = candidate
        break
      }
      nextInner = candidate
    }
    return { ...sel, inner_body: nextInner ?? sel.inner_body }
  },
}

export const DEFAULT_RULES: PaletteRule[] = [rule_skin_vs_inner_body_distinct]

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

export function randomizePalettes(): PaletteSelection {
  const pick = (cat: PaletteCategory): number | undefined => {
    const arr = PALETTE_VARIATIONS[cat] ?? []
    if (!arr.length) return undefined
    return Math.floor(Math.random() * arr.length)
  }
  return {
    skin: pick("skin"),
    hair: pick("hair"),
    eyes: pick("eyes"),
    accessory: pick("accessory"),
    outer_body: pick("outer_body"),
    inner_body: pick("inner_body"),
  }
}

export function randomizePalettesWithRules(rules: PaletteRule[] = DEFAULT_RULES): PaletteSelection {
  const sel = randomizePalettes()
  return enforceRules(sel, rules)
}

export type GeneratedAvatar = {
  layers: LayerSelection
  palettes: PaletteSelection
  violations?: RuleViolation[]
}

export function generateAvatar(options?: CharOptionsMap, rules: PaletteRule[] = DEFAULT_RULES): GeneratedAvatar {
  const opts = options ?? getCharacterOptions()
  const layers = randomizeLayers(opts)
  const palettes = randomizePalettesWithRules(rules)
  const violations = evaluateRules(palettes, rules)
  return { layers, palettes, violations }
}
