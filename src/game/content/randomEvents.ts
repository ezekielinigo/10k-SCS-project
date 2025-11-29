import type { EventScope, GameState, Tag, TaskState } from "../types"
import {
  buildContentContext,
  pickWeightedTemplate,
  scopeTagsFor,
  scoreTemplateAgainstContext,
  templateMatchesScope,
} from "./tagEngine"

const randId = () => Math.random().toString(36).slice(2)

export type RandomEventTemplate = {
  id: string
  kind: "randomEvent"
  title: string
  description: string
  scope: EventScope
  tags: Tag[]
  baseWeight?: number
  taskGraphId: string
}

const RANDOM_EVENT_TEMPLATES: Record<string, RandomEventTemplate> = {
  chrome_spike_overload: {
    id: "chrome_spike_overload",
    kind: "randomEvent",
    title: "Chrome Spike Overload",
    description: "Your neural implant spikes, forcing you to reroute biofeedback.",
    scope: "health",
    tags: ["cyberware", "health", "tech"],
    taskGraphId: "chrome_spike_overload",
  },
}

export const listRandomEventTemplates = (): RandomEventTemplate[] =>
  Object.values(RANDOM_EVENT_TEMPLATES)

export const getRandomEventTemplateById = (
  id: string,
): RandomEventTemplate | undefined => RANDOM_EVENT_TEMPLATES[id]

export const selectRandomEventTemplateForState = (
  state: GameState,
): RandomEventTemplate | undefined => {
  const ctx = buildContentContext(state)
  const weighted = listRandomEventTemplates()
    .filter(template => templateMatchesScope(template.scope, template.tags, ctx))
    .map(template => ({
      ...template,
      weight: scoreTemplateAgainstContext(
        template.tags,
        scopeTagsFor(template.scope, ctx),
        template.baseWeight ?? 1,
      ),
    }))

  return pickWeightedTemplate(weighted)
}

export const createRandomEventTaskForState = (state: GameState): TaskState | null => {
  const template = selectRandomEventTemplateForState(state)
  if (!template) return null

  return {
    id: randId(),
    templateId: template.id,
    kind: "randomEvent",
    taskGraphId: template.taskGraphId,
    resolved: false,
    contextTags: template.tags,
  }
}

export default RANDOM_EVENT_TEMPLATES
