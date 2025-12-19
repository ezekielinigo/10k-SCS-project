import type { GameState, JobAssignment } from "./types"
import { getProfileById, getRandomProfile } from "./content/playerProfiles"
import DISTRICTS from "./districts"
import { createNpc } from "./content/npcProfiles"
import { generateMonthlyTasks } from "./taskGenerator"

const randId = () => Math.random().toString(36).slice(2)

export const createInitialGameState = (): GameState => {
  const homeDistrictId = "downtown"

  const profile = getProfileById("rook_grease") ?? getRandomProfile()

  const playerId = randId()

  const npcA = createNpc()
  const npcB = createNpc()

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

  const baseState: GameState = {
    month: 0,
    player: {
      id: playerId,
      profileId: profile.profileId,
      avatarId: profile.avatarId,
      name: profile.name,
      ageMonths: profile.ageMonths,
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
        month: 1,
        text: "You wake up in Downtown Ark. Fresh start.",
      },
    ],
    worldTags: ["baseline", "season_late_spring"],
    activeTaskRun: null,
    relationships: {},
    jobs: {},
    jobAssignments,
    itemTemplates: {},
    itemInstances: {},
    inventoryEntries: {},
    affiliations: {},
    memberships: {},
  }

  const starterTasks = generateMonthlyTasks(baseState)

  return { ...baseState, tasks: starterTasks }
}
