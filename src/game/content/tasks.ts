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

const mechanicApprenticeGraph: TaskGraph = {
  id: "mechanic_apprentice_shift",
  entryNodeId: "start",
  nodes: {
    start: {
      id: "start",
      description: "The garage floor roars awake. Which station do you grab?",
      choices: [
        { id: "tune_up_cars", text: "Tune up cars", nextNodeId: "tune" },
        { id: "diagnostics", text: "Handle diagnostics", nextNodeId: "diagnostics" },
      ],
    },
    tune: {
      id: "tune",
      description: "Lifted groundcars hiss with steam while clients pace outside.",
      choices: [
        { id: "steady_work", text: "Keep a steady pace", outcome: "success", weight: 2 },
        {
          id: "overclock_lift",
          text: "Overclock the lift to clear backlog",
          nextNodeId: "misfire",
          weight: 1,
        },
      ],
    },
    diagnostics: {
      id: "diagnostics",
      description: "The Valkarna console floods with error codes.",
      choices: [
        {
          id: "triple_check",
          text: "Triple-check the firmware",
          outcome: "great_success",
          condition: { minStats: { skills: { int: 7 } } },
        },
        {
          id: "rush_jobs",
          text: "Rush the diagnostics",
          outcome: "failure",
          weight: 1,
        },
        {
          id: "trace_noise",
          text: "Trace the weird knocking noise",
          nextNodeId: "misfire",
        },
      ],
    },
    misfire: {
      id: "misfire",
      description: "A Vulcamax engine misfires. Sparks spray across the bay.",
      choices: [
        {
          id: "calm_client",
          text: "Calm the client and stabilize wiring",
          outcome: "success",
          condition: { minStats: { skills: { chr: 6 } } },
        },
        {
          id: "dive_in",
          text: "Dive in and reroute power manually",
          outcome: "great_success",
          condition: { minStats: { skills: { ref: 6 } } },
        },
        {
          id: "call_supervisor",
          text: "Call the supervisor to take over",
          outcome: "failure",
        },
        {
          id: "panic",
          text: "Panic and hit the wrong circuit",
          outcome: "great_failure",
        },
      ],
    },
  },
}

const chromeSpikeGraph: TaskGraph = {
  id: "chrome_spike_overload",
  entryNodeId: "spike",
  nodes: {
    spike: {
      id: "spike",
      description: "Your neural implant howls with static. Options race through your head.",
      choices: [
        {
          id: "reroute_signal",
          text: "Reroute the signal through backup pathways",
          nextNodeId: "stabilize",
          condition: { minStats: { skills: { int: 7 } } },
        },
        {
          id: "ground_out",
          text: "Ground yourself and ride it out",
          nextNodeId: "fallout",
        },
      ],
    },
    stabilize: {
      id: "stabilize",
      description: "You visualize the implant schematic in your mind.",
      choices: [
        { id: "soft_reset", text: "Soft reset the neural mesh", outcome: "success" },
        {
          id: "deep_dive",
          text: "Push deeper to overclock clarity",
          outcome: "great_success",
          condition: { maxStress: 40 },
        },
      ],
    },
    fallout: {
      id: "fallout",
      description: "Pain blooms as the spike cooks sensitive tissue.",
      choices: [
        { id: "stumble_home", text: "Stumble home and sleep it off", outcome: "failure" },
        { id: "rip_it_out", text: "Yank the faulty filament yourself", outcome: "great_failure" },
      ],
    },
  },
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
  [mechanicApprenticeGraph.id]: mechanicApprenticeGraph,
  [chromeSpikeGraph.id]: chromeSpikeGraph,
  [genericJobGraph.id]: genericJobGraph,
  [genericEventGraph.id]: genericEventGraph,
}

export const getTaskGraphById = (id: string): TaskGraph | undefined => TASK_GRAPHS[id]

export const OUTCOME_DEFINITIONS: Record<OutcomeTier, OutcomeDefinition> = {
  great_success: {
    tier: "great_success",
    texts: [
      "Everything clicks. You leave with credits jingling and a grin.",
      "A flawless run nets you bragging rights and bonuses.",
    ],
    applyEffects: state => applyStatDelta(state, { money: 250, stress: -15, humanity: 3 }),
  },
  success: {
    tier: "success",
    texts: [
      "Solid work keeps your rep intact.",
      "You handle business with only minor hiccups.",
    ],
    applyEffects: state => applyStatDelta(state, { money: 120, stress: -5 }),
  },
  failure: {
    tier: "failure",
    texts: [
      "Things wobble off track and cost you.",
      "You barely scrape by and owe favors afterward.",
    ],
    applyEffects: state => applyStatDelta(state, { money: -60, stress: 12 }),
  },
  great_failure: {
    tier: "great_failure",
    texts: [
      "Disaster. You limp away with scars and debts.",
      "A cascading mess torches your mood and wallet.",
    ],
    applyEffects: state => applyStatDelta(state, { money: -150, stress: 20, health: -10 }),
  },
}

export const TASK_OUTCOME_OVERRIDES: Record<
  string,
  Partial<Record<OutcomeTier, { texts?: string[]; applyEffects?: OutcomeDefinition["applyEffects"] }>>
> = {
  chrome_spike_overload: {
    failure: {
      texts: ["The implant sears your nerves. Recovery will be costly."],
      applyEffects: state => applyStatDelta(state, { health: -20, stress: 18, money: -80 }),
    },
    great_failure: {
      texts: ["Your chrome shorts out and you collapse, bio readings tanking."],
      applyEffects: state => applyStatDelta(state, { health: -35, stress: 25, money: -120 }),
    },
  },
}
