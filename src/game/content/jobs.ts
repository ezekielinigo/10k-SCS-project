import type { GameState, Tag, TaskState } from "../types"

const randId = () => Math.random().toString(36).slice(2)

export type JobTemplate = {
  id: string
  kind: "job"
  title: string
  description: string
  taskSummary: string
  tags: Tag[]
}

const JOB_TEMPLATES: Record<string, JobTemplate> = {
  apprentice_mechanic: {
    id: "apprentice_mechanic",
    kind: "job",
    title: "Apprentice Mechanic",
    description: "Tune up battered groundcars at Valkarna Auto.",
    taskSummary: "Complete this week's diagnostics and repairs.",
    tags: ["mechanic", "tech", "blue_collar", "industrial"],
  },
  line_cook: {
    id: "line_cook",
    kind: "job",
    title: "Line Cook",
    description: "Keep the vats stirred at InstaFood.",
    taskSummary: "Prep ingredients and survive the lunch rush.",
    tags: ["food_service", "customer_facing", "blue_collar"],
  },
  courier: {
    id: "courier",
    kind: "job",
    title: "Night Courier",
    description: "Run sensitive packages through the grid.",
    taskSummary: "Deliver encrypted parcels before curfew hits.",
    tags: ["runner", "transport", "streetwise"],
  },
}

export const listJobTemplates = (): JobTemplate[] => Object.values(JOB_TEMPLATES)

export const getJobTemplateById = (id?: string | null): JobTemplate | undefined =>
  id ? JOB_TEMPLATES[id] : undefined

export const createJobTaskForState = (state: GameState): TaskState | null => {
  const template = getJobTemplateById(state.player.jobId)
  if (!template) return null

  return {
    id: randId(),
    templateId: template.id,
    kind: "job",
    resolved: false,
    contextTags: template.tags,
  }
}

export default JOB_TEMPLATES
