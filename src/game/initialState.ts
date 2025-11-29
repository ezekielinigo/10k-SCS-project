import type { GameState } from "./types"
import { getProfileById, getRandomProfile } from "./content/playerProfiles"
import DISTRICTS from "./districts"
import { createNpc } from "./content/npcProfiles"
import { generateMonthlyTasks } from "./taskGenerator"

const randId = () => Math.random().toString(36).slice(2)

export const createInitialGameState = (): GameState => {
  const homeDistrictId = "downtown"

  const profile = getProfileById("rook_grease") ?? getRandomProfile()

  const npcA = createNpc()
  const npcB = createNpc()

  const baseState: GameState = {
    month: 1,
    player: {
      id: randId(),
      // spread the randomly chosen profile, then assign district fields
      ...profile,
      homeDistrictId,
      currentDistrictId: homeDistrictId,
    },
    npcs: { [npcA.id]: npcA, [npcB.id]: npcB },
    // Use centralized districts data. Spread to avoid accidental mutation at runtime.
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
  }

  const starterTasks = generateMonthlyTasks(baseState)

  return { ...baseState, tasks: starterTasks }
}
