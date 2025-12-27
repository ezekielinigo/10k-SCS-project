import type { PlayerState } from "./types"
import { makeRng, performStatCheck, type MainStatKey, type StatCheckResult, type SubSkillKey } from "./statCheck"

export type InkStatCheckEvent = {
  statName: string
  dc: number
  mainStatKey: MainStatKey
  subSkillKey?: SubSkillKey
  result: StatCheckResult
}

const statCheckListeners = new Set<(evt: InkStatCheckEvent) => void>()

export const onInkStatCheck = (listener: (evt: InkStatCheckEvent) => void) => {
  statCheckListeners.add(listener)
  return () => statCheckListeners.delete(listener)
}

const emitInkStatCheck = (evt: InkStatCheckEvent) => {
  for (const fn of statCheckListeners) {
    try {
      fn(evt)
    } catch (e) {
      // swallow listener errors to avoid blocking ink evaluation
    }
  }
}

export type InkFrame = { text: string; choices: any[] }

const shuffle = <T,>(arr: T[], rng: () => number) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function revealRandomOptionsForEncounter(
  story: any,
  total = 5,
  show = 3,
  rng: () => number = makeRng(),
  prefix = "ch_",
  // optional quit flags: how many quit variants exist, how many to show, and their prefix
  quitTotal = 2,
  quitShow = 1,
  quitPrefix = "quit_",
) {
  // reveal regular choices
  const count = Math.max(0, Math.min(show, total))
  const indices = shuffle(Array.from({ length: total }, (_, i) => i + 1), rng)
  const chosen = new Set(indices.slice(0, count))
  for (let i = 1; i <= total; i++) {
    const name = `${prefix}${i}`
    ;(story as any).variablesState[name] = chosen.has(i)
  }

  // reveal quit variants, ensuring at least one is shown if quitShow > 0
  const qCount = Math.max(0, Math.min(quitShow, quitTotal))
  const qIndices = shuffle(Array.from({ length: quitTotal }, (_, i) => i + 1), rng)
  const qChosen = new Set(qIndices.slice(0, qCount))
  // Guarantee at least one quit is visible if quitShow requested but shuffle picked none (edge-case)
  if (qCount > 0 && qChosen.size === 0 && quitTotal > 0) {
    qChosen.add(1)
  }
  for (let i = 1; i <= quitTotal; i++) {
    const name = `${quitPrefix}${i}`
    ;(story as any).variablesState[name] = qChosen.has(i)
  }
}

const SUB_TO_MAIN: Record<SubSkillKey, MainStatKey> = {
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

const normalizeKey = (raw: any) => String(raw ?? "").replace(/[^a-zA-Z]/g, "").toLowerCase()

const toD20Dc = (threshold: any, rng: () => number = Math.random) => {
  // Support numeric threshold or a range specified as [min,max] or "min,max"
  if (Array.isArray(threshold) && threshold.length >= 2) {
    const a = Number(threshold[0]) || 0
    const b = Number(threshold[1]) || 0
    const min = Math.min(a, b)
    const max = Math.max(a, b)
    const rolledThreshold = Math.floor(rng() * (max - min + 1)) + min
    return Math.max(5, Math.round(rolledThreshold) + 10)
  }

  if (typeof threshold === "string") {
    const m = threshold.match(/^\s*([0-9]+)\s*,\s*([0-9]+)\s*$/)
    if (m) {
      const min = Number(m[1])
      const max = Number(m[2])
      const rolledThreshold = Math.floor(rng() * (max - min + 1)) + min
      return Math.max(5, Math.round(rolledThreshold) + 10)
    }
  }

  const n = Number(threshold)
  if (!Number.isFinite(n)) return 10
  return Math.max(5, Math.round(n) + 10)
}

function resolveStatCheck(player: PlayerState, rawStat: any, threshold: any, rng: () => number) {
  const key = normalizeKey(rawStat)
  const dc = toD20Dc(threshold, rng)
  const skills = player.skills as any

  if (key in (skills ?? {})) {
    const mainKey = key as MainStatKey
    return { mainKey, subKey: undefined as SubSkillKey | undefined, mainVal: Number(skills[mainKey] ?? 0), subVal: undefined, dc }
  }

  const subSkills = skills?.subSkills ?? {}
  if (key in subSkills) {
    const subKey = key as SubSkillKey
    const mainKey = SUB_TO_MAIN[subKey] ?? "int"
    return {
      mainKey,
      subKey,
      mainVal: Number(skills[mainKey] ?? 0),
      subVal: Number(subSkills[subKey] ?? 0),
      dc,
    }
  }

  // fallback: best-effort using first three letters for fuzzy matching
  const short = key.slice(0, 3)
  const mainGuess = (skills?.[short] ?? skills?.[key]) as number | undefined
  return { mainKey: "int" as MainStatKey, subKey: undefined as SubSkillKey | undefined, mainVal: Number(mainGuess ?? 0), subVal: undefined, dc }
}

const bindInkExternals = (story: any, player: PlayerState) => {
  const bind = (name: string, handler: (...args: any[]) => any) => {
    if (typeof (story as any).BindExternalFunction === "function") {
      ;(story as any).BindExternalFunction(name, handler)
    } else if (typeof (story as any).bindExternalFunction === "function") {
      ;(story as any).bindExternalFunction(name, handler)
    }
  }

  try {
    bind("hasStat", (statName: any, threshold: any) => {
      try {
        // Use a single RNG instance for the threshold pick and the d20 roll
        const rng = makeRng()
        const { mainKey, subKey, mainVal, subVal, dc } = resolveStatCheck(player, statName, threshold, rng)
        const result = performStatCheck({ dc, mainStat: mainVal, subSkill: subVal, rng })
        emitInkStatCheck({ statName: String(statName), dc, mainStatKey: mainKey, subSkillKey: subKey, result })
        return result.success
      } catch (e) {
        return false
      }
    })

    bind("hasMoney", (amount: any) => {
      try {
        return Number(player.vitals.money) >= Number(amount)
      } catch (e) {
        return false
      }
    })
  } catch (e) {
    console.warn("Failed to bind ink externals:", e)
  }
}

export const resolveInkFrames = (story: any): InkFrame[] => {
  let out = ""
  while (story.canContinue) {
    out += story.Continue()
    if (story.canContinue) out += "\n"
  }

  return [{ text: out, choices: story.currentChoices ?? [] }]
}

export const createInkStory = async (knot: string | undefined, player: PlayerState, inkSource?: string, initialVars?: Record<string, any>) => {
  const InkModule = await import("inkjs")
  const StoryCtor = (InkModule as any).Story ?? (InkModule as any).default ?? InkModule
  if (!StoryCtor) throw new Error("inkjs Story constructor not found")

  const fallbackSource = "/src/ink/career_mechanic.json"
  let tasks: any
  try {
    const normalize = (src: string) => {
      // If already absolute, use as-is. Otherwise prefer Vite-friendly /src/ path.
      if (src.startsWith("/") || src.startsWith("http")) return src
      // strip leading ./ or ../
      const cleaned = src.replace(/^\.\/?/, "").replace(/^\.\.\//, "")
      return `/src/${cleaned}`
    }

    if (inkSource) {
      const spec = normalize(inkSource)
      tasks = (await import(/* @vite-ignore */ spec)) as any
    } else {
      tasks = (await import(fallbackSource)) as any
    }
  } catch (e) {
    throw new Error(`Failed to load ink content from ${inkSource ?? fallbackSource}: ${(e as any)?.message ?? e}`)
  }

  const story = new StoryCtor(tasks)
  bindInkExternals(story, player)

  // Apply any initial variables into the story before choosing a path
  try {
    if (initialVars && typeof initialVars === "object") {
      for (const [k, v] of Object.entries(initialVars)) {
        ;(story as any).variablesState[k] = v
      }
    }
  } catch (e) {
    // swallow; not critical
  }

  if (knot && typeof story.ChoosePathString === "function") {
    story.ChoosePathString(knot)
  }

  return story
}

export const inkUtils = {
  createInkStory,
  resolveInkFrames,
  bindInkExternals,
  revealRandomOptionsForEncounter,
}
