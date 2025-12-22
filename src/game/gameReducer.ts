import type { GameState, TaskState } from "./types"
import { getJobById, getCareerForJobId } from "./content/careers"
import { getAffiliationById } from "./content/affiliations"
import { chooseIndefiniteArticle } from "../utils/ui"
import { generateMonthlyTasks } from "./taskGenerator"
import { generateJobInstances } from "./generators/jobInstanceGenerator"
import { listCareers } from "./content/careers"
import { getTaskGraphById, OUTCOME_DEFINITIONS, TASK_OUTCOME_OVERRIDES } from "./content/tasks"

export type GameAction =
  | { type: "ADVANCE_MONTH" }
  | { type: "ADD_LOG"; text: string }
  | { type: "SET_TASKS"; tasks: TaskState[] }
  | { type: "RESOLVE_TASK"; taskId: string }
  | { type: "APPLY_STATS_DELTA"; delta: Partial<{ health: number; humanity: number; stress: number; money: number }> }
  | { type: "APPLY_OUTCOME"; outcome: string; taskGraphId?: string }
  | { type: "START_TASK_RUN"; taskId: string; taskGraphId: string }
  | { type: "MAKE_TASK_CHOICE"; choiceId: string }
  | { type: "SET_PLAYER_JOB"; jobId: string | null }
  | { type: "REMOVE_JOB_ASSIGNMENT"; jobId: string }
  | { type: "TAKE_JOB_INSTANCE"; instanceId: string; replaceCareer?: boolean }
  | { type: "CONNECT_NPC"; npc: any; affiliations?: string[]; relationshipStrength?: number }

const randId = () => Math.random().toString(36).slice(2)

function pick<T>(value: T | T[]): T {
  return Array.isArray(value)
    ? value[Math.floor(Math.random() * value.length)]
    : value;
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

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "ADVANCE_MONTH": {
      const newMonth = state.month + 1
      const interimState: GameState = { ...state, month: newMonth }
      const tasks = generateMonthlyTasks(interimState)
      // generate fresh procedural job instances (replace previous)
      try {
        const careers = listCareers()
        const templates = careers.flatMap(c => c.levels.map(l => l.id))

        // determine player's current job, career, and affiliation
        const assignment = Object.values(state.jobAssignments ?? {}).find(a => a.memberId === state.player.id)
        const playerCareerId = assignment ? getCareerForJobId(assignment.jobId)?.id ?? null : null

        // try to get affiliation from memberships first; fallback to filled job instance if present
        const membership = Object.values(state.memberships ?? {}).find((m: any) => m.memberId === state.player.id)
        const playerAffiliationId = membership ? membership.affiliationId ?? null : (() => {
          const playerPosting = Object.values(state.jobInstances ?? {}).find((p: any) => p.filledBy === state.player.id)
          return playerPosting ? playerPosting.affiliationId ?? null : null
        })()

        const postings = generateJobInstances(templates, {
          salaryJitter: 0.15,
          maxListings: 5,
          playerCareerId,
          playerAffiliationId,
          playerCurrentJobId: assignment?.jobId ?? null,
        })
        const jobInstances = postings.reduce<Record<string, any>>((m, p) => {
          m[p.id] = p
          return m
        }, {})

        return {
          ...state,
          month: newMonth,
          tasks,
          jobInstances,
        log: [
          ...state.log,
          {
            id: randId(),
            month: newMonth,
            text: pick([
              "Mayor Denies Allegations of Illegal Cyberware Donations from Corpo Syndicate",
              "Mysterious EMP Pulse Blackouts District 7 for 3 Minutes, Authorities 'Investigating'",
              "Netrunner Collective Claims Responsibility for Overnight Transit Shutdown",
              "Food Printer Malfunction Causes Neon-Green Protein Sludge Recall",
              "Biotech Firm Unveils New 'Emotion Regulator' Implant, Critics Raise Concerns",
              "Gang Leader ‘ChromeJack’ Spotted in High-Security Zone, How Did He Get In?",
              "Illegal Drone Racing Ring Busted Under Old MagRail Tunnels",
              "Rising Radiation Levels Near the Dead Zone Prompt Evacuation Order",
              "Street Vendors Protest New Microtax on Augmented Hands Payments",
              "Corpo War Rumors Spike After CEO Found Dead in Encrypted Hotel Capsule",
              "District 3 Water Supply Contaminated After Factory Coolant Leak",
              "Arcology’s AI Assistant Glitches, Issues 2,000 False Eviction Notices",
              "Black Market Cyberware Prices Triple After Border Checkpoint Crackdowns",
              "Valkarna Auto Consortium Announces Layoffs Following Plant Explosion",
              "Hyperloop Station Hijacked, Passengers Forced to Watch Pirate Broadcast",
              "Synthetic Pets Firmware Update Causes Mass Runaways Across the City",
              "Anonymous Tips Reveal Hidden Vault Beneath Decommissioned Police Precinct",
              "Cyberpsychosis Cases Surge After Release of Experimental Brain Mod",
              "Coastal Weather Shields Fail, Acid Rain Warning Issued for Entire Weekend",
              "AI Judge Sentences Itself to Maintenance After 'Ethical Conflict Detected'"
            ]),
          },
        ],
        }
      } catch (e) {
        // if job instance generation fails, fall back to previous behavior without instances
        return {
          ...state,
          month: newMonth,
          tasks,
          log: [
            ...state.log,
            {
              id: randId(),
              month: newMonth,
              text: pick([
                "Mayor Denies Allegations of Illegal Cyberware Donations from Corpo Syndicate",
                "Mysterious EMP Pulse Blackouts District 7 for 3 Minutes, Authorities 'Investigating'",
                "Netrunner Collective Claims Responsibility for Overnight Transit Shutdown",
              ]),
            },
          ],
        }
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

      return { ...state, tasks }
    }

    case "START_TASK_RUN": {
      const graph = getTaskGraphById(action.taskGraphId)
      if (!graph) return state

      return {
        ...state,
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
      const affiliations = action.affiliations ?? npc.affiliationIds ?? []
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
