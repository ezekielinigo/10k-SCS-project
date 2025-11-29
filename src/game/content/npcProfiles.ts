import type { NpcState } from "../types"

const randId = () => Math.random().toString(36).slice(2)

export type NpcProfile = Omit<NpcState, "id">

const NPC_PROFILES: NpcProfile[] = [
  {
    name: "Kea",
    age: 28,
    avatarId: "avatar-1",
    stats: {
      health: 90,
      humanity: 80,
      stress: 5,
      money: 200,
      looks: 6,
      skills: { str: 4, int: 7, ref: 6, chr: 8 },
    },
    trust: 50,
    relationship: 0,
    affiliationId: null,
  },
  {
    name: "Vik",
    age: 35,
    avatarId: "avatar-2",
    stats: {
      health: 80,
      humanity: 60,
      stress: 20,
      money: 1000,
      looks: 5,
      skills: { str: 8, int: 4, ref: 6, chr: 3 },
    },
    trust: 40,
    relationship: 0,
    affiliationId: null,
  },
]

export const createNpc = (): NpcState => {
  const i = Math.floor(Math.random() * NPC_PROFILES.length)
  const base = NPC_PROFILES[i]
  return { id: randId(), ...base }
}

export default NPC_PROFILES
