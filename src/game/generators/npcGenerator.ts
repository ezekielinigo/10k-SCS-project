import { getNpcTemplateById, listNpcTemplates } from "../content/npcTemplates"
import { createNpc } from "../content/npcProfiles"
import { pickName, resolveNameGroupFirst } from "../content/names"
import type { Gender, NpcState, SkillBlock, VitalBlock } from "../types"

const randId = () => Math.random().toString(36).slice(2)

// simple seeded RNG for repeatable results when a seed is provided
const makeRng = (seed?: string) => {
  if (!seed) return Math.random
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6D2B79F5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)]

const roll = ([min, max]: [number, number], rng: () => number): number =>
  Math.round(min + (max - min) * rng())

const cloneVitals = (v: VitalBlock): VitalBlock => ({ ...v })

const cloneSkills = (s: SkillBlock): SkillBlock => ({ ...s, subSkills: { ...s.subSkills } })

export type GenerateNpcOptions = {
  seed?: string
  templateId?: string
  forceDistrict?: string
  extraTags?: string[]
  allowUnique?: boolean
  uniqueChance?: number // 0-1
  gender?: Gender
}

const GENDER_POOL: Gender[] = ["female", "male"]

const buildVitals = (rng: () => number, vitals: {
  health: [number, number]
  humanity: [number, number]
  stress: [number, number]
  money: [number, number]
  looks: [number, number]
  bounty: [number, number]
}): VitalBlock => ({
  health: roll(vitals.health, rng),
  stress: roll(vitals.stress, rng),
  humanity: roll(vitals.humanity, rng),
  money: roll(vitals.money, rng),
  looks: roll(vitals.looks, rng),
  bounty: roll(vitals.bounty, rng),
})

// default jitter expressed as percent offsets (e.g. -25..25 means -25%..+25%)
const DEFAULT_SUBSKILL_JITTER: [number, number] = [-25, 25]

const SUBSKILL_PARENT: Record<keyof SkillBlock["subSkills"], keyof SkillBlock> = {
  athletics: "str",
  closeCombat: "str",
  heavyHandling: "str",
  hacking: "int",
  medical: "int",
  engineering: "int",
  marksmanship: "ref",
  stealth: "ref",
  mobility: "ref",
  persuasion: "chr",
  deception: "chr",
  streetwise: "chr",
}

// clamp subskill to [0, parentPercent] so it cannot exceed its parent's percent
const clampToParent = (value: number, parentPercent: number): number => Math.max(0, Math.min(parentPercent, value))

const STAT_POOL = 12

const buildSkills = (rng: () => number, skills: {
  str: [number, number]
  int: [number, number]
  ref: [number, number]
  chr: [number, number]
  subSkills?: Partial<Record<keyof SkillBlock["subSkills"], [number, number]>>
}): SkillBlock => {
  // 1) determine priority weights by sampling each template range
  const weightStr = roll(skills.str, rng)
  const weightInt = roll(skills.int, rng)
  const weightRef = roll(skills.ref, rng)
  const weightChr = roll(skills.chr, rng)

  const weights = { str: weightStr, int: weightInt, ref: weightRef, chr: weightChr }
  const totalWeight = weightStr + weightInt + weightRef + weightChr

  // 2) amplify weight differences so priorities have stronger effect
  // exponent > 1 increases dominance of higher weights
  const PRIORITY_EXPONENT = 1.6
  const rawWeights = {
    str: Math.pow(weightStr, PRIORITY_EXPONENT),
    int: Math.pow(weightInt, PRIORITY_EXPONENT),
    ref: Math.pow(weightRef, PRIORITY_EXPONENT),
    chr: Math.pow(weightChr, PRIORITY_EXPONENT),
  }
  const totalRaw = rawWeights.str + rawWeights.int + rawWeights.ref + rawWeights.chr

  // deterministic proportional allocation: give each skill floor(exact) points
  // then distribute remaining points by weighted random using rawWeights
  const exactAlloc = {
    str: (rawWeights.str / totalRaw) * STAT_POOL,
    int: (rawWeights.int / totalRaw) * STAT_POOL,
    ref: (rawWeights.ref / totalRaw) * STAT_POOL,
    chr: (rawWeights.chr / totalRaw) * STAT_POOL,
  }

  const allocs: Record<string, number> = {
    str: Math.floor(exactAlloc.str),
    int: Math.floor(exactAlloc.int),
    ref: Math.floor(exactAlloc.ref),
    chr: Math.floor(exactAlloc.chr),
  }

  let remaining = STAT_POOL - (allocs.str + allocs.int + allocs.ref + allocs.chr)
  while (remaining > 0) {
    const r = rng() * (rawWeights.str + rawWeights.int + rawWeights.ref + rawWeights.chr)
    let cursor = 0
    for (const k of Object.keys(rawWeights)) {
      cursor += (rawWeights as any)[k]
      if (r <= cursor) {
        allocs[k]++
        break
      }
    }
    remaining--
  }

  // 3) map allocations to 1-10 skill levels. each skill gets at least 1.
  const toLevel = (points: number) => 1 + Math.round((points / STAT_POOL) * 9)

  const base: SkillBlock = {
    str: toLevel(allocs.str),
    int: toLevel(allocs.int),
    ref: toLevel(allocs.ref),
    chr: toLevel(allocs.chr),
    subSkills: {
      athletics: 0,
      closeCombat: 0,
      heavyHandling: 0,
      hacking: 0,
      medical: 0,
      engineering: 0,
      marksmanship: 0,
      stealth: 0,
      mobility: 0,
      persuasion: 0,
      deception: 0,
      streetwise: 0,
    },
  }

  // 4) derive subskills from parent skills using existing percent-based jitter logic
  for (const [subKey, parentKey] of Object.entries(SUBSKILL_PARENT)) {
    const parentValue = base[parentKey]
    const parentPercent = Math.round(parentValue * 10)

    const aSample = Math.round(parentPercent * rng())
    const range = skills.subSkills?.[subKey as keyof SkillBlock["subSkills"]] ?? DEFAULT_SUBSKILL_JITTER
    const jitterPercent = roll(range, rng)
    const computed = Math.round(aSample * (1 + jitterPercent / 100))
    base.subSkills[subKey as keyof SkillBlock["subSkills"]] = clampToParent(computed, parentPercent)
  }

  return base
}

export function generateNpcFromTemplate(templateId: string, opts?: GenerateNpcOptions): NpcState {
  const template = getNpcTemplateById(templateId)
  if (!template) throw new Error(`Unknown NPC template: ${templateId}`)

  const rng = makeRng(opts?.seed ?? randId())

  const gender = opts?.gender ?? pick(GENDER_POOL, rng)
  // support two forms of template.namePattern:
  // - concrete object { first: string[]; last: string[] }
  // - array of named groups [maleGroupKey, femaleGroupKey, neutralGroupKey?]
  let fallbackFirst: string[] | undefined = undefined
  let fallbackLast: string[] | undefined = undefined
  if (Array.isArray(template.namePattern)) {
    const pattern = template.namePattern as string[]
    // choose group key by gender where possible (male -> index 0, female -> index 1)
    let groupKey = pattern[0]
    if (gender === "female" && pattern[1]) groupKey = pattern[1]
    fallbackFirst = resolveNameGroupFirst(groupKey)
  } else {
    fallbackFirst = (template.namePattern as any).first
    fallbackLast = (template.namePattern as any).last
  }

  const { first, last } = pickName(rng, {
    gender,
    tags: template.tags,
    fallbackFirst,
    fallbackLast,
  })
  const name = `${first} ${last}`

  const avatarId = pick(template.avatarPool, rng)
  const age = roll(template.age, rng)
  const vitals = buildVitals(rng, template.vitals)
  const skills = buildSkills(rng, template.skills)
  const currentDistrict = opts?.forceDistrict ?? pick(template.districts ?? ["downtown"], rng)
  const tags = [...template.tags, ...(opts?.extraTags ?? [])]

  // choose 0-N affiliations from template (cap at 2 for variety)
  const affiliations: string[] = []
  if (template.affiliationIds?.length) {
    const choices = [...template.affiliationIds]
    const maxPick = Math.min(2, choices.length)
    const pickCount = roll([0, maxPick], rng)
    for (let i = 0; i < pickCount; i++) {
      const idx = Math.floor(rng() * choices.length)
      affiliations.push(choices.splice(idx, 1)[0])
    }
  }

  return {
    id: randId(),
    name,
    age,
    gender,
    avatarId,
    vitals,
    skills,
    currentDistrict,
    tags,
    affiliationIds: affiliations,
    origin: "template",
    templateId: template.id,
    seed: opts?.seed,
  }
}

export function generateRandomNpc(opts?: GenerateNpcOptions): NpcState {
  const rng = makeRng(opts?.seed ?? randId())

  if (opts?.allowUnique && rng() < (opts.uniqueChance ?? 0)) {
    const unique = createNpc()
    return { ...unique, id: randId(), seed: opts?.seed, origin: "unique" }
  }

  const templates = listNpcTemplates()
  if (templates.length === 0) throw new Error("No NPC templates available")
  const templateId = opts?.templateId ?? pick(templates, rng).id
  return generateNpcFromTemplate(templateId, { ...opts, seed: opts?.seed ?? randId() })
}

export function generateNpcBatch(count: number, opts?: GenerateNpcOptions): NpcState[] {
  const result: NpcState[] = []
  for (let i = 0; i < count; i++) {
    const perSeed = opts?.seed ? `${opts.seed}__${i}` : undefined
    result.push(generateRandomNpc({ ...(opts ?? {}), seed: perSeed }))
  }
  return result
}
