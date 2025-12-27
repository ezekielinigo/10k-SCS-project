import type { EventScope, GameState, Tag, TaskState } from "../types"
import {
  buildContentContext,
  pickWeightedTemplate,
  scopeTagsFor,
  scoreTemplateAgainstContext,
  templateMatchesScope,
} from "./tagEngine"

// NOTE: we no longer auto-register knots from the compiled Ink JSON.
// Add new random event templates manually below when adding knots to
// `src/ink/event_world.ink`.

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
  inkSource?: string
}

const RANDOM_EVENT_TEMPLATES: Record<string, RandomEventTemplate> = {
  chrome_spike_overload: {
    id: "chrome_spike_overload",
    kind: "randomEvent",
    title: "Chrome Spike Overload",
    description: "Your neural implant spikes, forcing you to reroute biofeedback.",
    scope: "world",
    tags: ["cyberware", "world", "tech", "capital", "high_security"],
    taskGraphId: "chrome_spike_overload",
    inkSource: "/src/ink/event_world.json",
  },
  street_brawl: {
    id: "street_brawl",
    kind: "randomEvent",
    title: "Street Brawl",
    description: "You stumble into a quarrel in a dark alley — someone shoves you and a fist flies.",
    scope: "world",
    tags: ["combat", "street", "redlined", "industrial"],
    taskGraphId: "street_brawl",
    inkSource: "/src/ink/event_world.json",
  },
  pickpocket_encounter: {
    id: "pickpocket_encounter",
    kind: "randomEvent",
    title: "Pickpocket Encounter",
    description: "Someone brushes your pocket — you might catch them or lose some coins.",
    scope: "world",
    tags: ["theft", "street", "shopping", "nightlife"],
    taskGraphId: "pickpocket_encounter",
    inkSource: "/src/ink/event_world.json",
  },
  street_tutoring: {
    id: "street_tutoring",
    kind: "randomEvent",
    title: "Street Tutoring",
    description: "A tired mechanic offers to show you a trick if you help with a bolt.",
    scope: "world",
    tags: ["mechanic", "engineering", "redlined", "industrial"],
    taskGraphId: "street_tutoring",
    inkSource: "/src/ink/event_world.json",
  },
  meditation_session: {
    id: "meditation_session",
    kind: "randomEvent",
    title: "Meditation Session",
    description: "You find a quiet courtyard; a monk offers breathing guidance.",
    scope: "world",
    tags: ["meditation", "calm", "ark_stronghold", "religious"],
    taskGraphId: "meditation_session",
    inkSource: "/src/ink/event_world.json",
  },
  risky_hack: {
    id: "risky_hack",
    kind: "randomEvent",
    title: "Risky Hack",
    description: "An opportunity to hack a small kiosk presents itself — payoffs vary.",
    scope: "world",
    tags: ["hacking", "tech", "hacker_hub", "black_market"],
    taskGraphId: "risky_hack",
    inkSource: "/src/ink/event_world.json",
  },
  datacache_encounter: {
    id: "datacache_encounter",
    kind: "randomEvent",
    title: "Datacache Encounter",
    description: "You find a hidden datacache; accessing it could yield secrets or traps.",
    scope: "world",
    tags: ["hacking", "data", "tech", "hacker_hub", "black_market"],
    taskGraphId: "datacache_encounter",
    inkSource: "/src/ink/event_world.json",
  }
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
  // list all templates (no debug output)
  const filtered = listRandomEventTemplates()
    .filter(template => templateMatchesScope(template.scope, template.tags, ctx))
    .map(template => ({
      ...template,
      weight: scoreTemplateAgainstContext(
        template.tags,
        scopeTagsFor(template.scope, ctx),
        template.baseWeight ?? 1,
      ),
    }))

  if (filtered.length > 0) {
    return pickWeightedTemplate(filtered)
  }

  // Fallback: if nothing matched scope/tags, pick from all templates with base weight
  const unfiltered = listRandomEventTemplates().map(template => ({
    ...template,
    weight: template.baseWeight ?? 1,
  }))

  return pickWeightedTemplate(unfiltered)
}

export const selectEventForDistrictTags = (
  districtTags: string[],
): RandomEventTemplate | undefined => {
  // Score templates against provided district tags and pick weighted; fallback to base weights.
  const scored = listRandomEventTemplates().map(template => ({
    ...template,
    weight: scoreTemplateAgainstContext(template.tags, districtTags, template.baseWeight ?? 1),
  }))

  const nonZero = scored.filter(t => (t.weight ?? 0) > 0)
  if (nonZero.length > 0) {
    return pickWeightedTemplate(nonZero)
  }

  const unfiltered = listRandomEventTemplates().map(template => ({
    ...template,
    weight: template.baseWeight ?? 1,
  }))

  return pickWeightedTemplate(unfiltered)
}

export const createRandomEventTaskFromTemplate = (template: RandomEventTemplate): TaskState => ({
  id: randId(),
  templateId: template.id,
  kind: "randomEvent",
  taskGraphId: template.taskGraphId,
  resolved: false,
  contextTags: template.tags,
})

export const createRandomEventTaskForState = (state: GameState): TaskState | null => {
  const template = selectRandomEventTemplateForState(state)
  if (!template) return null

  return createRandomEventTaskFromTemplate(template)
}

export default RANDOM_EVENT_TEMPLATES
