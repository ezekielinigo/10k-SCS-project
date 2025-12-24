import type { PlayerState } from "./types"

export type InkFrame = { text: string; choices: any[] }

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
        const key = String(statName).replace(/[^a-zA-Z]/g, "").toLowerCase()
        const skills = player.skills as any
        const value =
          skills[key] ??
          skills[key.slice(0, 3)] ??
          skills.subSkills?.[key] ??
          skills.subSkills?.[key.slice(0, 3)] ??
          0
        return Number(value) >= Number(threshold)
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

export const createInkStory = async (knot: string | undefined, player: PlayerState, inkSource?: string) => {
  const InkModule = await import("inkjs")
  const StoryCtor = (InkModule as any).Story ?? (InkModule as any).default ?? InkModule
  if (!StoryCtor) throw new Error("inkjs Story constructor not found")

  const fallbackSource = "../ink/career_mechanic.json"
  let tasks: any
  try {
    if (inkSource) {
      tasks = (await import(/* @vite-ignore */ inkSource)) as any
    } else {
      tasks = (await import(fallbackSource)) as any
    }
  } catch (e) {
    throw new Error(`Failed to load ink content from ${inkSource ?? fallbackSource}: ${(e as any)?.message ?? e}`)
  }

  const story = new StoryCtor(tasks)
  bindInkExternals(story, player)

  if (knot && typeof story.ChoosePathString === "function") {
    story.ChoosePathString(knot)
  }

  return story
}

export const inkUtils = {
  createInkStory,
  resolveInkFrames,
  bindInkExternals,
}
