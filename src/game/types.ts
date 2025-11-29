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

export type PlayerState = { // while player state is mainly data based on other datatypes
  id: string
  name: string
  ageMonths: number
  stats: StatBlock
  lifestyle: "lawful" | "risky" | "underground"
  homeDistrictId: string
  currentDistrictId: string
  inventoryIds: string[]
  relationshipNpcIds: string[]
}

export type NpcState = {
  id: string
  name: string
  age: number
  avatarId: string
  stats: StatBlock
  trust: number
  relationship: number
  affiliationId: string | null
}

export type DistrictState = {
  id: string
  name: string
  security: number
  unrest: number
  economy: number
}

export type TaskKind = "job" | "bill" | "randomEvent"

export type TaskState = {
  id: string
  kind: TaskKind
  title: string
  description: string
  resolved: boolean
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
}
