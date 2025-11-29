import type {
  OutcomeDefinition,
  OutcomeTier,
  TaskGraph,
} from "../types"



const genericJobGraph: TaskGraph = {
  id: "generic_job_shift",
  entryNodeId: "start",
  nodes: {
    start: {
      id: "start",
      description: "You clock in and scan the schedule.",
      choices: [
        { id: "steady_shift", text: "Stick to the routine", outcome: "success", weight: 2 },
        { id: "push_for_bonus", text: "Push for a bonus", outcome: "great_success" },
        { id: "cut_corners", text: "Cut a few corners", outcome: "failure" },
      ],
    },
  },
}

const genericEventGraph: TaskGraph = {
  id: "generic_random_event",
  entryNodeId: "start",
  nodes: {
    start: {
      id: "start",
      description: "The city shifts around you. How do you react?",
      choices: [
        { id: "play_safe", text: "Keep it safe", outcome: "success" },
        { id: "take_risk", text: "Take a risky angle", outcome: "failure" },
      ],
    },
  },
}

export const TASK_GRAPHS: Record<string, TaskGraph> = {
  [genericJobGraph.id]: genericJobGraph,
  [genericEventGraph.id]: genericEventGraph,
}

export const getTaskGraphById = (id: string): TaskGraph | undefined => TASK_GRAPHS[id]

export const OUTCOME_DEFINITIONS: Record<OutcomeTier, OutcomeDefinition> = {
  // Outcome tiers remain defined for UI purposes (e.g. coloring). The numeric stat deltas
  // have been moved into Ink stories and are applied from the Ink variables at runtime.
  // Keep applyEffects as a no-op so reducer code that calls these remains compatible.
  great_success: {
    tier: "great_success",
    applyEffects: state => state,
  },
  success: {
    tier: "success",
    applyEffects: state => state,
  },
  failure: {
    tier: "failure",
    applyEffects: state => state,
  },
  great_failure: {
    tier: "great_failure",
    applyEffects: state => state,
  },
}

// Optional per-graph outcome overrides (keeps shape compatible with gameReducer usage).
export const TASK_OUTCOME_OVERRIDES: Record<
  string,
  Partial<Record<OutcomeTier, { texts?: string[]; applyEffects?: OutcomeDefinition["applyEffects"] }>>
> = {}