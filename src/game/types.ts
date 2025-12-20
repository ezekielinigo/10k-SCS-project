/* OLD CODE DO NOT CHANGE

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

export type OutcomeTier =
  | "great_success"
  | "success"
  | "failure"
  | "great_failure"

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
  taskGraphId: string | null
  resolved: boolean
  assignedNpcId?: string | null
  contextTags: Tag[]
}

export type TaskChoiceCondition = {
  minStats?: Partial<Omit<StatBlock, "skills">> & { skills?: Partial<SkillBlock> }
  maxStress?: number
  requiresItemIds?: string[]
  minMoney?: number
}

export type TaskChoice = {
  id: string
  text: string
  nextNodeId?: string
  outcome?: OutcomeTier
  weight?: number
  condition?: TaskChoiceCondition
}

export type TaskNode = {
  id: string
  description: string
  choices: TaskChoice[]
}

export type TaskGraph = {
  id: string
  entryNodeId: string
  nodes: Record<string, TaskNode>
}

export type OutcomeDefinition = {
  tier: OutcomeTier
  applyEffects: (state: GameState, context: { taskGraphId: string }) => GameState
}

export type ActiveTaskRun = {
  taskGraphId: string
  originTaskId: string
  currentNodeId: string | null
  pendingOutcome?: OutcomeTier
  outcomeFlavorText?: string
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
  activeTaskRun: ActiveTaskRun | null
  // relationships stores many-to-many connections between entities (player and NPCs
  // or NPC <-> NPC). Each relationship has a strength (0-100) representing the
  // relationship percentage.
  relationships: Record<string, Relationship>
}


*/

/** UNORGANIZED */
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

export type OutcomeTier =
  | "great_success"
  | "success"
  | "failure"
  | "great_failure"

/** EVERYTHING ABOUT THE PLAYER */

export type PlayerState = {
  // credentials
  id: string // unique identifier
  profileId: string // used for save files
  avatarId: string
  name: string
  ageMonths: number

  // stats
  vitals: VitalBlock
  skills: SkillBlock
  
  // per-entity caches removed; use central stores on GameState for jobs/inventory/affiliations
  currentDistrict: string
  tags: Tag[]
}

// primary game 
export type VitalBlock = {
    // gives disadvantages when low
  // 1-100 percentage
  health: number
  stress: number

    // changes encounters and DC adjustments
  // 1-100 percentage 
  humanity: number
  looks: number
  // (for per faction reputation see affiliationBlock)
  // scalar
  money: number
  bounty: number
}

// primary skills and subskills 
// used by player and NPCs
export type SkillBlock = {
  // 1-10 levels
  str: number
  int: number
  ref: number
  chr: number
  // 1-100 levels
  subSkills: {
    athletics: number
    closeCombat: number
    heavyHandling: number
    hacking: number
    medical: number
    engineering: number
    marksmanship: number
    stealth: number
    mobility: number
    persuasion: number
    deception: number
    streetwise: number
  }
}

/** THE WORLD */

export type NpcState = {
  // credentials
  id: string
  avatarId: string
  name: string
  age: number

  // stats
  vitals: VitalBlock
  skills: SkillBlock
  currentDistrict: string
  tags: Tag[]
}

// canonical definition of an affiliation/faction/company/org
export type Affiliation = {
  id: string
  name: string
  description: string
  type?: "company" | "faction" | "organization"
  tags?: Tag[]
}

// links members to affiliations and tracks reputation/standing
export type AffiliationMembership = {
  id: string
  affiliationId: string
  memberId: string
  // -100 to 100
  reputation: number
}

export type FactionState = {
  id: string
  name: string
  reputation: number
  influence: number
  tags: Tag[]
}

export type Career = {
  id: string
  title: string
  description?: string
  // optional context for the career
  affiliationId?: string[]
  districtId?: string
  tags?: Tag[]
  // optional path to the compiled Ink file that contains job/task knots for this career
  inkSource?: string
  // each level stores the full job metadata for quick lookup
  levels: Job[]
}

// canonical definition of a job/role
export type Job = {
  id: string
  title: string
  description?: string | string[]
  careerId?: string
  districtId?: string
  salary?: number
  requirements?: Record<string, any> | null
  // baseline performance expectations for the role (metric -> target)
  performanceMetrics?: Record<string, number>
  tags?: Tag[]
  // optional ink/task linkage: the knot / task graph id to open for job tasks
  taskGraphId?: string
  // optional compiled ink file path (if different from career-level `inkSource`)
  inkSource?: string
}

// links members to jobs and tracks standing/performance
export type JobAssignment = {
  id: string // e.g. `${jobId}__${memberId}`
  jobId: string
  memberId: string
  // 0-100 %
  performance: number
}

// procedural job offer built from a Job template
export type JobPosting = {
  id: string
  templateId: string
  affiliationId?: string | null
  salary?: number
  tags?: Tag[]
  description?: string
  // who claimed it (player or npc id)
  filledBy?: string | null
  metadata?: Record<string, any>
}

// canonical definition of an item
// used to create instances
export type ItemTemplate = {
  id: string
  name: string
  stackable?: boolean
  tags?: Tag[]
}

// a concrete object created from a template
// used when owned by player or NPC (track individually)
export type ItemInstance = {
  id: string
  templateId: string
  ownerId?: string
  durable?: number
  metadata?: Record<string, any>
}

// links owner to item instances and tracks quantity
export type InventoryEntry = {
  id: string // e.g. `${ownerId}__${templateId}`
  ownerId: string
  templateId: string
  quantity: number
}

export type DistrictState = {
  id: string
  name: string
  security: number
  unrest: number
  economy: number
  tags: Tag[]
}

export type Relationship = {
  id: string
  aId: string
  bId: string
  // 0-100 %
  strength: number
  tags?: Tag[]
}

/** TASKS */

export type TaskKind = "job" | "bill" | "randomEvent"

export type TaskState = {
  id: string
  templateId: string
  kind: TaskKind
  taskGraphId: string | null
  resolved: boolean
  assignedNpcId?: string | null
  contextTags: Tag[]
}

export type TaskChoice = {
  id: string
  text: string
  nextNodeId?: string
  outcome?: OutcomeTier
  weight?: number
}

export type TaskNode = {
  id: string
  description: string
  choices: TaskChoice[]
}

export type TaskGraph = {
  id: string
  entryNodeId: string
  nodes: Record<string, TaskNode>
}

export type OutcomeDefinition = {
  tier: OutcomeTier
  applyEffects: (state: GameState, context: { taskGraphId: string }) => GameState
}

export type ActiveTaskRun = {
  taskGraphId: string
  originTaskId: string
  currentNodeId: string | null
  pendingOutcome?: OutcomeTier
  outcomeFlavorText?: string
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
  activeTaskRun: ActiveTaskRun | null
  relationships: Record<string, Relationship>
  // centralized affiliation data and memberships (many-to-many)
  affiliations?: Record<string, Affiliation>
  memberships?: Record<string, AffiliationMembership>

  // centralized jobs + assignments (many-to-many)
  jobs?: Record<string, Job>
  jobAssignments?: Record<string, JobAssignment>
  jobPostings?: Record<string, JobPosting>

  // items and inventories
  itemTemplates?: Record<string, ItemTemplate>
  itemInstances?: Record<string, ItemInstance>
  inventoryEntries?: Record<string, InventoryEntry>
}