import type { GameState, Tag, TaskState } from "../types"

const randId = () => Math.random().toString(36).slice(2)

export type JobTemplate = {
  id: string
  title: string
  description: string[]
  tags: Tag[]
  taskGraphId: string
}

const JOB_TEMPLATES: Record<string, JobTemplate> = {
  apprentice_mechanic: {
    id: "apprentice_mechanic",
    title: "Apprentice Mechanic",
    description: [
      "Tune up battered groundcars at Valkarna Auto.", 
      "Complete this week's diagnostics and repairs."
    ],
    tags: ["mechanic", "tech", "blue_collar", "industrial"],
    taskGraphId: "mechanic_apprentice_shift",
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
    taskGraphId: template.taskGraphId,
    resolved: false,
    contextTags: template.tags,
  }
}

export default JOB_TEMPLATES
