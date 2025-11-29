import type { PlayerState } from "../types"

// A profile omits runtime IDs and district assignment.
export type PlayerProfile = Omit<
  PlayerState,
  "id" | "homeDistrictId" | "currentDistrictId"
>

const profiles: PlayerProfile[] = [
  {
    profileId: "rook_grease",
    name: "Rook",
    ageMonths: 20 * 12,
    stats: {
      health: 95,
      humanity: 85,
      stress: 10,
      money: 350,
      looks: 6,
      skills: { str: 6, int: 8, ref: 7, chr: 4 },
    },
    lifestyle: "underground",
    jobId: "apprentice_mechanic",
    affiliationId: "valkarna_auto",
    inventoryIds: [],
    relationshipNpcIds: [],
    tags: ["runner", "mechanic", "industrial"],
  },
  {
    profileId: "maya_line",
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
    jobId: "line_cook",
    affiliationId: "instafood_collective",
    inventoryIds: [],
    relationshipNpcIds: [],
    tags: ["lawful", "midlands", "people_person"],
  },
  {
    profileId: "anton_shadow",
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
    jobId: "courier",
    affiliationId: null,
    inventoryIds: [],
    relationshipNpcIds: [],
    tags: ["risky", "street", "runner"],
  },
]

export const getRandomProfile = (): PlayerProfile => {
  const i = Math.floor(Math.random() * profiles.length)
  return { ...profiles[i] }
}

export const getProfileById = (id: string): PlayerProfile | undefined => {
  return profiles.find(p => p.profileId === id)
}

export default profiles
