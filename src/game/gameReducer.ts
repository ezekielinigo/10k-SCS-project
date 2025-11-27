import type { GameState, TaskState } from "./types"

export type GameAction =
  | { type: "ADVANCE_MONTH" }
  | { type: "ADD_LOG"; text: string }
  | { type: "SET_TASKS"; tasks: TaskState[] }
  | { type: "RESOLVE_TASK"; taskId: string }

const randId = () => Math.random().toString(36).slice(2)

function generateDummyTasks(month: number): TaskState[] {
  return [
    {
      id: randId(),
      kind: "job",
      title: "Shift at Valkarna Auto Shop",
      description: "A basic mechanic shift. Pays a little, raises stress.",
      resolved: false,
    },
    {
      id: randId(),
      kind: "bill",
      title: "Apartment rent",
      description: "Pay your monthly rent or risk trouble.",
      resolved: false,
    },
    {
      id: randId(),
      kind: "randomEvent",
      title: "Cybernetic glitch",
      description: "Your cheap neural implant flickers during the commute.",
      resolved: false,
    },
  ]
}

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "ADVANCE_MONTH": {
      const newMonth = state.month + 1
      const tasks = generateDummyTasks(newMonth)

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
