import type { GameState, TaskState } from "./types"
import { generateMonthlyTasks } from "./taskGenerator"

export type GameAction =
  | { type: "ADVANCE_MONTH" }
  | { type: "ADD_LOG"; text: string }
  | { type: "SET_TASKS"; tasks: TaskState[] }
  | { type: "RESOLVE_TASK"; taskId: string }

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

    default:
      return state
  }
}
