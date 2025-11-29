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
}

const RANDOM_EVENT_TEMPLATES: Record<string, RandomEventTemplate> = {
  vulcamax_engine_misfire: {
    id: "vulcamax_engine_misfire",
    kind: "randomEvent",
    title: "Vulcamax Engine Misfire",
    description: "A client's engine backfires during diagnostics, spraying sparks over the bay.",
    scope: "job_related",
    tags: ["mechanic", "industrial", "blue_collar", "tech"],
    baseWeight: 2,
  },
  instafood_grease_fire: {
    id: "instafood_grease_fire",
    kind: "randomEvent",
    title: "InstaFood Grease Fire",
    description: "A grease flare threatens to shut down the lunch rush.",
    scope: "job_related",
    tags: ["food_service", "customer_facing", "midlands"],
  },
  district5_drone_collapse: {
    id: "district5_drone_collapse",
    kind: "randomEvent",
    title: "Drone Collapse",
    description: "A delivery drone crashes near a street booth, scattering contraband.",
    scope: "district_related",
    tags: ["district5", "industrial", "security"],
  },
  midnight_subway_graffiti: {
    id: "midnight_subway_graffiti",
    kind: "randomEvent",
    title: "Midnight Subway Graffiti",
    description: "Artists tag the corporate tram; enforcers swarm the tunnels.",
    scope: "world",
    tags: ["street", "culture", "rebellion"],
  },
  chrome_spike_overload: {
    id: "chrome_spike_overload",
    kind: "randomEvent",
    title: "Chrome Spike Overload",
    description: "Your neural implant spikes, forcing you to reroute biofeedback.",
    scope: "health",
    tags: ["cyberware", "health", "stress"],
  },
  fixer_calls_in_favor: {
    id: "fixer_calls_in_favor",
    kind: "randomEvent",
    title: "Fixer Calls In a Favor",
    description: "A nearby fixer leans on you to smooth over a street deal.",
    scope: "npc_related",
    tags: ["fixer", "favor", "midlands"],
  },
  union_dues_audit: {
    id: "union_dues_audit",
    kind: "randomEvent",
    title: "Union Dues Audit",
    description: "Your affiliation sends an auditor to review lost dues.",
    scope: "faction_related",
    tags: ["union", "mechanic", "industrial"],
  },
  surprise_apartment_inspection: {
    id: "surprise_apartment_inspection",
    kind: "randomEvent",
    title: "Surprise Apartment Inspection",
    description: "Housing wardens sweep through your block looking for contraband.",
    scope: "personal_life",
    tags: ["midlands", "tenant", "lawful"],
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
    resolved: false,
    contextTags: template.tags,
  }
}

export default RANDOM_EVENT_TEMPLATES
