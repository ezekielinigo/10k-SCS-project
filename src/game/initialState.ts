import type { GameState, JobAssignment } from "./types"
import { getJobById, getCareerForJobId } from "./content/careers"
import { getProfileById, getRandomProfile } from "./content/playerProfiles"
import DISTRICTS from "./content/districts"
import { generateRandomNpc } from "./generators/npcGenerator"
import { generateMonthlyTasks } from "./taskGenerator"
import { generateJobInstances } from "./generators/jobInstanceGenerator"

const randId = () => Math.random().toString(36).slice(2)

export const createInitialGameState = (): GameState => {
  const homeDistrictId = "downtown"

  const profile = getProfileById("rook_grease") ?? getRandomProfile()

  const playerId = randId()

  const npcA = generateRandomNpc({ allowUnique: true, uniqueChance: 0.35 })
  const npcB = generateRandomNpc()

  const jobAssignments: Record<string, JobAssignment> = {}
  if (profile.startingJobId) {
    const id = `${profile.startingJobId}__${playerId}`
    jobAssignments[id] = {
      id,
      jobId: profile.startingJobId,
      memberId: playerId,
      performance: 50,
    }
  }

  const starterCareerId = profile.startingJobId ? getCareerForJobId(profile.startingJobId)?.id ?? null : null
  const starterAffiliationId = profile.startingAffiliationId ?? null

  // seed a couple of procedural job instances based on existing job templates, skipping the player's starter job/affiliation
  const jobInstancesArr = generateJobInstances([
    "apprentice_mechanic",
    "courier",
  ], {
    salaryJitter: 0.15,
    maxListings: 5,
    playerCareerId: starterCareerId,
    playerAffiliationId: starterAffiliationId,
    playerCurrentJobId: profile.startingJobId ?? null,
  })
  const jobInstances = jobInstancesArr.reduce<Record<string, any>>((acc, instance) => {
    acc[instance.id] = instance
    return acc
  }, {})

  // If the profile specifies a starting affiliation for the starting job, create a membership
  // and a filled job instance that reflects the player's pre-existing employment.
  const memberships: Record<string, any> = {}
  if (profile.startingJobId && profile.startingAffiliationId) {
    const affId = profile.startingAffiliationId
    const membershipId = `${affId}__${playerId}`
    memberships[membershipId] = { id: membershipId, affiliationId: affId, memberId: playerId, reputation: 0 }

    // create a filled instance representing the starter job at that affiliation
    try {
      const job = getJobById(profile.startingJobId)
      const jobInstanceId = `job_${profile.startingJobId}__${playerId}`
      jobInstances[jobInstanceId] = {
        id: jobInstanceId,
        templateId: profile.startingJobId,
        affiliationId: affId,
        salary: job?.salary ?? undefined,
        tags: job?.tags ?? [],
        description: Array.isArray(job?.description) ? job?.description[0] : job?.description,
        filledBy: playerId,
        metadata: { seeded: true },
      }
    } catch (e) {
      // ignore if job lookup fails
    }
  }

  const baseState: GameState = {
    month: 0,
    player: {
      id: playerId,
      profileId: profile.profileId,
      avatarId: profile.avatarId,
      name: profile.name,
      ageMonths: profile.ageMonths,
      gender: profile.gender,
      vitals: profile.vitals,
      skills: profile.skills,
      currentDistrict: profile.currentDistrict ?? homeDistrictId,
      tags: profile.tags,
    },
    npcs: { [npcA.id]: npcA, [npcB.id]: npcB },
    districts: { ...DISTRICTS },
    tasks: [],
    log: [
      {
        id: randId(),
        month: 0,
        text: "You wake up in Downtown Ark. Fresh start.",
      },
    ],
    worldTags: ["baseline", "season_late_spring"],
    activeTaskRun: null,
    pendingTaskRuns: [],
    relationships: {},
    jobs: {},
    jobAssignments,
    jobInstances,
    memberships,
    itemTemplates: {},
    itemInstances: {},
    inventoryEntries: {},
    affiliations: {},
    // memberships already set above (avoid duplicate key)
  }

  const starterTasks = generateMonthlyTasks(baseState)

  return { ...baseState, tasks: starterTasks }
}
