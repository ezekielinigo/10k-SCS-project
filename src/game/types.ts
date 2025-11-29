export type Tag = string

export type EventScope =
  | "job_related"
  | "district_related"
  | "npc_related"
  | "faction_related"
  | "world"
  | "personal_life"
  | "health"
  | "cyberware"

export type StatBlock = { // stat block is mainly the numeric data
  health: number
  humanity: number
  stress: number
  money: number
  looks: number
  skills: SkillBlock
}

export type SkillBlock = {
  str: number
  int: number
  ref: number
  chr: number
}

export type PlayerLifestyle = "lawful" | "risky" | "underground"

export type PlayerState = { // while player state is mainly data based on other datatypes
  profileId: string
  id: string
  name: string
  ageMonths: number
  stats: StatBlock
  lifestyle: PlayerLifestyle
  jobId: string | null
  affiliationId: string | null
  homeDistrictId: string
  currentDistrictId: string
  inventoryIds: string[]
  relationshipNpcIds: string[]
  tags: Tag[]
}

export type NpcState = {
  templateId: string
  id: string
  name: string
  age: number
  avatarId: string
  stats: StatBlock
  trust: number
  relationship: number
  affiliationId: string | null
  tags: Tag[]
}

export type DistrictState = {
  id: string
  name: string
  security: number
  unrest: number
  economy: number
  tags: Tag[]
}

export type TaskKind = "job" | "bill" | "randomEvent"

export type TaskState = {
  id: string
  templateId: string
  kind: TaskKind
  resolved: boolean
  assignedNpcId?: string | null
  contextTags: Tag[]
}

export type LogEntry = {
  id: string
  month: number
  text: string
}

export type GameState = {
  month: number
  player: PlayerState
  npcs: Record<string, NpcState>
  districts: Record<string, DistrictState>
  tasks: TaskState[]
  log: LogEntry[]
  worldTags: Tag[]
}
