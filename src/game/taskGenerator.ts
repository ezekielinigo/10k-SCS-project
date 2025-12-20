import type { GameState, TaskState } from "./types"
import { createCareerTaskForState } from "./content/careers"
import { createRandomEventTaskForState } from "./content/randomEvents"

export const generateMonthlyTasks = (state: GameState): TaskState[] => {
  const tasks: TaskState[] = []

  const jobTask = createCareerTaskForState(state)
  if (jobTask) tasks.push(jobTask)

  const randomEventTask = createRandomEventTaskForState(state)
  if (randomEventTask) tasks.push(randomEventTask)

  return tasks
}
