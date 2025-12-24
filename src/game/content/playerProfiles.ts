import type { Gender, SkillBlock, VitalBlock } from "../types"

// Seed data for creating a PlayerState plus some optional starting hooks
export type PlayerProfile = {
  profileId: string
  avatarId: string
  name: string
  ageMonths: number
  gender: Gender
  currentDistrict: string
  vitals: VitalBlock
  skills: SkillBlock
  tags: string[]
  startingJobId?: string
  startingAffiliationId?: string | null
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

const profiles: PlayerProfile[] = [
  {
    profileId: "rook_grease",
    avatarId: "avatar-hero",
    name: "Rook Grease",
    ageMonths: 20 * 12,
    gender: "male",
    currentDistrict: "downtown",
    vitals: {
      health: 100,
      humanity: 85,
      stress: 10,
      money: 350,
      looks: 6,
      bounty: 0,
      popularity: 58,
    },
    skills: { str: 6, int: 8, ref: 7, chr: 4, 
      subSkills: {
        athletics: 25,
        closeCombat: 15,
        heavyHandling: 23,
        hacking: 35,
        medical: 46,
        engineering: 78,
        marksmanship: 34,
        stealth: 23,
        mobility: 30,
        persuasion: 23,
        deception: 12,
        streetwise: 23,
      } 
    },
    startingJobId: "apprentice_mechanic",
    startingAffiliationId: "valkarna_auto",
    tags: ["runner", "mechanic", "industrial"],
  },
  {
    profileId: "maya_line",
    avatarId: "avatar-maya",
    name: "Maya",
    ageMonths: 18 * 12,
    gender: "female",
    currentDistrict: "midlands",
    vitals: {
      health: 100,
      humanity: 100,
      stress: 0,
      money: 500,
      looks: 7,
      bounty: 0,
      popularity: 66,
    },
    skills: { str: 4, int: 8, ref: 5, chr: 6, subSkills: { ...zeroSubSkills } },
    startingJobId: "line_cook",
    startingAffiliationId: "instafood_collective",
    tags: ["lawful", "midlands", "people_person"],
  },
  {
    profileId: "anton_shadow",
    avatarId: "avatar-anton",
    name: "Anton",
    ageMonths: 25 * 12,
    gender: "male",
    currentDistrict: "industrial",
    vitals: {
      health: 85,
      humanity: 70,
      stress: 20,
      money: 1200,
      looks: 4,
      bounty: 0,
      popularity: 42,
    },
    skills: { str: 8, int: 4, ref: 6, chr: 3, subSkills: { ...zeroSubSkills } },
    startingJobId: "courier",
    startingAffiliationId: null,
    tags: ["risky", "street", "runner"],
  },
]

export const getRandomProfile = (): PlayerProfile => {
  const i = Math.floor(Math.random() * profiles.length)
  return { ...profiles[i], skills: { ...profiles[i].skills, subSkills: { ...profiles[i].skills.subSkills } } }
}

export const getProfileById = (id: string): PlayerProfile | undefined => {
  return profiles.find(p => p.profileId === id)
}

export default profiles
