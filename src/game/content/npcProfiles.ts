import type { Tag, SkillBlock, VitalBlock, NpcState, Gender } from "../types"

const randId = () => Math.random().toString(36).slice(2)

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const cloneVitals = (vitals: VitalBlock): VitalBlock => ({ ...vitals })

const cloneSkills = (skills: SkillBlock): SkillBlock => ({
  ...skills,
  subSkills: { ...skills.subSkills },
})

export type NpcProfile = {
  id: string
  name: string
  age: number
  gender: Gender
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
    gender: "female",
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
    gender: "male",
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
  const base = profileId ? NPC_PROFILES[profileId] : pick(profiles)

  if (!base) throw new Error("Requested NPC profile not found")

  return {
    id: randId(),
    name: base.name,
    age: base.age,
    gender: base.gender,
    avatarId: base.avatarId,
    vitals: cloneVitals(base.vitals),
    skills: cloneSkills(base.skills),
    currentDistrict: "downtown",
    tags: [...base.tags],
    origin: "unique",
    profileId: base.id,
  }
}

export default NPC_PROFILES
