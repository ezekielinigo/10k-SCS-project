import type { GameState, TaskState } from "./types"
import { createCareerTasksForState } from "./content/careers"

export const generateMonthlyTasks = (state: GameState): TaskState[] => {
  const tasks: TaskState[] = []

  const jobTasks = createCareerTasksForState(state)
  tasks.push(...jobTasks)

  return tasks
}
