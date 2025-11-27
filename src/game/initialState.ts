import type { GameState } from "./types"

const randId = () => Math.random().toString(36).slice(2)

export const createInitialGameState = (): GameState => {
  const homeDistrictId = "downtown"

  return {
    month: 0,
    player: {
      id: randId(),
      name: "New Runner",
      ageMonths: 18 * 12,
      stats: { str: 5, int: 5, ref: 5, chr: 5 },
      health: 100,
      humanity: 100,
      stress: 0,
      money: 500,
      lifestyle: "lawful",
      homeDistrictId,
      currentDistrictId: homeDistrictId,
      inventoryIds: [],
      relationshipNpcIds: [],
    },
    npcs: {},
    districts: {
      [homeDistrictId]: {
        id: homeDistrictId,
        name: "Downtown Ark",
        security: 50,
        unrest: 30,
        economy: 60,
      },
    },
    tasks: [],
    log: [
      {
        id: randId(),
        month: 0,
        text: "You wake up in Downtown Ark. Eighteen years old. Fresh start.",
      },
    ],
  }
}
