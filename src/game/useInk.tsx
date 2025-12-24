import { useState } from "react"
import { listCareers } from "./content/careers"
import { describeTask } from "./taskLookup"
import type { GameState } from "./types"
import type { GameAction } from "./gameReducer"
import { createInkStory, resolveInkFrames, type InkFrame } from "./ink"

type UseInkArgs = {
  state: GameState
  dispatch: (action: GameAction) => void
}

type UseInkReturn = {
  inkOpen: boolean
  inkFrames: InkFrame[]
  inkVars: any
  openInkDebug: () => Promise<void>
  openInkForTask: (taskId: string, taskGraphId: string) => Promise<void>
  handleChoose: (choiceIndex: number) => void
  handleCloseInkModal: () => void
}

export const useInk = ({ state, dispatch }: UseInkArgs): UseInkReturn => {
  const [inkOpen, setInkOpen] = useState(false)
  const [inkStory, setInkStory] = useState<any | null>(null)
  const [inkFrames, setInkFrames] = useState<InkFrame[]>([])
  const [inkTaskPendingResolve, setInkTaskPendingResolve] = useState<string | null>(null)
  const [inkTaskPendingGraphId, setInkTaskPendingGraphId] = useState<string | null>(null)

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
    try {
      const careers = listCareers()
      let inkSource: string | undefined
      for (const c of careers) {
        const level = c.levels.find(l => l.taskGraphId === taskGraphId)
        if (level) {
          inkSource = level.inkSource ?? c.inkSource
          break
        }
      }

      const story = await createInkStory(taskGraphId, state.player, inkSource)
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
  }

  return {
    inkOpen,
    inkFrames,
    inkVars: (inkStory as any)?.variablesState ?? {},
    openInkDebug,
    openInkForTask,
    handleChoose,
    handleCloseInkModal,
  }
}

export type { InkFrame }
