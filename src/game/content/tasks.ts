import type {
  GameState,
  OutcomeDefinition,
  OutcomeTier,
  TaskGraph,
} from "../types"

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const applyStatDelta = (
  state: GameState,
  delta: Partial<{
    health: number
    humanity: number
    stress: number
    money: number
  }>,
): GameState => {
  const stats = state.player.stats
  const nextStats = {
    ...stats,
    health: clamp(stats.health + (delta.health ?? 0), 0, 100),
    humanity: clamp(stats.humanity + (delta.humanity ?? 0), 0, 100),
    stress: clamp(stats.stress + (delta.stress ?? 0), 0, 100),
    money: stats.money + (delta.money ?? 0),
  }

  return {
    ...state,
    player: {
      ...state.player,
      stats: nextStats,
    },
  }
}

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
  great_success: {
    tier: "great_success",
    applyEffects: state => applyStatDelta(state, { money: 250, stress: -15, humanity: 3 }),
  },
  success: {
    tier: "success",
    applyEffects: state => applyStatDelta(state, { money: 120, stress: -5 }),
  },
  failure: {
    tier: "failure",
    applyEffects: state => applyStatDelta(state, { money: -60, stress: 12 }),
  },
  great_failure: {
    tier: "great_failure",
    applyEffects: state => applyStatDelta(state, { money: -150, stress: 20, health: -10 }),
  },
}

// Optional per-graph outcome overrides (keeps shape compatible with gameReducer usage).
export const TASK_OUTCOME_OVERRIDES: Record<
  string,
  Partial<Record<OutcomeTier, { texts?: string[]; applyEffects?: OutcomeDefinition["applyEffects"] }>>
> = {}