import type { GameState } from "./types"
import { getRandomProfile } from "./content/playerProfiles"
import DISTRICTS from "./districts"
import { createNpc } from "./content/npcProfiles"
import { createJob } from "./content/jobs"
import { createRandomEvent } from "./content/randomEvents"

const randId = () => Math.random().toString(36).slice(2)

export const createInitialGameState = (): GameState => {
  const homeDistrictId = "downtown"

  const profile = getRandomProfile()

  // create a couple of starter NPCs and seed tasks
  const npcA = createNpc()
  const npcB = createNpc()

  const starterNpcs = { [npcA.id]: npcA, [npcB.id]: npcB }

  const starterTasks = [createJob(), createRandomEvent()]

  return {
    month: 0,
    player: {
      id: randId(),
      // spread the randomly chosen profile, then assign district fields
      ...profile,
      homeDistrictId,
      currentDistrictId: homeDistrictId,
    },
    npcs: starterNpcs,
    // Use centralized districts data. Spread to avoid accidental mutation at runtime.
    districts: { ...DISTRICTS },
    tasks: starterTasks,
    log: [
      {
        id: randId(),
        month: 0,
        text: "You wake up in Downtown Ark. Eighteen years old. Fresh start.",
      },
    ],
  }
}
