import type { Tag, SkillBlock, VitalBlock, NpcState } from "../types"

const randId = () => Math.random().toString(36).slice(2)

export type NpcProfile = {
  id: string
  name: string
  age: number
  avatarId: string
  vitals: VitalBlock
  skills: SkillBlock
  tags: Tag[]
}

const zeroSubSkills: SkillBlock["subSkills"] = {
  athletics: 0,
  closeCombat: 0,
  heavyHandling: 0,
  hacking: 0,
  medical: 0,
  engineering: 0,
  marksmanship: 0,
  stealth: 0,
  mobility: 0,
  persuasion: 0,
  deception: 0,
  streetwise: 0,
}

const NPC_PROFILES: Record<string, NpcProfile> = {
  kea_face: {
    id: "kea_face",
    name: "Kea",
    age: 28,
    avatarId: "avatar-1",
    vitals: {
      health: 90,
      humanity: 80,
      stress: 5,
      money: 200,
      looks: 6,
      bounty: 0,
    },
    skills: { str: 4, int: 7, ref: 6, chr: 8, subSkills: { ...zeroSubSkills } },
    tags: ["fixer", "charismatic", "midlands"],
  },
  vik_hardline: {
    id: "vik_hardline",
    name: "Vik",
    age: 35,
    avatarId: "avatar-2",
    vitals: {
      health: 80,
      humanity: 60,
      stress: 20,
      money: 1000,
      looks: 5,
      bounty: 0,
    },
    skills: { str: 8, int: 4, ref: 6, chr: 3, subSkills: { ...zeroSubSkills } },
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
    id: randId(),
    name: base.name,
    age: base.age,
    avatarId: base.avatarId,
    vitals: base.vitals,
    skills: base.skills,
    currentDistrict: "downtown",
    tags: base.tags,
  }
}

export default NPC_PROFILES
