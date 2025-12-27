import type { GameState, TaskState, PendingTaskRun } from "./types"
import { getJobById, getCareerForJobId } from "./content/careers"
import { getAffiliationById } from "./content/affiliations"
import { findRoute, formatRoute, buildTravelLogText } from "./map"
import { generateMonthlyTasks } from "./taskGenerator"
import { chooseIndefiniteArticle } from "../utils/ui"
import { getTaskGraphById, OUTCOME_DEFINITIONS, TASK_OUTCOME_OVERRIDES } from "./content/tasks"
import { selectEventForDistrictTags, createRandomEventTaskFromTemplate } from "./content/randomEvents"
// random event helpers moved to content; reducer no longer imports them here

export type GameAction =
  | { type: "ADVANCE_MONTH" }
  | { type: "ADD_LOG"; text: string; deltas?: Record<string, number> }
  | { type: "SET_TASKS"; tasks: TaskState[] }
  | { type: "RESOLVE_TASK"; taskId: string }
  | { type: "CONSUME_ACTIVE_TASK_RUN" }
  | { type: "APPLY_STATS_DELTA"; delta: Partial<{ health: number; humanity: number; stress: number; money: number }> }
  | { type: "APPLY_SKILL_DELTAS"; skillDeltas?: Record<string, number>; subSkillDeltas?: Record<string, number> }
  | { type: "APPLY_OUTCOME"; outcome: string; taskGraphId?: string }
  | { type: "START_TASK_RUN"; taskId: string; taskGraphId: string }
  | { type: "MAKE_TASK_CHOICE"; choiceId: string }
  | { type: "SET_PLAYER_JOB"; jobId: string | null }
  | { type: "SET_PLAYER_DISTRICT"; districtId: string }
  | { type: "REMOVE_JOB_ASSIGNMENT"; jobId: string }
  | { type: "TAKE_JOB_INSTANCE"; instanceId: string; replaceCareer?: boolean }
  | { type: "CONNECT_NPC"; npc: any; affiliations?: string[]; relationshipStrength?: number }

const randId = () => Math.random().toString(36).slice(2)

const withoutPendingTask = (runs: PendingTaskRun[] | undefined, taskId: string): PendingTaskRun[] =>
  (runs ?? []).filter(run => run.taskId !== taskId)

const ensureActiveTaskRun = (state: GameState): GameState => {
  const queue = state.pendingTaskRuns ?? []
  if (state.activeTaskRun || queue.length === 0) {
    return { ...state, pendingTaskRuns: queue }
  }

  const [next, ...rest] = queue
  return {
    ...state,
    pendingTaskRuns: rest,
    activeTaskRun: {
      taskGraphId: next.taskGraphId,
      originTaskId: next.taskId,
      currentNodeId: null,
    },
  }
}



// Resolve affiliation ids for a given job assignment (posting-linked or career-linked)
function getAffiliationIdsForJob(state: GameState, jobId: string, memberId: string, jobInstances?: Record<string, any>): string[] {
  const instances = jobInstances ?? state.jobInstances ?? {}

  // Prefer the affiliation from the posting the member filled, if any
  const posting = Object.values(instances).find(p => p.templateId === jobId && p.filledBy === memberId && p.affiliationId)
  if (posting?.affiliationId) return [posting.affiliationId]

  // Fall back to a single career affiliation (first) if no posting link exists
  const careerAffs = getCareerForJobId(jobId)?.affiliationId ?? []
  return careerAffs.length ? [careerAffs[0]] : []
}

// Rebuild the player's membership map from their active assignments, preserving other members' entries and reputation where possible
function rebuildPlayerMemberships(state: GameState, nextAssignments: Record<string, any>, jobInstances?: Record<string, any>): Record<string, any> {
  const memberId = state.player.id

  // keep memberships of other members unchanged
  const nextMemberships: Record<string, any> = {}
  for (const m of Object.values(state.memberships ?? {})) {
    if (m.memberId !== memberId) nextMemberships[m.id] = m
  }

  const currentMemberships = state.memberships ?? {}
  const relevantAssignments = Object.values(nextAssignments).filter((a: any) => a?.memberId === memberId)
  const affSet = new Set<string>()
  for (const a of relevantAssignments) {
    for (const affId of getAffiliationIdsForJob(state, a.jobId, memberId, jobInstances)) {
      if (affId) affSet.add(affId)
    }
  }

  // If the player has no affiliations from assignments, default to 'no_affiliation'
  if (affSet.size === 0) {
    affSet.add("no_affiliation")
  }

  for (const affId of affSet) {
    const membershipId = `${affId}__${memberId}`
    nextMemberships[membershipId] = {
      id: membershipId,
      affiliationId: affId,
      memberId,
      reputation: currentMemberships[membershipId]?.reputation ?? 0,
    }
  }
  return nextMemberships
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    case "ADVANCE_MONTH": {
      const newMonth = state.month + 1
      const carryTasks = state.tasks.filter(t => !t.resolved && t.kind !== "job")
      const newTasks = [...carryTasks, ...generateMonthlyTasks(state)]
      return {
        ...state,
        month: newMonth,
        tasks: newTasks,
        log: [
          ...state.log,
          {
            id: randId(),
            month: newMonth,
            text: (() => {
              const headlines = [
                // capital districts / mainstream news
                "GENESIS Confirms Economic Plateau is \"Expected and Efficient.\"Experts assure citizens \"stagnation is a sign of optimal stability.\"",
                "Weather Grid Update: Slight Drizzle Scheduled in C2-3 for Market Aesthetic. \"Moisture boosts consumer spending,\" says Kuriyama Medical study",
                "GENESIS Approves New Drone Patrols Near Cermie Border. \"More drones equal safer streets,\" says spokesperson.",
                "New Arcology to Expand in C1 District, Promising Jobs and Housing. \"A beacon of progress,\" says city planner.",
                // redlined districts
                "Camo Freight Convoy Missing in the Old Mining District. Possible Hijacking Suspected.",
                "New Color Strain 'Blue Dream' Linked to Shared Hallucinations Among Users.",
                "Cliff City Hellcats Enforce New Curfew Near Western Border.",
                // leaks, rumors, illegal net feeds
                "C1 Residents Worry About Increased ARK Presence Near Cliff City Borders.",
                "Anonymous Source Claims Evidence of Corporate Collusion in Recent Market Crash.",
                "Underground Fight Clubs Gain Popularity In Chodan's Hell. \"It's the only real thrill left,\" from an exclusive interview.",
                "An Exclusive Synth Body Mod Just Sold For 14 Million Credits To An Anonymous Buyer.",
                "'Deep Black Stimulants' Continue To Sweep The Streets of Chodan's Hell. Users Report Increased Paranoia.",
                "Drone Residents Near Cliff City Report A Mysterious Dream-Like Memory of \"A Room With No Reflections.\"",
                "Sandstorm Detected Over Central Site Zero Formed A Perfect Spiral Which Experts Call, \"Meteorologically Impossible.\"",
                // culture and lifestyle
                "Group Of Cappie Tourists Found Dead In The Old Mining District. GENESIS Spokesperson Continues To Warn Against \"Alternative Tourism.\"",
                "Minh Syndicate Heir Opens Luxury Gym In Cermie's Haven, Promising An Exclusive Experience. \"Fitness is the new status symbol,\" he says.",
                "'Club Gothik' Closes After Just Three Months, Citing \"Creative Differences.\"",
                "REVIEW: 'Backtrack' Is A Mature, Sensitive Look At The End Of Love. A Must See For Romantics.",
                // corporate and advertisements
                "Famous Y3K Brand Debut \"Hollow Skins\" Body Mod Line Which Featured Transparent Limbs To \"Show Off Your Inner Beauty.\"",
                "New VR Club Opening In Cermie's Haven Promises \"The Ultimate Escape From Reality.\"",
                "Demetre Biocorp Offers New Cyberware Insurance Plan Covering \"All Manner Of Cybernetic Failures.\"",
                "Kuriyama Medical Releases New Line Of \"Mood Enhancing\" Biochips. \"Happiness is just a chip away,\" says spokesperson.",
                "RockaTech Recalls Latest Line Of Budget Pistols After Reports Of \"Unintended Discharges.\"",
                "Hardstone Silver Announced Famous Pop Star \"Luna Lux\" As New Brand Ambassador For Their Jewelry Line.",
                "Sanguine Tries To Break Into The Mainstream Market With Low-Profile Mantis Blades.",
              ]
              return headlines[Math.floor(Math.random() * headlines.length)]
            })(),
          },
        ],
      }
    }

    case "ADD_LOG": {
      return {
        ...state,
        log: [
          ...state.log,
          {
            id: randId(),
            month: state.month,
            text: action.text,
            deltas: action.deltas,
          },
        ],
      }
    }

    case "SET_TASKS":
      return { ...state, tasks: action.tasks }

    case "RESOLVE_TASK": {
      const tasks = state.tasks.map(t =>
        t.id === action.taskId ? { ...t, resolved: true } : t,
      )

      const pendingTaskRuns = withoutPendingTask(state.pendingTaskRuns, action.taskId)

      return ensureActiveTaskRun({ ...state, tasks, pendingTaskRuns })
    }

    case "CONSUME_ACTIVE_TASK_RUN": {
      return { ...state, activeTaskRun: null }
    }

    case "START_TASK_RUN": {
      const graph = getTaskGraphById(action.taskGraphId)
      if (!graph) return state

      const pendingTaskRuns = withoutPendingTask(state.pendingTaskRuns, action.taskId)

      return {
        ...state,
        pendingTaskRuns,
        activeTaskRun: {
          taskGraphId: action.taskGraphId,
          originTaskId: action.taskId,
          currentNodeId: graph.entryNodeId,
        },
      }
    }

    case "MAKE_TASK_CHOICE": {
      const run = state.activeTaskRun
      if (!run) return state

      const graph = getTaskGraphById(run.taskGraphId)
      if (!graph) return { ...state, activeTaskRun: null }

      const node = graph.nodes[run.currentNodeId ?? graph.entryNodeId]
      if (!node) return { ...state, activeTaskRun: null }

      const choice = node.choices.find(c => c.id === action.choiceId)
      if (!choice) return state

      if (choice.nextNodeId) {
        return {
          ...state,
          activeTaskRun: {
            ...run,
            currentNodeId: choice.nextNodeId,
          },
        }
      }

      if (choice.outcome) {
        const outcome = OUTCOME_DEFINITIONS[choice.outcome]
        const override = TASK_OUTCOME_OVERRIDES[graph.id]?.[choice.outcome]

  // outcome definitions may not include flavor texts here (ink now handles story text).
  // Fall back to a simple flavor if none provided.
  const texts: string[] = (override as any)?.texts ?? (outcome as any)?.texts ?? [`You handled: ${choice.id}`]
  const flavor = texts[Math.floor(Math.random() * texts.length)]
        const applyEffects = override?.applyEffects ?? outcome.applyEffects

        const afterEffects = applyEffects(state, { taskGraphId: graph.id })
        const tasks = afterEffects.tasks.map(t =>
          t.id === run.originTaskId ? { ...t, resolved: true } : t,
        )

        return {
          ...afterEffects,
          tasks,
          log: [
            ...afterEffects.log,
            {
              id: randId(),
              month: afterEffects.month,
              text: flavor,
            },
          ],
          activeTaskRun: null,
        }
      }

      return { ...state, activeTaskRun: null }
    }

    case "APPLY_OUTCOME": {
      const outcomeKey = action.outcome as keyof typeof OUTCOME_DEFINITIONS
      const outcomeDef = OUTCOME_DEFINITIONS[outcomeKey]
      if (!outcomeDef) return state

      const override =
        action.taskGraphId ? TASK_OUTCOME_OVERRIDES[action.taskGraphId]?.[outcomeKey] : undefined
      const applyEffects = override?.applyEffects ?? outcomeDef.applyEffects

      // apply the outcome effects to the state
  const afterEffects = applyEffects(state, { taskGraphId: action.taskGraphId ?? "" })

      return afterEffects
    }

    case "APPLY_STATS_DELTA": {
      const delta = action.delta || {}

      const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
      const vitals = state.player.vitals

      const nextVitals = {
        ...vitals,
        health: clamp(vitals.health + (delta.health ?? 0), 0, 100),
        humanity: clamp(vitals.humanity + (delta.humanity ?? 0), 0, 100),
        stress: clamp(vitals.stress + (delta.stress ?? 0), 0, 100),
        money: vitals.money + (delta.money ?? 0),
      }

      return {
        ...state,
        player: {
          ...state.player,
          vitals: nextVitals,
        },
      }
    }

    case "APPLY_SKILL_DELTAS": {
      const skillDeltas = action.skillDeltas ?? {}
      const subSkillDeltas = action.subSkillDeltas ?? {}

      const nextSkills = { ...state.player.skills }
      // apply top-level skill deltas (str,int,ref,chr)
      for (const k of Object.keys(skillDeltas)) {
        const v = Number((skillDeltas as any)[k] ?? 0)
        if (isNaN(v)) continue
        const key = k as keyof typeof nextSkills
        if (typeof (nextSkills as any)[key] === "number") {
          ;(nextSkills as any)[key] = Math.max(0, (nextSkills as any)[key] + v)
        }
      }

      // apply subskill deltas
      const nextSub = { ...(nextSkills.subSkills ?? {}) }
      for (const k of Object.keys(subSkillDeltas)) {
        const v = Number((subSkillDeltas as any)[k] ?? 0)
        if (isNaN(v)) continue
        if (k in nextSub) {
          nextSub[k as keyof typeof nextSub] = Math.max(0, (nextSub as any)[k] + v)
        }
      }

      nextSkills.subSkills = nextSub

      return {
        ...state,
        player: {
          ...state.player,
          skills: nextSkills,
        },
      }
    }

    case "SET_PLAYER_JOB": {
      // create or remove a JobAssignment for the current player
      const jobId = action.jobId
      const memberId = state.player.id

      const nextAssignments: Record<string, any> = { ...(state.jobAssignments ?? {}) }

      // remove any existing assignments for this member
      for (const k of Object.keys(nextAssignments)) {
        if (nextAssignments[k]?.memberId === memberId) {
          delete nextAssignments[k]
        }
      }

      if (jobId) {
        const id = `${jobId}__${memberId}`
        nextAssignments[id] = { id, jobId, memberId, performance: 50 }
      }

      const nextMemberships = rebuildPlayerMemberships(state, nextAssignments)

      const logText = jobId ? `Assigned player to job ${jobId}` : `Removed player's job assignment and cleared related affiliations`

      return {
        ...state,
        jobAssignments: nextAssignments,
        memberships: nextMemberships,
        log: [
          ...state.log,
          {
            id: randId(),
            month: state.month,
            text: logText,
          },
        ],
      }
    }

    case "SET_PLAYER_DISTRICT": {
      const districtId = action.districtId
      const routeIds = findRoute(state.player.currentDistrict, districtId, state.districts)
      const routeLabel = formatRoute(routeIds, state.districts)

      // base updates
      let nextTasks = [...state.tasks]
      let nextLog = [
        ...state.log,
        {
          id: randId(),
          month: state.month,
          text: buildTravelLogText(routeIds, state.districts) || `Player moved, ${routeLabel}`,
        },
      ]

      // For each hop after the origin, roll for a random event (50% per hop)
      let nextPendingRuns: PendingTaskRun[] = [...(state.pendingTaskRuns ?? [])]
      for (let i = 1; i < routeIds.length; i++) {
        const hopId = routeIds[i]
        const roll = Math.random()
        if (roll < 0.5) {
          const district = state.districts[hopId]
          const template = selectEventForDistrictTags(district?.tags ?? [])
          if (template) {
            const task = createRandomEventTaskFromTemplate(template)
            // record originating district on the task so we can open the Ink story with the correct location later
            task.metadata = { districtId: hopId, districtName: district?.name }
            nextTasks.push(task)

            if (task.taskGraphId) {
              nextPendingRuns = [...nextPendingRuns, { taskId: task.id, taskGraphId: task.taskGraphId }]
            }
          }
        }
      }

      const baseState: GameState = {
        ...state,
        player: {
          ...state.player,
          currentDistrict: districtId,
        },
        tasks: nextTasks,
        log: nextLog,
        pendingTaskRuns: nextPendingRuns,
      }

      return ensureActiveTaskRun(baseState)
    }

    case "REMOVE_JOB_ASSIGNMENT": {
      const jobId = action.jobId
      const memberId = state.player.id

      const nextAssignments: Record<string, any> = { ...(state.jobAssignments ?? {}) }
      for (const k of Object.keys(nextAssignments)) {
        const aj = nextAssignments[k]
        if (aj?.memberId === memberId && aj.jobId === jobId) {
          delete nextAssignments[k]
        }
      }

      const nextMemberships = rebuildPlayerMemberships(state, nextAssignments)

      return {
        ...state,
        jobAssignments: nextAssignments,
        memberships: nextMemberships,
        log: [
          ...state.log,
          {
            id: randId(),
            month: state.month,
            text: `Removed assignment for ${jobId}.`,
          },
        ],
      }
    }

    case "TAKE_JOB_INSTANCE": {
      const instance = state.jobInstances?.[action.instanceId]
      if (!instance) return state

      const jobId = instance.templateId
      const memberId = state.player.id

      const nextAssignments: Record<string, any> = { ...(state.jobAssignments ?? {}) }

      // If replacing within the same career, drop only those assignments; otherwise keep multiples
      const careerOfNew = getCareerForJobId(jobId)?.id ?? null
      if (action.replaceCareer && careerOfNew) {
        for (const k of Object.keys(nextAssignments)) {
          const aj = nextAssignments[k]
          if (aj?.memberId === memberId) {
            const existingCareer = getCareerForJobId(aj.jobId)?.id ?? null
            if (existingCareer === careerOfNew) delete nextAssignments[k]
          }
        }
      }

      const id = `${jobId}__${memberId}`
      nextAssignments[id] = { id, jobId, memberId, performance: 50 }

      const nextInstances = { ...(state.jobInstances ?? {}) }

      // Clear any other filled listings for this member and template so we don't carry stale affiliations
      for (const [instId, inst] of Object.entries(nextInstances)) {
        if (instId !== action.instanceId && inst.templateId === jobId && inst.filledBy === memberId) {
          nextInstances[instId] = { ...inst, filledBy: null }
        }
      }

      nextInstances[action.instanceId] = { ...instance, filledBy: memberId }

      // ensure membership includes the posting's affiliation (additive, no clearing of other affiliations)
      const nextMemberships = rebuildPlayerMemberships(state, nextAssignments, nextInstances)
      if (instance.affiliationId) {
        const membershipId = `${instance.affiliationId}__${memberId}`
        nextMemberships[membershipId] = {
          id: membershipId,
          affiliationId: instance.affiliationId,
          memberId,
          reputation: nextMemberships[membershipId]?.reputation ?? 0,
        }
      }

      const job = getJobById(jobId)
      const jobTitle = job?.title ?? jobId

      const article = chooseIndefiniteArticle(jobTitle)

      return {
        ...state,
        jobAssignments: nextAssignments,
        jobInstances: nextInstances,
        memberships: nextMemberships,
        log: [
          ...state.log,
          {
            id: randId(),
            month: state.month,
            text: `I got a job as ${article} ${jobTitle} for ${getAffiliationById(instance.affiliationId?.toString() ?? undefined)?.name ?? 'an unknown employer'}.`,
          },
        ],
      }
    }

    case "CONNECT_NPC": {
      const npc = action.npc
      const affiliations = (action.affiliations ?? npc.affiliationIds ?? [])
        .length > 0
        ? (action.affiliations ?? npc.affiliationIds ?? [])
        : ["no_affiliation"]
      const playerId = state.player.id

      const nextNpcs = { ...(state.npcs ?? {}) }
      nextNpcs[npc.id] = { ...npc }

      const relationshipId = `${playerId}__${npc.id}`
      const nextRelationships = { ...(state.relationships ?? {}) }
      nextRelationships[relationshipId] = {
        id: relationshipId,
        aId: playerId,
        bId: npc.id,
        strength: action.relationshipStrength ?? 30,
        tags: ["connected"],
      }

      const nextMemberships = { ...(state.memberships ?? {}) }
      for (const affId of affiliations) {
        const membershipId = `${affId}__${npc.id}`
        nextMemberships[membershipId] = {
          id: membershipId,
          affiliationId: affId,
          memberId: npc.id,
          reputation: nextMemberships[membershipId]?.reputation ?? 0,
        }
      }

      return {
        ...state,
        npcs: nextNpcs,
        relationships: nextRelationships,
        memberships: nextMemberships,
        log: [
          ...state.log,
          {
            id: randId(),
            month: state.month,
            text: `Connected with ${npc.name}.`,
          },
        ],
      }
    }

    default:
      return state
  }
}
