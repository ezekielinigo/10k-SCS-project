import type { TaskState, Job } from "./types"
import { getJobById } from "./content/careers"
import {
  getRandomEventTemplateById,
  type RandomEventTemplate,
} from "./content/randomEvents"

export type TaskTemplate = Job | RandomEventTemplate

export const resolveTaskTemplate = (task: TaskState): TaskTemplate | undefined => {
  switch (task.kind) {
    case "job":
      return getJobById(task.templateId)
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
