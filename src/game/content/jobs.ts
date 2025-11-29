import type { TaskState } from "../types"

const randId = () => Math.random().toString(36).slice(2)

export type JobTemplate = Omit<TaskState, "id" | "resolved">

const JOB_TEMPLATES: JobTemplate[] = [
  {
    kind: "job",
    title: "Shift at Valkarna Auto Shop",
    description: "A basic mechanic shift. Pays a little, raises stress.",
  },
  {
    kind: "job",
    title: "Night security patrol",
    description: "Watch the perimeter. Low pay, low stress.",
  },
  {
    kind: "job",
    title: "Delivery run",
    description: "Quick courier job. Timed, small risk.",
  },
]

export const createJob = (): TaskState => {
  const i = Math.floor(Math.random() * JOB_TEMPLATES.length)
  return { id: randId(), resolved: false, ...JOB_TEMPLATES[i] }
}

export const getAllJobTemplates = (): JobTemplate[] => JOB_TEMPLATES.slice()

export default JOB_TEMPLATES
