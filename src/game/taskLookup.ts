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

  // Use the task's kind (from the TaskState) to decide how to present the template
  if (task.kind === "job") {
    // Job templates store description as a string[]; join for presentation
    return {
      title: template.title,
      description: Array.isArray((template as any).description)
        ? (template as any).description.join(" ")
        : (template as any).description,
    }
  }

  return {
    title: template.title,
    description: (template as any).description as string,
  }
}
