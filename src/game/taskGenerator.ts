import type { GameState, TaskState } from "./types"
import { createCareerTasksForState } from "./content/careers"
import { createRandomEventTaskForState } from "./content/randomEvents"

export const generateMonthlyTasks = (state: GameState): TaskState[] => {
  const tasks: TaskState[] = []

  const jobTasks = createCareerTasksForState(state)
  tasks.push(...jobTasks)

  const randomEventTask = createRandomEventTaskForState(state)
  if (randomEventTask) tasks.push(randomEventTask)

  return tasks
}
