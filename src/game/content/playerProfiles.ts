import type { PlayerState } from "../types"

// A profile omits `id`, `homeDistrictId` and `currentDistrictId` since those are
// assigned at game start.
export type PlayerProfile = Omit<
  PlayerState,
  "id" | "homeDistrictId" | "currentDistrictId"
>

const profiles: PlayerProfile[] = [
  {
    name: "Rook",
    ageMonths: 20 * 12,
    stats: {
      health: 95,
      humanity: 85,
      stress: 10,
      money: 350,
      looks: 6,
      skills: { str: 6, int: 5, ref: 7, chr: 4 },
    },
    lifestyle: "underground",
    inventoryIds: [],
    relationshipNpcIds: [],
  },
  {
    name: "Maya",
    ageMonths: 18 * 12,
    stats: {
      health: 100,
      humanity: 100,
      stress: 0,
      money: 500,
      looks: 7,
      skills: { str: 4, int: 8, ref: 5, chr: 6 },
    },
    lifestyle: "lawful",
    inventoryIds: [],
    relationshipNpcIds: [],
  },
  {
    name: "Anton",
    ageMonths: 25 * 12,
    stats: {
      health: 85,
      humanity: 70,
      stress: 20,
      money: 1200,
      looks: 4,
      skills: { str: 8, int: 4, ref: 6, chr: 3 },
    },
    lifestyle: "risky",
    inventoryIds: [],
    relationshipNpcIds: [],
  },
]

export const getRandomProfile = (): PlayerProfile => {
  const i = Math.floor(Math.random() * profiles.length)
  // return a shallow copy to avoid accidental mutations of the base profiles
  return { ...profiles[i] }
}

export default profiles
