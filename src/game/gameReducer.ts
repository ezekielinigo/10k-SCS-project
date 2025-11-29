import type { GameState, TaskState } from "./types"
import { generateMonthlyTasks } from "./taskGenerator"
import { getTaskGraphById, OUTCOME_DEFINITIONS, TASK_OUTCOME_OVERRIDES } from "./content/tasks"

export type GameAction =
  | { type: "ADVANCE_MONTH" }
  | { type: "ADD_LOG"; text: string }
  | { type: "SET_TASKS"; tasks: TaskState[] }
  | { type: "RESOLVE_TASK"; taskId: string }
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

        const texts = override?.texts ?? outcome.texts
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

    default:
      return state
  }
}
