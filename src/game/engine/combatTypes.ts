import type { SkillBlock } from "../types"

export type CombatSide = "player" | "enemy"

export type CardType = "attack" | "defense" | "utility"

export type CardTag = "STR" | "REF" | "INT" | "CHR"

export type KeywordKind =
  | { kind: "innate" }
  | { kind: "prepared" }
  | { kind: "autoCast"; trigger: "CombatStart" | "TurnStart" }
  | { kind: "retain" }
  | { kind: "exhaust" }

export type Targeting = "self" | "enemySingle" | "enemiesAll"

export type ScalingRef =
  | { type: "stat"; key: keyof SkillBlock }
  | { type: "counter"; key: keyof CombatCounters }
  | { type: "handSize" }
  | { type: "handCountByType"; cardType: CardType }
  | { type: "handCountByTag"; tag: CardTag }
  | { type: "constant"; value: number }

export type ConditionSpec =
  | { type: "statAtLeast"; key: keyof SkillBlock; value: number }
  | { type: "handEmpty" }
  | { type: "hasTagLock"; tag: CardTag }
  | { type: "hpBelowPct"; side: CombatSide; pct: number }
  | { type: "always" }

export type EffectOperation =
  | { op: "dealDamage"; amount: number | ScalingRef; target?: Targeting }
  | { op: "gainShield"; amount: number | ScalingRef; target?: Targeting }
  | { op: "heal"; amount: number | ScalingRef; target?: Targeting }
  | { op: "draw"; amount: number }
  | { op: "applyStatus"; status: StatusTemplate }
  | { op: "modifyCost"; delta: number; scope?: "self" }
  | { op: "modifyStat"; stat: "maxHP"; delta: number }
  | { op: "modifyHandLimit"; delta: number }
  | { op: "modifyEnergyPerTurn"; delta: number }
  | { op: "repeatNext"; targetType: "attack" | "any" }
  | { op: "skipTurn"; side: CombatSide }
  | { op: "combatEnd" }
  | { op: "dealRandom"; min: number; max: number; rolls?: number; target?: Targeting }
  | { op: "moveFromDiscardToDeck"; mode: "copyTop" | "moveTop" }
  | { op: "exhaustFromDiscardTop"; count: number }
  | { op: "recastDiscardTop"; defaultTarget?: Targeting }
  | { op: "noop" }

export type EffectSpec = {
  operation: EffectOperation
  condition?: ConditionSpec
  target?: Targeting
}

export type CardDefinition = {
  id: string
  name: string
  type: CardType
  rarity: "common" | "uncommon" | "rare" | "unique"
  cost: number
  tags: CardTag[]
  description: string
  icon?: string
  keywords?: KeywordKind[]
  effects: EffectSpec[]
  persistent?: boolean
}

export type StatusStacking = "refresh" | "stack" | "replace" | "ignore"

export type StatusTemplate = {
  id: string
  name: string
  description?: string
  duration: number | "combat"
  triggers: CombatTrigger[]
  effects: EffectSpec[]
  stacking?: StatusStacking
  appliesTo?: CombatSide
}

export type StatusInstance = StatusTemplate & { remaining: number | "combat" }

export type CardInstance = {
  uid: string
  cardId: string
  temporaryCost?: number
  createdFrom?: string
  ephemeral?: boolean
}

export type ZoneName = "deck" | "hand" | "discard" | "exhaust" | "inPlay"

export type CombatZones = {
  deck: CardInstance[]
  hand: CardInstance[]
  discard: CardInstance[]
  exhaust: CardInstance[]
  inPlay: CardInstance[]
}

export type CombatCounters = {
  damageDealtThisTurn: number
  damageDealtThisCombat: number
  cardsPlayedThisTurn: number
  cardsPlayedThisCombat: number
  attackCardsPlayedThisTurn: number
  attackCardsPlayedThisCombat: number
}

export type CombatantState = {
  hp: number
  maxHP: number
  shield?: number
  statuses: StatusInstance[]
}

export type CombatConfig = {
  handLimit: number
  energyPerTurn: number
  maxTurns?: number
}

export type CombatState = {
  turn: number
  activeSide: CombatSide
  energy: number
  config: CombatConfig
  counters: CombatCounters
  rngSeed?: string
  rng: () => number
  playerSkills: SkillBlock
  enemySkills?: SkillBlock
  preparedCardIds: string[]
  autoCastCards: { cardId: string; trigger: "CombatStart" | "TurnStart" }[]
  zones: CombatZones
  player: CombatantState
  enemy: CombatantState
  cardLibrary: Record<string, CardDefinition>
  tagLocks: CardTag[]
}

export type CombatTrigger =
  | { kind: "CombatStart" }
  | { kind: "TurnStart" }
  | { kind: "CardPlayed"; card: CardDefinition }
  | { kind: "DamageDealt"; amount: number; target: CombatSide }
  | { kind: "DamageTaken"; amount: number; target: CombatSide }
  | { kind: "TurnEnd" }
  | { kind: "CombatEnd" }

export type PlayCardParams = {
  cardInstanceId: string
  target?: CombatSide
}
