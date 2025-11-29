import type { TaskState } from "../types"

const randId = () => Math.random().toString(36).slice(2)

export type RandomEventTemplate = Omit<TaskState, "id" | "resolved">

const RANDOM_EVENT_TEMPLATES: RandomEventTemplate[] = [
  {
    kind: "randomEvent",
    title: "Cybernetic glitch",
    description: "Your cheap neural implant flickers during the commute.",
  },
  {
    kind: "randomEvent",
    title: "Street market scuffle",
    description: "A disagreement turns into a scene; you can intervene or avoid it.",
  },
  {
    kind: "randomEvent",
    title: "Stray data bundle",
    description: "A data packet floats past your netlink — someone dropped something valuable.",
  },
]

export const createRandomEvent = (): TaskState => {
  const i = Math.floor(Math.random() * RANDOM_EVENT_TEMPLATES.length)
  return { id: randId(), resolved: false, ...RANDOM_EVENT_TEMPLATES[i] }
}

export const getAllRandomEventTemplates = (): RandomEventTemplate[] =>
  RANDOM_EVENT_TEMPLATES.slice()

export default RANDOM_EVENT_TEMPLATES
