import type { SkillBlock, Tag, VitalBlock } from "../types"

export type NpcTemplate = {
  id: string
  // either a concrete pattern with arrays, or a small list of named groups
  // e.g. ["mechanic_male", "mechanic_female"] where index 0 = male, 1 = female
  namePattern: { first: string[]; last: string[] } | string[]
  avatarPool: string[]
  age: [number, number]
  // legacy single-pool affiliations (kept for compatibility; set to [] now)
  affiliationIds?: string[]
  // occupations allow picking career-linked jobs and their affiliation pools
  // `chance` is 0..1 probability that this occupation produces a job for the NPC
  occupations?: { careerId: string; affiliationIds?: string[]; chance?: number }[]
  vitals: {
    // range from 0% to 100%
    health: [number, number]
    humanity: [number, number]
    stress: [number, number]
    looks: [number, number]

    // scalar
    money: [number, number]
    bounty: [number, number]
    popularity: [number, number]
  }
  skills: {
    // range from 1 to 10
    // not the skill level, but used to allocate priority
    // higher means higher priority for stat point allocation
    str: [number, number]
    int: [number, number]
    ref: [number, number]
    chr: [number, number]

    // range from -100% to 100%
    // jitter applied to subskills after base allocation
    // formula: baseSubskill * (1 + randomInRange(jitter)/100)
    // default of [-25, 25] if not specified
    subSkills?: Partial<Record<keyof SkillBlock["subSkills"], [number, number]>>
  }
  tags: Tag[]
  districts?: string[]
}

export const NPC_TEMPLATES: Record<string, NpcTemplate> = {
  courier_runner: {
    id: "courier_runner",
    namePattern: ["male", "female"],
    avatarPool: ["avatar-1", "avatar-2", "avatar-3"],
    age: [18, 38],
    affiliationIds: [],
    occupations: [
      { careerId: "courier", affiliationIds: ["swift_runners", "night_owl_couriers"], chance: 0.9 },
    ],
    vitals: { health: [75, 95], humanity: [70, 95], stress: [5, 35], money: [150, 500], looks: [5, 80], bounty: [0, 1000], popularity: [30, 60] },
    skills: {
      str: [4, 6],
      int: [5, 7],
      ref: [7, 10],
      chr: [4, 6],
      subSkills: {
        mobility: [0, 40],
        athletics: [0, 30],
        streetwise: [-5, 25],
      },
    },
    tags: ["courier", "runner", "street_smart"],
    districts: ["downtown", "midlands"],
  },
  mechanic_grease: {
    id: "mechanic_grease",
    namePattern: ["male", "female"],
    avatarPool: ["avatar-4", "avatar-5", "avatar-6"],
    age: [20, 45],
    affiliationIds: [],
    occupations: [
      { careerId: "mechanic", affiliationIds: ["valkarna_auto", "ironclad_garage", "speedy_repairs"], chance: 0.9 },
    ],
    vitals: { health: [70, 95], humanity: [60, 90], stress: [10, 40], money: [200, 800], looks: [4, 70], bounty: [0, 500], popularity: [25, 50] },
    skills: {
      str: [5, 8],
      int: [5, 8],
      ref: [5, 7],
      chr: [3, 5],
      subSkills: {
        engineering: [10, 40],
        heavyHandling: [20, 50],
        athletics: [0, 20],
        hacking: [-10, 20],
        medical: [-40, 0],
      },
    },
    tags: ["mechanic", "industrial", "blue_collar"],
    districts: ["industrial"],
  },
  fixer_face: {
    id: "fixer_face",
    namePattern: ["male", "female"],
    avatarPool: ["avatar-7", "avatar-8", "avatar-9"],
    age: [24, 44],
    affiliationIds: [],
    occupations: [
      { careerId: "fixer", affiliationIds: ["fixer_collective", "swift_runners"], chance: 0.9 },
    ],
    vitals: { health: [70, 90], humanity: [65, 90], stress: [10, 45], money: [400, 1600], looks: [6, 90], bounty: [0, 150], popularity: [55, 90] },
    skills: {
      str: [3, 5],
      int: [6, 8],
      ref: [5, 7],
      chr: [7, 10],
      subSkills: {
        persuasion: [20, 50],
        deception: [0, 25],
        streetwise: [0, 30],
      },
    },
    tags: ["fixer", "charismatic", "midlands"],
    districts: ["midlands", "downtown"],
  },
  street_tough: {
    id: "street_tough",
    namePattern: ["male", "female"],
    avatarPool: ["avatar-10", "avatar-11"],
    age: [19, 40],
    affiliationIds: [],
    occupations: [
      { careerId: "enforcer", affiliationIds: ["street_gangs", "no_affiliation"], chance: 0.9 },
    ],
    vitals: { health: [80, 100], humanity: [40, 75], stress: [15, 55], money: [80, 400], looks: [4, 70], bounty: [0, 300], popularity: [25, 45] },
    skills: {
      str: [7, 10],
      int: [3, 5],
      ref: [6, 9],
      chr: [3, 5],
      subSkills: {
        closeCombat: [20, 50],
        athletics: [10, 40],
        marksmanship: [10, 40],
      },
    },
    tags: ["muscle", "street", "independent"],
    districts: ["downtown", "industrial"],
  },
  clinic_medic: {
    id: "clinic_medic",
    namePattern: ["male", "female"],
    avatarPool: ["avatar-12", "avatar-13"],
    age: [23, 50],
    affiliationIds: [],
    occupations: [
      { careerId: "medic", affiliationIds: ["clinic_collective", "instafood_collective"], chance: 0.9 },
    ],
    vitals: { health: [75, 95], humanity: [70, 100], stress: [5, 40], money: [300, 1200], looks: [5, 80], bounty: [0, 50], popularity: [35, 70] },
    skills: {
      str: [3, 5],
      int: [8, 10],
      ref: [5, 7],
      chr: [5, 8],
      subSkills: {
        medical: [30, 60],
        engineering: [-5, 15],
        persuasion: [-5, 10],
      },
    },
    tags: ["medic", "support", "lawful"],
    districts: ["midlands"],
  },
}

export const listNpcTemplates = (): NpcTemplate[] => Object.values(NPC_TEMPLATES)

export const getNpcTemplateById = (id?: string | null): NpcTemplate | undefined =>
  id ? NPC_TEMPLATES[id] : undefined

export default NPC_TEMPLATES
