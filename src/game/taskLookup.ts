import type { TaskState } from "./types"
import { getJobTemplateById, type JobTemplate } from "./content/jobs"
import {
  getRandomEventTemplateById,
  type RandomEventTemplate,
} from "./content/randomEvents"

export type TaskTemplate = JobTemplate | RandomEventTemplate

export const resolveTaskTemplate = (task: TaskState): TaskTemplate | undefined => {
  switch (task.kind) {
    case "job":
      return getJobTemplateById(task.templateId)
    case "randomEvent":
      return getRandomEventTemplateById(task.templateId)
    default:
      return undefined
  }
}

export const describeTask = (
  task: TaskState,
): { title: string; description: string } => {
  const template = resolveTaskTemplate(task)
  if (!template) {
    return {
      title: `Unknown ${task.kind}`,
      description: `Template ${task.templateId} is missing`,
    }
  }

  if (template.kind === "job") {
    return {
      title: template.title,
      description: template.taskSummary,
    }
  }

  return {
    title: template.title,
    description: template.description,
  }
}
