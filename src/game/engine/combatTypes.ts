import type { SkillBlock } from "../types"

export type CombatSide = "player" | "enemy"

export type TargetSpecifier = CombatSide | { side: CombatSide; index?: number }

export type CardType = "attack" | "defense" | "utility" | "DMG" | "DEF" | "SKL" | "ERR"

export type CardTag = "STR" | "REF" | "INT" | "CHR"

export type KeywordKind =
  | { kind: "innate" }
  | { kind: "prepared" }
  | { kind: "autoCast"; trigger: "CombatStart" | "TurnStart" }
  | { kind: "retain" }
  | { kind: "exhaust" }
  | { kind: "fleeting" }
  | { kind: "cursed" }

export type Targeting = "self" | "enemySingle" | "enemiesAll"

export type ScalingRef =
  | { type: "stat"; key: keyof SkillBlock }
  | { type: "counter"; key: keyof CombatCounters }
  | { type: "counterTimes"; key: keyof CombatCounters; multiplier: number }
  | { type: "handSize" }
  | { type: "handCountByType"; cardType: CardType }
  | { type: "handCountByTag"; tag: CardTag }
  | { type: "constant"; value: number }
  | { type: "shield"; side: CombatSide; divisor?: number }

export type ConditionSpec =
  | { type: "statAtLeast"; key: keyof SkillBlock; value: number }
  | { type: "handEmpty" }
  | { type: "hasTagLock"; tag: CardTag }
  | { type: "hpBelowPct"; side: CombatSide; pct: number }
  | { type: "shieldAtLeast"; side: CombatSide; value: number }
  | { type: "shieldGainedThisTurnAtLeast"; value: number }
  | { type: "always" }

export type EffectOperation =
  | { op: "dealDamage"; amount: number | ScalingRef; target?: Targeting }
  | { op: "gainShield"; amount: number | ScalingRef; target?: Targeting }
  | { op: "heal"; amount: number | ScalingRef; target?: Targeting }
  | { op: "draw"; amount: number }
  | { op: "applyStatus"; status: StatusTemplate }
  | { op: "backfire"; amount: number }
  | { op: "addCardToDeck"; cardId?: string; count?: number; shuffle?: boolean; temporaryCost?: number; fleeting?: boolean }
  | { op: "createCardsInHand"; cardId: string; count: number; temporaryCost?: number; fleeting?: boolean }
  | { op: "convertShieldToHeal"; amount: number }
  | { op: "applyElement"; element: "FIRE" | "PHYS" | "HACK" | "ELDR"; amount: number }
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
  fleeting?: boolean
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
  damageTicksThisTurn: number
  cardsPlayedThisTurn: number
  cardsPlayedThisCombat: number
  attackCardsPlayedThisTurn: number
  attackCardsPlayedThisCombat: number
  shieldGainedThisTurn: number
}

export type CombatantState = {
  hp: number
  maxHP: number
  shield?: number
  statuses: StatusInstance[]
  elements: {
    fire: number
    phys: number
    hack: number
    eldr: number
    blueFire: number
  }
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
  enemies: CombatantState[]
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
  target?: TargetSpecifier
}
