import type { GameState, TaskState } from "./types"
import { createJobTaskForState } from "./content/jobs"
import { createRandomEventTaskForState } from "./content/randomEvents"

export const generateMonthlyTasks = (state: GameState): TaskState[] => {
  const tasks: TaskState[] = []

  const jobTask = createJobTaskForState(state)
  if (jobTask) tasks.push(jobTask)

  const randomEventTask = createRandomEventTaskForState(state)
  if (randomEventTask) tasks.push(randomEventTask)

  return tasks
}
