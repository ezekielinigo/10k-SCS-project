import type { GameState, TaskState } from "./types"
import { generateMonthlyTasks } from "./taskGenerator"
import { getTaskGraphById, OUTCOME_DEFINITIONS, TASK_OUTCOME_OVERRIDES } from "./content/tasks"

export type GameAction =
  | { type: "ADVANCE_MONTH" }
  | { type: "ADD_LOG"; text: string }
  | { type: "SET_TASKS"; tasks: TaskState[] }
  | { type: "RESOLVE_TASK"; taskId: string }
  | { type: "APPLY_STATS_DELTA"; delta: Partial<{ health: number; humanity: number; stress: number; money: number }> }
  | { type: "APPLY_OUTCOME"; outcome: string; taskGraphId?: string }
  | { type: "START_TASK_RUN"; taskId: string; taskGraphId: string }
  | { type: "MAKE_TASK_CHOICE"; choiceId: string }

const randId = () => Math.random().toString(36).slice(2)

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "ADVANCE_MONTH": {
      const newMonth = state.month + 1
      const interimState: GameState = { ...state, month: newMonth }
      const tasks = generateMonthlyTasks(interimState)

      return {
        ...state,
        month: newMonth,
        tasks,
        log: [
          ...state.log,
          {
            id: randId(),
            month: newMonth,
            text: `Month ${newMonth}. New cycle begins.`,
          },
        ],
      }
    }

    case "ADD_LOG": {
      return {
        ...state,
        log: [
          ...state.log,
          {
            id: randId(),
            month: state.month,
            text: action.text,
          },
        ],
      }
    }

    case "SET_TASKS":
      return { ...state, tasks: action.tasks }

    case "RESOLVE_TASK": {
      const tasks = state.tasks.map(t =>
        t.id === action.taskId ? { ...t, resolved: true } : t,
      )

      return { ...state, tasks }
    }

    case "START_TASK_RUN": {
      const graph = getTaskGraphById(action.taskGraphId)
      if (!graph) return state

      return {
        ...state,
        activeTaskRun: {
          taskGraphId: action.taskGraphId,
          originTaskId: action.taskId,
          currentNodeId: graph.entryNodeId,
        },
      }
    }

    case "MAKE_TASK_CHOICE": {
      const run = state.activeTaskRun
      if (!run) return state

      const graph = getTaskGraphById(run.taskGraphId)
      if (!graph) return { ...state, activeTaskRun: null }

      const node = graph.nodes[run.currentNodeId ?? graph.entryNodeId]
      if (!node) return { ...state, activeTaskRun: null }

      const choice = node.choices.find(c => c.id === action.choiceId)
      if (!choice) return state

      if (choice.nextNodeId) {
        return {
          ...state,
          activeTaskRun: {
            ...run,
            currentNodeId: choice.nextNodeId,
          },
        }
      }

      if (choice.outcome) {
        const outcome = OUTCOME_DEFINITIONS[choice.outcome]
        const override = TASK_OUTCOME_OVERRIDES[graph.id]?.[choice.outcome]

  // outcome definitions may not include flavor texts here (ink now handles story text).
  // Fall back to a simple flavor if none provided.
  const texts: string[] = (override as any)?.texts ?? (outcome as any)?.texts ?? [`You handled: ${choice.id}`]
  const flavor = texts[Math.floor(Math.random() * texts.length)]
        const applyEffects = override?.applyEffects ?? outcome.applyEffects

        const afterEffects = applyEffects(state, { taskGraphId: graph.id })
        const tasks = afterEffects.tasks.map(t =>
          t.id === run.originTaskId ? { ...t, resolved: true } : t,
        )

        return {
          ...afterEffects,
          tasks,
          log: [
            ...afterEffects.log,
            {
              id: randId(),
              month: afterEffects.month,
              text: flavor,
            },
          ],
          activeTaskRun: null,
        }
      }

      return { ...state, activeTaskRun: null }
    }

    case "APPLY_OUTCOME": {
      const outcomeKey = action.outcome as keyof typeof OUTCOME_DEFINITIONS
      const outcomeDef = OUTCOME_DEFINITIONS[outcomeKey]
      if (!outcomeDef) return state

      const override =
        action.taskGraphId ? TASK_OUTCOME_OVERRIDES[action.taskGraphId]?.[outcomeKey] : undefined
      const applyEffects = override?.applyEffects ?? outcomeDef.applyEffects

      // apply the outcome effects to the state
  const afterEffects = applyEffects(state, { taskGraphId: action.taskGraphId ?? "" })

      return afterEffects
    }

    case "APPLY_STATS_DELTA": {
      const delta = action.delta || {}

      const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
      const stats = state.player.stats

      const nextStats = {
        ...stats,
        health: clamp(stats.health + (delta.health ?? 0), 0, 100),
        humanity: clamp(stats.humanity + (delta.humanity ?? 0), 0, 100),
        stress: clamp(stats.stress + (delta.stress ?? 0), 0, 100),
        money: stats.money + (delta.money ?? 0),
      }

      return {
        ...state,
        player: {
          ...state.player,
          stats: nextStats,
        },
      }
    }

    default:
      return state
  }
}
