import type { Career, GameState, Job, TaskState } from "../types"

const randId = () => Math.random().toString(36).slice(2)

const CAREERS: Record<string, Career> = {
  mechanic: {
    id: "mechanic",
    title: "Mechanic Career",
    inkSource: "./ink/career_mechanic.json",
    levels: [
      {
        id: "apprentice_mechanic",
        title: "Apprentice Mechanic",
        description: [
          "Tune up battered groundcars at Valkarna Auto.",
          "Complete this week's diagnostics and repairs.",
        ],
        tags: ["mechanic", "tech", "blue_collar", "industrial"],
        taskGraphId: "mechanic_apprentice_shift",
      },
    ],
  },
}

const JOB_LOOKUP: Record<string, Job> = Object.values(CAREERS).flatMap(c => c.levels).reduce((map, job) => {
  map[job.id] = job
  return map
}, {} as Record<string, Job>)

const JOB_TO_CAREER: Record<string, Career> = Object.values(CAREERS).reduce((map, career) => {
  for (const level of career.levels) {
    map[level.id] = career
  }
  return map
}, {} as Record<string, Career>)

export const listCareers = (): Career[] => Object.values(CAREERS)

export const getJobById = (id?: string | null): Job | undefined => (id ? JOB_LOOKUP[id] : undefined)

export const getCareerById = (id?: string | null): Career | undefined =>
  id ? CAREERS[id] : undefined

export const getCareerForJobId = (jobId?: string | null): Career | undefined =>
  jobId ? JOB_TO_CAREER[jobId] : undefined

export const createCareerTaskForState = (state: GameState): TaskState | null => {
  const assignments = state.jobAssignments ?? {}
  const assignment = Object.values(assignments).find(a => a.memberId === state.player.id)
  if (!assignment) return null

  const template = getJobById(assignment.jobId)
  if (!template) return null

  return {
    id: randId(),
    templateId: template.id,
    kind: "job",
    taskGraphId: template.taskGraphId ?? null,
    resolved: false,
    contextTags: template.tags ?? [],
  }
}

export default CAREERS