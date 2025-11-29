import type { NpcState, Tag } from "../types"

const randId = () => Math.random().toString(36).slice(2)

export type NpcProfile = {
  id: string
  name: string
  age: number
  avatarId: string
  stats: NpcState["stats"]
  trust: number
  relationship: number
  affiliationId: string | null
  tags: Tag[]
}

const NPC_PROFILES: Record<string, NpcProfile> = {
  kea_face: {
    id: "kea_face",
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
    affiliationId: "instafood_collective",
    tags: ["fixer", "charismatic", "midlands"],
  },
  vik_hardline: {
    id: "vik_hardline",
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
    affiliationId: "valkarna_auto",
    tags: ["mechanic", "veteran", "industrial"],
  },
}

export const listNpcProfiles = (): NpcProfile[] => Object.values(NPC_PROFILES)

export const getNpcProfileById = (id: string): NpcProfile | undefined =>
  NPC_PROFILES[id]

export const createNpc = (profileId?: string): NpcState => {
  const profiles = listNpcProfiles()
  const base = profileId
    ? NPC_PROFILES[profileId]
    : profiles[Math.floor(Math.random() * profiles.length)]

  if (!base) {
    throw new Error("Requested NPC profile not found")
  }

  return {
    templateId: base.id,
    id: randId(),
    name: base.name,
    age: base.age,
    avatarId: base.avatarId,
    stats: base.stats,
    trust: base.trust,
    relationship: base.relationship,
    affiliationId: base.affiliationId,
    tags: base.tags,
  }
}

export default NPC_PROFILES
