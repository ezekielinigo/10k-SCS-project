import { useEffect, useState } from "react"
import { listCareers } from "./content/careers"
import { getRandomEventTemplateById } from "./content/randomEvents"
import { describeTask } from "./taskLookup"
import type { GameState } from "./types"
import type { GameAction } from "./gameReducer"
import { createInkStory, onInkStatCheck, resolveInkFrames, revealRandomOptionsForEncounter, type InkFrame, type InkStatCheckEvent } from "./ink"

type UseInkArgs = {
  state: GameState
  dispatch: (action: GameAction) => void
}

type UseInkReturn = {
  inkOpen: boolean
  inkFrames: InkFrame[]
  inkVars: any
  inkTitle: string | null
  openInkDebug: () => Promise<void>
  openInkForTask: (taskId: string, taskGraphId: string) => Promise<void>
  handleChoose: (choiceIndex: number) => void
  handleCloseInkModal: () => void
  inkStatCheck: InkStatCheckEvent | null
  inkStatCheckOpen: boolean
  closeInkStatCheck: () => void
}

export const useInk = ({ state, dispatch }: UseInkArgs): UseInkReturn => {
  const [inkOpen, setInkOpen] = useState(false)
  const [inkStory, setInkStory] = useState<any | null>(null)
  const [inkFrames, setInkFrames] = useState<InkFrame[]>([])
  const [inkTaskPendingResolve, setInkTaskPendingResolve] = useState<string | null>(null)
  const [inkTaskPendingGraphId, setInkTaskPendingGraphId] = useState<string | null>(null)
  const [inkTitle, setInkTitle] = useState<string | null>(null)
  const [inkStatCheck, setInkStatCheck] = useState<InkStatCheckEvent | null>(null)
  const [inkStatCheckOpen, setInkStatCheckOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onInkStatCheck(evt => {
      setInkStatCheck(evt)
      setInkStatCheckOpen(true)
    })
    return () => { unsubscribe() }
  }, [dispatch])

  const openInkDebug = async () => {
    try {
      const careers = listCareers()
      let inkSource: string | undefined
      for (const c of careers) {
        const level = c.levels.find(l => l.taskGraphId === "mechanic_apprentice_shift")
        if (level) {
          inkSource = level.inkSource ?? c.inkSource
          break
        }
      }

      const story = await createInkStory("mechanic_apprentice_shift", state.player, inkSource)
      setInkStory(story)
      setInkFrames(resolveInkFrames(story))
      setInkTitle("Debug Ink")
      setInkOpen(true)
    } catch (err: any) {
      console.error("Ink debug open failed:", err)
      setInkStory(null)
      setInkFrames([{ text: "Ink debug open failed: " + (err?.message ?? String(err)), choices: [] }])
      setInkOpen(true)
    }
  }

  const openInkForTask = async (taskId: string, taskGraphId: string) => {
    setInkTaskPendingResolve(taskId)
    setInkTaskPendingGraphId(taskGraphId)
    const taskObj = state.tasks.find(t => t.id === taskId)
    const taskTitle = taskObj ? describeTask(taskObj).title : String(taskId)
    setInkTitle(taskTitle)
    try {
      const careers = listCareers()
      let inkSource: string | undefined
      const task = state.tasks.find(t => t.id === taskId)

      // Prefer a career ink source if this is a job task; otherwise fall back to
      // the random event ink source (event_world.json) when available.
      for (const c of careers) {
        const level = c.levels.find(l => l.taskGraphId === taskGraphId)
        if (level) {
          inkSource = level.inkSource ?? c.inkSource
          break
        }
      }

      if (!inkSource && task?.kind === "randomEvent") {
        inkSource = getRandomEventTemplateById(task.templateId)?.inkSource
      }

      const story = await createInkStory(taskGraphId, state.player, inkSource)
      if (task?.kind === "randomEvent") {
        revealRandomOptionsForEncounter(story)
      }
      setInkStory(story)
      setInkFrames(resolveInkFrames(story))
      setInkOpen(true)
    } catch (err: any) {
      console.error("openInkForTask failed:", err)
      setInkTaskPendingResolve(null)
      setInkTaskPendingGraphId(null)
      setInkStory(null)
      setInkFrames([{ text: "Error opening ink story: " + (err?.message ?? String(err)), choices: [] }])
      setInkOpen(true)
    }
  }

  const handleChoose = (choiceIndex: number) => {
    if (!inkStory) return
    inkStory.ChooseChoiceIndex(choiceIndex)
    setInkFrames(resolveInkFrames(inkStory))
  }

  const applyInkOutcome = (vars: any) => {
    try {
      const outcome = vars.outcome
      if (outcome && inkTaskPendingGraphId) {
        dispatch({ type: "APPLY_OUTCOME", outcome: String(outcome), taskGraphId: inkTaskPendingGraphId })
      }
    } catch (e) {
      // swallow
    }
  }

  const applyInkDeltas = (vars: any) => {
    try {
      const dm = Number(vars.delta_money ?? 0)
      const ds = Number(vars.delta_stress ?? 0)
      const dh = Number(vars.delta_health ?? 0)
      const dhu = Number(vars.delta_humanity ?? 0)
      const delta: any = {}
      if (dm !== 0) delta.money = dm
      if (ds !== 0) delta.stress = ds
      if (dh !== 0) delta.health = dh
      if (dhu !== 0) delta.humanity = dhu
      if (Object.keys(delta).length > 0) {
        dispatch({ type: "APPLY_STATS_DELTA", delta })
      }
      // parse skill and subskill deltas (keys like delta_hacking or delta_closeCombat)
      const skillKeys = ["str", "int", "ref", "chr"]
      const subSkillKeys = [
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

      const skillDeltas: Record<string, number> = {}
      const subSkillDeltas: Record<string, number> = {}

      for (const k of Object.keys(vars)) {
        if (!k.startsWith("delta_")) continue
        const name = k.slice(6) // after 'delta_'
        const val = Number(vars[k] ?? 0)
        if (isNaN(val) || val === 0) continue
        if (skillKeys.includes(name)) {
          skillDeltas[name] = val
        } else if (subSkillKeys.includes(name)) {
          subSkillDeltas[name] = val
        }
      }

      if (Object.keys(skillDeltas).length > 0 || Object.keys(subSkillDeltas).length > 0) {
        dispatch({ type: "APPLY_SKILL_DELTAS", skillDeltas: Object.keys(skillDeltas).length ? skillDeltas : undefined, subSkillDeltas: Object.keys(subSkillDeltas).length ? subSkillDeltas : undefined })
      }
    } catch (e) {
      // swallow
    }
  }

  const resolvePendingTaskAfterStory = (vars: any) => {
    if (!inkTaskPendingResolve) return

    const taskObj = state.tasks.find(t => t.id === inkTaskPendingResolve)
    const taskTitle = taskObj ? describeTask(taskObj).title : String(inkTaskPendingResolve)

    dispatch({ type: "RESOLVE_TASK", taskId: inkTaskPendingResolve })

      try {
      const dm = Number(vars.delta_money ?? 0)
      const ds = Number(vars.delta_stress ?? 0)
      const dh = Number(vars.delta_health ?? 0)
      const dhu = Number(vars.delta_humanity ?? 0)
      const deltas: Record<string, number> = {}
      if (dm !== 0) deltas.money = dm
      if (ds !== 0) deltas.stress = ds
      if (dh !== 0) deltas.health = dh
      if (dhu !== 0) deltas.humanity = dhu

      // include skill/subskill deltas in the log if present
      for (const k of Object.keys(vars)) {
        if (!k.startsWith("delta_")) continue
        const name = k.slice(6)
        const val = Number(vars[k] ?? 0)
        if (isNaN(val) || val === 0) continue
        // already covered vitals above
        if (!["money", "stress", "health", "humanity"].includes(name)) {
          deltas[name] = val
        }
      }

      dispatch({ type: "ADD_LOG", text: `Finished ${taskTitle}.`, deltas: Object.keys(deltas).length ? deltas : undefined })
    } catch (e) {
      dispatch({ type: "ADD_LOG", text: `Finished ${taskTitle}.` })
    }

    setInkTaskPendingResolve(null)
    setInkTaskPendingGraphId(null)
  }

  const handleCloseInkModal = () => {
    const vars = (inkStory as any)?.variablesState ?? {}
    applyInkOutcome(vars)
    applyInkDeltas(vars)
    resolvePendingTaskAfterStory(vars)

    setInkOpen(false)
    setInkFrames([])
    setInkStory(null)
    setInkTaskPendingResolve(null)
    setInkTaskPendingGraphId(null)
    setInkTitle(null)
  }

  const closeInkStatCheck = () => {
    setInkStatCheckOpen(false)
    setInkStatCheck(null)
  }

  return {
    inkOpen,
    inkFrames,
    inkVars: (inkStory as any)?.variablesState ?? {},
    inkTitle,
    openInkDebug,
    openInkForTask,
    handleChoose,
    handleCloseInkModal,
    inkStatCheck,
    inkStatCheckOpen,
    closeInkStatCheck,
  }
}

export type { InkFrame }
