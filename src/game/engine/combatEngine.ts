import { makeRng } from "./statCheck"
import type {
  CardDefinition,
  CardInstance,
  CardTag,
  CombatConfig,
  CombatState,
  CombatTrigger,
  CombatZones,
  CombatantState,
  CombatCounters,
  ConditionSpec,
  EffectOperation,
  EffectSpec,
  KeywordKind,
  PlayCardParams,
  TargetSpecifier,
  StatusInstance,
  StatusStacking,
  StatusTemplate,
  ZoneName,
} from "./combatTypes"
import type { SkillBlock } from "../types"

export type CreateCombatParams = {
  player: { hp: number; maxHP: number; skills: SkillBlock }
  enemy: { hp: number; maxHP: number; skills?: SkillBlock }
  enemies?: { hp: number; maxHP: number; skills?: SkillBlock }[]
  deckCardIds: string[]
  cardLibrary: CardDefinition[] | Record<string, CardDefinition>
  rngSeed?: string
  config?: Partial<CombatConfig>
  tagLocks?: CardTag[]
}

export type PlayResult = { state: CombatState; ok: true } | { state: CombatState; ok: false; reason: string }

const defaultConfig: CombatConfig = {
  handLimit: 5,
  energyPerTurn: 5,
}

const defaultCounters = (): CombatCounters => ({
  damageDealtThisTurn: 0,
  damageDealtThisCombat: 0,
  damageTicksThisTurn: 0,
  cardsPlayedThisTurn: 0,
  cardsPlayedThisCombat: 0,
  attackCardsPlayedThisTurn: 0,
  attackCardsPlayedThisCombat: 0,
  shieldGainedThisTurn: 0,
})

type TargetRef = { side: "player" } | { side: "enemy"; index: number }

const ensureEnemies = (state: CombatState): CombatState => {
  if (state.enemies && state.enemies.length > 0) return state
  const enemies = [state.enemy]
  return { ...state, enemies, enemy: enemies[0] }
}

const clampEnemyIndex = (state: CombatState, index?: number): number | null => {
  const enemies = state.enemies
  if (!enemies || enemies.length === 0) return null
  const maxIndex = Math.min(enemies.length - 1, 2)
  const idx = typeof index === "number" ? Math.max(0, Math.min(index, maxIndex)) : null
  if (idx !== null && enemies[idx] && enemies[idx].hp > 0) return idx
  const firstAlive = enemies.findIndex((enemy) => enemy.hp > 0)
  return firstAlive >= 0 ? firstAlive : null
}

const getEnemyAt = (state: CombatState, index: number): CombatantState => {
  const enemies = state.enemies ?? [state.enemy]
  return enemies[index] ?? enemies[0]
}

const setEnemyAt = (state: CombatState, index: number, enemy: CombatantState): CombatState => {
  const enemies = [...(state.enemies ?? [state.enemy])]
  enemies[index] = enemy
  return { ...state, enemies, enemy: enemies[0] }
}

const cloneZones = (zones: CombatZones): CombatZones => ({
  deck: [...zones.deck],
  hand: [...zones.hand],
  discard: [...zones.discard],
  exhaust: [...zones.exhaust],
  inPlay: [...zones.inPlay],
})

const findKeyword = (card: CardDefinition, kind: KeywordKind["kind"]): KeywordKind | undefined =>
  card.keywords?.find((k) => k.kind === kind)

const shuffle = (cards: CardInstance[], rng: () => number) => {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

const createCardLibraryMap = (cards: CardDefinition[] | Record<string, CardDefinition>): Record<string, CardDefinition> =>
  Array.isArray(cards)
    ? cards.reduce<Record<string, CardDefinition>>((acc, card) => {
        acc[card.id] = card
        return acc
      }, {})
    : cards

const makeCardInstance = (cardId: string, uidSeed: string, overrides?: Partial<CardInstance>): CardInstance => ({
  uid: `${cardId}__${uidSeed}`,
  cardId,
  ...overrides,
})

const addCardsToDeck = (state: CombatState, cardId: string, count: number, shuffleIntoDeck = true, overrides?: Partial<CardInstance>): CombatState => {
  const zones = cloneZones(state.zones)
  for (let i = 0; i < count; i++) {
    zones.deck.push(makeCardInstance(cardId, `gen_${state.rng().toString().slice(2)}_${i}`, overrides))
  }
  if (shuffleIntoDeck) {
    zones.deck = shuffle(zones.deck, state.rng)
  }
  return { ...state, zones }
}

const addCardsToHand = (state: CombatState, cardId: string, count: number, overrides?: Partial<CardInstance>): CombatState => {
  const zones = cloneZones(state.zones)
  for (let i = 0; i < count; i++) {
    zones.hand.push(makeCardInstance(cardId, `hand_${state.rng().toString().slice(2)}_${i}`, overrides))
  }
  return { ...state, zones }
}

const addErrorCardsToDeck = (state: CombatState, count: number): CombatState => {
  if (count <= 0) return state
  const errIds = Object.values(state.cardLibrary)
    .filter((card) => card.type === "ERR")
    .map((card) => card.id)
  if (errIds.length === 0) return state
  let next = state
  for (let i = 0; i < count; i++) {
    const pick = errIds[Math.floor(state.rng() * errIds.length)]
    next = addCardsToDeck(next, pick, 1, true)
  }
  return next
}

const clampStack = (value: number, max = 3) => Math.max(0, Math.min(max, value))

const updateElements = (
  state: CombatState,
  target: TargetRef,
  updater: (current: CombatantState["elements"]) => CombatantState["elements"],
): CombatState => {
  if (target.side === "player") {
    const elements = updater(state.player.elements)
    return { ...state, player: { ...state.player, elements } }
  }
  const current = getEnemyAt(state, target.index)
  const elements = updater(current.elements)
  return setEnemyAt(state, target.index, { ...current, elements })
}

const applyCorruptedEffect = (state: CombatState, target: TargetRef): CombatState => {
  if (target.side !== "player") return state
  let next = drawCards(state, 1)
  next = addErrorCardsToDeck(next, 1)
  return next
}

const applyElementStack = (state: CombatState, target: TargetRef, element: "FIRE" | "PHYS" | "HACK" | "ELDR"): CombatState => {
  const elements = { ...(target.side === "player" ? state.player.elements : getEnemyAt(state, target.index).elements) }

  const applyStun = (current: CombatState) =>
    addStatusToSide(current, target, {
      id: "stun",
      name: "Stunned",
      description: "Skip next turn.",
      duration: 1,
      stacking: "refresh",
      triggers: [{ kind: "TurnStart" }],
      effects: [{ operation: { op: "skipTurn", side } }],
    })

  const applyMania = (current: CombatState) =>
    addStatusToSide(current, target, {
      id: "mania",
      name: "Mania",
      description: "Intent becomes unstable.",
      duration: 1,
      stacking: "refresh",
      triggers: [],
      effects: [],
    })

  if (element === "FIRE") {
    if (elements.eldr > 0) {
      const converted = elements.fire + 1
      elements.fire = 0
      elements.eldr = Math.max(0, elements.eldr - 1)
      elements.blueFire += converted
      return updateElements(state, target, () => elements)
    }
    if (elements.phys > 0) {
      elements.phys = Math.max(0, elements.phys - 1)
      let next = updateElements(state, target, () => elements)
      next = applyDamage(next, target, 20)
      return next
    }
    if (elements.hack > 0) {
      elements.hack = Math.max(0, elements.hack - 1)
      return updateElements(state, target, () => elements)
    }
    elements.fire = clampStack(elements.fire + 1)
    return updateElements(state, target, () => elements)
  }

  if (element === "PHYS") {
    if (elements.eldr > 0) {
      if (elements.phys + 1 >= 3) {
        elements.phys = Math.max(0, elements.phys - 2)
        elements.eldr = Math.max(0, elements.eldr - 1)
        let next = updateElements(state, target, () => elements)
        return applyStun(next)
      }
      elements.eldr = Math.max(0, elements.eldr - 1)
      let next = updateElements(state, target, () => elements)
      return applyCorruptedEffect(next, target)
    }
    if (elements.fire > 0) {
      elements.fire = Math.max(0, elements.fire - 1)
      let next = updateElements(state, target, () => elements)
      next = applyDamage(next, target, 20)
      return next
    }
    if (elements.hack > 0) {
      elements.hack = Math.max(0, elements.hack - 1)
      let next = updateElements(state, target, () => elements)
      return addStatusToSide(next, target, {
        id: "jam_next",
        name: "Jam",
        description: "Negate next damage taken.",
        duration: 1,
        stacking: "refresh",
        triggers: [],
        effects: [],
      })
    }
    elements.phys = clampStack(elements.phys + 1)
    return updateElements(state, target, () => elements)
  }

  if (element === "HACK") {
    if (elements.eldr > 0) {
      if (elements.hack + 1 >= 3) {
        elements.hack = Math.max(0, elements.hack - 2)
        elements.eldr = Math.max(0, elements.eldr - 1)
        let next = updateElements(state, target, () => elements)
        return applyMania(next)
      }
      elements.eldr = Math.max(0, elements.eldr - 1)
      let next = updateElements(state, target, () => elements)
      return applyCorruptedEffect(next, target)
    }
    if (elements.fire > 0) {
      elements.fire = Math.max(0, elements.fire - 1)
      return updateElements(state, target, () => elements)
    }
    if (elements.phys > 0) {
      elements.phys = Math.max(0, elements.phys - 1)
      let next = updateElements(state, target, () => elements)
      return addStatusToSide(next, target, {
        id: "jam_next",
        name: "Jam",
        description: "Negate next damage taken.",
        duration: 1,
        stacking: "refresh",
        triggers: [],
        effects: [],
      })
    }
    elements.hack = clampStack(elements.hack + 1)
    return updateElements(state, target, () => elements)
  }

  if (element === "ELDR") {
    if (elements.fire > 0) {
      elements.blueFire += elements.fire
      elements.fire = 0
      return updateElements(state, target, () => elements)
    }
    if (elements.phys > 0) {
      if (elements.phys >= 3) {
        elements.phys = Math.max(0, elements.phys - 3)
        let next = updateElements(state, target, () => elements)
        return applyStun(next)
      }
      elements.phys = Math.max(0, elements.phys - 1)
      let next = updateElements(state, target, () => elements)
      return applyCorruptedEffect(next, target)
    }
    if (elements.hack > 0) {
      if (elements.hack >= 3) {
        elements.hack = Math.max(0, elements.hack - 3)
        let next = updateElements(state, target, () => elements)
        return applyMania(next)
      }
      elements.hack = Math.max(0, elements.hack - 1)
      let next = updateElements(state, target, () => elements)
      return applyCorruptedEffect(next, target)
    }
    elements.eldr = clampStack(elements.eldr + 1)
    return updateElements(state, target, () => elements)
  }

  return state
}

const applyElementalTurnStart = (state: CombatState, target: TargetRef): CombatState => {
  let next = state
  const elements = { ...(target.side === "player" ? next.player.elements : getEnemyAt(next, target.index).elements) }

  if (elements.fire > 0) {
    elements.fire = Math.max(0, elements.fire - 1)
    next = updateElements(next, target, () => elements)
    next = applyDamage(next, target, 10)
  }

  if (elements.blueFire > 0) {
    elements.blueFire = Math.max(0, elements.blueFire - 1)
    next = updateElements(next, target, () => elements)
    next = applyDirectDamage(next, target, 20)
  }

  if (elements.phys > 0) {
    elements.phys = Math.max(0, elements.phys - 1)
    next = updateElements(next, target, () => elements)
    next = addStatusToSide(next, target, {
      id: "vulnerable_next",
      name: "Vulnerable",
      description: "Next damage ignores 50% DEF.",
      duration: 1,
      stacking: "refresh",
      triggers: [],
      effects: [],
    })
  }

  if (elements.hack > 0) {
    elements.hack = Math.max(0, elements.hack - 1)
    next = updateElements(next, target, () => elements)
    next = addStatusToSide(next, target, {
      id: "shorted_next",
      name: "Shorted",
      description: "Next damage reduced by 25%.",
      duration: 1,
      stacking: "refresh",
      triggers: [],
      effects: [],
    })
  }

  if (elements.eldr > 0) {
    elements.eldr = Math.max(0, elements.eldr - 1)
    next = updateElements(next, target, () => elements)
    next = applyCorruptedEffect(next, target)
  }

  return next
}

const buildDeck = (
  cardIds: string[],
  cardLibrary: Record<string, CardDefinition>,
): { deck: CardInstance[]; prepared: string[]; autoCast: { cardId: string; trigger: "CombatStart" | "TurnStart" }[] } => {
  const deck: CardInstance[] = []
  const prepared: string[] = []
  const autoCast: { cardId: string; trigger: "CombatStart" | "TurnStart" }[] = []

  let counter = 0
  cardIds.forEach((cardId) => {
    const def = cardLibrary[cardId]
    if (!def) return
    const auto = def.keywords?.find((k) => k.kind === "autoCast") as KeywordKind & { trigger?: "CombatStart" | "TurnStart" } | undefined
    if (auto && auto.trigger) {
      autoCast.push({ cardId, trigger: auto.trigger })
      return
    }
    if (findKeyword(def, "prepared")) {
      prepared.push(cardId)
    }
    deck.push({ uid: `${cardId}__${counter++}`, cardId })
  })

  return { deck, prepared, autoCast }
}

export const createCombatState = ({ player, enemy, enemies, deckCardIds, cardLibrary, rngSeed, config, tagLocks }: CreateCombatParams): CombatState => {
  const rng = makeRng(rngSeed)
  const library = createCardLibraryMap(cardLibrary)
  const { deck, prepared, autoCast } = buildDeck(deckCardIds, library)

  const zones: CombatZones = {
    deck: shuffle(deck, rng),
    hand: [],
    discard: [],
    exhaust: [],
    inPlay: [],
  }

  const baseCombatant = (hp: number, maxHP: number): CombatantState => ({
    hp,
    maxHP,
    shield: 0,
    statuses: [],
    elements: { fire: 0, phys: 0, hack: 0, eldr: 0, blueFire: 0 },
  })

  const sourceEnemies = (enemies && enemies.length > 0 ? enemies : [enemy]).slice(0, 3)
  const enemyStates = sourceEnemies.map((entry) => baseCombatant(entry.hp, entry.maxHP))
  const primaryEnemy = enemyStates[0] ?? baseCombatant(enemy.hp, enemy.maxHP)

  return {
    turn: 0,
    activeSide: "player",
    energy: 0,
    config: { ...defaultConfig, ...config },
    counters: defaultCounters(),
    rngSeed,
    rng,
    playerSkills: player.skills,
    enemySkills: sourceEnemies[0]?.skills ?? enemy.skills,
    preparedCardIds: prepared,
    autoCastCards: autoCast,
    zones,
    player: baseCombatant(player.hp, player.maxHP),
    enemy: primaryEnemy,
    enemies: enemyStates.length > 0 ? enemyStates : [primaryEnemy],
    cardLibrary: library,
    tagLocks: tagLocks ?? [],
  }
}

type DrawOptions = { skipUids?: Set<string> }
const drawCards = (state: CombatState, amount: number, options?: DrawOptions): CombatState => {
  if (amount <= 0) return state
  const zones = cloneZones(state.zones)
  const { skipUids } = options ?? {}
  let remaining = amount

  const ensureDeck = () => {
    if (zones.deck.length > 0) return
    const available = skipUids ? zones.discard.filter((ci) => !skipUids.has(ci.uid)) : zones.discard
    if (available.length === 0) return
    zones.deck = shuffle([...available], state.rng)
    zones.discard = skipUids ? zones.discard.filter((ci) => skipUids.has(ci.uid)) : []
  }

  while (remaining > 0) {
    ensureDeck()
    if (zones.deck.length === 0) break
    const card = zones.deck.shift()!
    zones.hand.push(card)
    remaining -= 1
  }

  return { ...state, zones }
}

const moveCard = (zones: CombatZones, from: ZoneName, to: ZoneName, uid: string): CombatZones => {
  const source = [...zones[from]]
  const idx = source.findIndex((c) => c.uid === uid)
  if (idx === -1) return zones
  const [card] = source.splice(idx, 1)
  const targetArr = [...zones[to], card]
  return {
    ...zones,
    [from]: source,
    [to]: targetArr,
  }
}

const cardHasKeyword = (card: CardDefinition, kind: KeywordKind["kind"]): boolean => !!findKeyword(card, kind)

const reduceStatuses = (statuses: StatusInstance[]): StatusInstance[] =>
  statuses
    .map((s) => {
      if (s.remaining === "combat") return s
      const next = { ...s, remaining: typeof s.remaining === "number" ? s.remaining - 1 : s.remaining }
      return next
    })
    .filter((s) => s.remaining === "combat" || (typeof s.remaining === "number" && s.remaining > 0))

const applyStatus = (statuses: StatusInstance[], template: StatusTemplate): StatusInstance[] => {
  const stacking: StatusStacking = template.stacking ?? "refresh"
  const existingIdx = statuses.findIndex((s) => s.id === template.id)
  if (existingIdx >= 0) {
    if (stacking === "ignore") return statuses
    if (stacking === "replace") {
      const next = [...statuses]
      next[existingIdx] = { ...template, remaining: template.duration }
      return next
    }
    if (stacking === "refresh") {
      const next = [...statuses]
      next[existingIdx] = { ...statuses[existingIdx], remaining: template.duration }
      return next
    }
    if (stacking === "stack") {
      return [...statuses, { ...template, remaining: template.duration }]
    }
  }
  return [...statuses, { ...template, remaining: template.duration }]
}

const testCondition = (cond: ConditionSpec | undefined, state: CombatState): boolean => {
  if (!cond) return true
  switch (cond.type) {
    case "always":
      return true
    case "statAtLeast":
      {
        const value = state.playerSkills[cond.key]
        return typeof value === "number" ? value >= cond.value : false
      }
    case "handEmpty":
      return state.zones.hand.length === 0
    case "hasTagLock":
      return state.tagLocks.includes(cond.tag)
    case "hpBelowPct": {
      const { side, pct } = cond
      const current = state[side].hp
      const max = state[side].maxHP
      return max > 0 ? current / max < pct : false
    }
    case "shieldAtLeast": {
      const shield = state[cond.side].shield ?? 0
      return shield >= cond.value
    }
    case "shieldGainedThisTurnAtLeast":
      return state.counters.shieldGainedThisTurn >= cond.value
    default:
      return true
  }
}

const resolveAmount = (amount: number | { type: string; [key: string]: any }, state: CombatState): number => {
  if (typeof amount === "number") return amount
  const ref = amount as any
  if (ref.type === "stat") {
    const value = state.playerSkills[ref.key as keyof SkillBlock]
    return typeof value === "number" ? value : 0
  }
  if (ref.type === "counter") return state.counters[ref.key as keyof CombatCounters] ?? 0
  if (ref.type === "counterTimes") {
    const base = state.counters[ref.key as keyof CombatCounters] ?? 0
    return base * (ref.multiplier ?? 1)
  }
  if (ref.type === "handSize") return state.zones.hand.length
  if (ref.type === "handCountByType") {
    return state.zones.hand.reduce((acc, ci) => {
      const def = state.cardLibrary[ci.cardId]
      return def && def.type === ref.cardType ? acc + 1 : acc
    }, 0)
  }
  if (ref.type === "handCountByTag") {
    return state.zones.hand.reduce((acc, ci) => {
      const def = state.cardLibrary[ci.cardId]
      return def && def.tags.includes(ref.tag) ? acc + 1 : acc
    }, 0)
  }
  if (ref.type === "constant") return ref.value ?? 0
  if (ref.type === "shield") {
    const side = ref.side === "enemy" ? "enemy" : "player"
    const shield = side === "player"
      ? state.player.shield ?? 0
      : getEnemyAt(state, clampEnemyIndex(state) ?? 0).shield ?? 0
    const divisor = ref.divisor ?? 1
    return divisor > 1 ? Math.floor(shield / divisor) * divisor : shield
  }
  return 0
}

const applyDamage = (state: CombatState, target: TargetRef, amount: number): CombatState => {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max))
  if (amount <= 0) return state

  const applyDirect = (current: CombatState, side: "player" | "enemy", raw: number, enemyIndex?: number): CombatState => {
    if (raw <= 0) return current
    if (side === "player") {
      const hp = clamp(current.player.hp - raw, current.player.maxHP)
      return { ...current, player: { ...current.player, hp } }
    }
    const enemy = getEnemyAt(current, enemyIndex ?? 0)
    const hp = clamp(enemy.hp - raw, enemy.maxHP)
    const counters = {
      ...current.counters,
      damageDealtThisTurn: current.counters.damageDealtThisTurn + raw,
      damageDealtThisCombat: current.counters.damageDealtThisCombat + raw,
      damageTicksThisTurn: current.counters.damageTicksThisTurn + 1,
    }
    return setEnemyAt({ ...current, counters }, enemyIndex ?? 0, { ...enemy, hp })
  }

  const side = target.side
  const combatant = side === "player" ? state.player : getEnemyAt(state, target.index)
  const statusIds = new Set(combatant.statuses.map((s) => s.id))
  let next = state

  if (statusIds.has("jam_next")) {
    next = removeStatusById(next, target, "jam_next")
    return next
  }

  let incoming = amount
  if (statusIds.has("shorted_next")) {
    incoming = Math.floor(incoming * 0.75)
    next = removeStatusById(next, target, "shorted_next")
  }

  let shield = side === "player" ? next.player.shield ?? 0 : getEnemyAt(next, target.index).shield ?? 0
  if (shield > 0) {
    const ignoreShield = statusIds.has("vulnerable_next") ? 0.5 : 0
    if (statusIds.has("vulnerable_next")) {
      next = removeStatusById(next, target, "vulnerable_next")
    }
    const effectiveShield = Math.floor(shield * (1 - ignoreShield))
    const absorbed = Math.min(incoming, effectiveShield)
    shield = Math.max(0, shield - absorbed)
    incoming = Math.max(0, incoming - absorbed)
  }

  if (side === "player") {
    const hp = clamp(next.player.hp - incoming, next.player.maxHP)
    return { ...next, player: { ...next.player, hp, shield } }
  }

  const enemy = getEnemyAt(next, target.index)
  const hp = clamp(enemy.hp - incoming, enemy.maxHP)
  const counters = {
    ...next.counters,
    damageDealtThisTurn: next.counters.damageDealtThisTurn + incoming,
    damageDealtThisCombat: next.counters.damageDealtThisCombat + incoming,
    damageTicksThisTurn: next.counters.damageTicksThisTurn + (incoming > 0 ? 1 : 0),
  }
  return setEnemyAt({ ...next, counters }, target.index, { ...enemy, hp, shield })
}

const applyDirectDamage = (state: CombatState, target: TargetRef, amount: number): CombatState => {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max))
  if (amount <= 0) return state
  if (target.side === "player") {
    const hp = clamp(state.player.hp - amount, state.player.maxHP)
    return { ...state, player: { ...state.player, hp } }
  }
  const enemy = getEnemyAt(state, target.index)
  const hp = clamp(enemy.hp - amount, enemy.maxHP)
  const counters = {
    ...state.counters,
    damageDealtThisTurn: state.counters.damageDealtThisTurn + amount,
    damageDealtThisCombat: state.counters.damageDealtThisCombat + amount,
    damageTicksThisTurn: state.counters.damageTicksThisTurn + (amount > 0 ? 1 : 0),
  }
  return setEnemyAt({ ...state, counters }, target.index, { ...enemy, hp })
}

const heal = (state: CombatState, target: TargetRef, amount: number): CombatState => {
  if (amount <= 0) return state
  if (target.side === "player") {
    const hp = Math.min(state.player.maxHP, state.player.hp + amount)
    return { ...state, player: { ...state.player, hp } }
  }
  const enemy = getEnemyAt(state, target.index)
  const hp = Math.min(enemy.maxHP, enemy.hp + amount)
  return setEnemyAt(state, target.index, { ...enemy, hp })
}

const addStatusToSide = (state: CombatState, target: TargetRef, status: StatusTemplate): CombatState => {
  if (target.side === "player") {
    return { ...state, player: { ...state.player, statuses: applyStatus(state.player.statuses, status) } }
  }
  const enemy = getEnemyAt(state, target.index)
  return setEnemyAt(state, target.index, { ...enemy, statuses: applyStatus(enemy.statuses, status) })
}

const topDiscard = (zones: CombatZones): CardInstance | null => {
  if (zones.discard.length === 0) return null
  return zones.discard[zones.discard.length - 1]
}

const removeStatusById = (state: CombatState, target: TargetRef, statusId: string): CombatState => {
  if (target.side === "player") {
    return { ...state, player: { ...state.player, statuses: state.player.statuses.filter((s) => s.id !== statusId) } }
  }
  const enemy = getEnemyAt(state, target.index)
  return setEnemyAt(state, target.index, { ...enemy, statuses: enemy.statuses.filter((s) => s.id !== statusId) })
}

const dispatchTrigger = (state: CombatState, trigger: CombatTrigger): CombatState => {
  const runStatusEffects = (statuses: StatusInstance[], target: TargetRef, current: CombatState): CombatState => {
    let next = current
    statuses.forEach((status) => {
      const matches = status.triggers.some((t) => t.kind === trigger.kind)
      if (!matches) return
      status.effects.forEach((effect) => {
        if (effect.operation.op === "repeatNext" && trigger.kind === "CardPlayed") {
          const card = trigger.card
          if (!card) return
          const targetType = effect.operation.targetType
          if (targetType === "any" || card.type === "attack" || card.type === "DMG") {
            card.effects.forEach((ef) => {
              next = resolveEffect(
                next,
                ef,
                target.side,
                target.side === "player" ? "enemy" : "player",
                { source: "status", trigger, status, actorEnemyIndex: target.side === "enemy" ? target.index : undefined },
              )
            })
            next = removeStatusById(next, target, status.id)
          }
        } else {
          next = resolveEffect(
            next,
            effect,
            target.side,
            target.side === "player" ? "enemy" : "player",
            { source: "status", trigger, status, actorEnemyIndex: target.side === "enemy" ? target.index : undefined },
          )
        }
      })
    })
    return next
  }

  let nextState = runStatusEffects(state.player.statuses, { side: "player" }, state)
  const enemies = state.enemies ?? [state.enemy]
  enemies.forEach((enemy, index) => {
    nextState = runStatusEffects(enemy.statuses, { side: "enemy", index }, nextState)
  })
  return nextState
}

type ResolveContext = {
  source: "card" | "status" | "autocast"
  cardDef?: CardDefinition
  trigger?: CombatTrigger
  status?: StatusInstance
  cardInstanceId?: string
  actorEnemyIndex?: number
}

const resolveEffect = (
  state: CombatState,
  effect: EffectSpec,
  actor: "player" | "enemy",
  targetSide: "player" | "enemy" = actor === "player" ? "enemy" : "player",
  context: ResolveContext,
  targetSpecifier?: TargetSpecifier,
): CombatState => {
  const normalized = ensureEnemies(state)
  if (!testCondition(effect.condition, normalized)) return normalized

  const op = effect.operation

  const resolveTargeting = (): TargetRef[] => {
    const target = effect.target ?? targetSide
    const actorEnemyIndex = context.actorEnemyIndex ?? 0
    if (target === "self") {
      return actor === "player" ? [{ side: "player" }] : [{ side: "enemy", index: actorEnemyIndex }]
    }
    if (target === "enemySingle" || target === "enemy") {
      if (actor !== "player") return [{ side: "player" }]
      const desiredIndex = typeof targetSpecifier === "object" && targetSpecifier.side === "enemy"
        ? targetSpecifier.index
        : undefined
      const chosenIndex = clampEnemyIndex(normalized, desiredIndex)
      return chosenIndex === null ? [] : [{ side: "enemy", index: chosenIndex }]
    }
    if (target === "enemiesAll") {
      if (actor !== "player") return [{ side: "player" }]
      return (normalized.enemies ?? [normalized.enemy])
        .map((enemy, index) => (enemy.hp > 0 ? { side: "enemy" as const, index } : null))
        .filter((value): value is TargetRef => Boolean(value))
    }
    if (target === "player") return [{ side: "player" }]
    if (target === "enemy") {
      const chosenIndex = clampEnemyIndex(normalized, undefined)
      return chosenIndex === null ? [] : [{ side: "enemy", index: chosenIndex }]
    }
    if (targetSide === "player") return [{ side: "player" }]
    const fallbackIndex = clampEnemyIndex(normalized, undefined)
    return fallbackIndex === null ? [] : [{ side: "enemy", index: fallbackIndex }]
  }

  switch (op.op) {
    case "dealDamage": {
      const amt = resolveAmount(op.amount as any, normalized)
      const targets = resolveTargeting()
      let next = normalized
      targets.forEach((t) => {
        next = applyDamage(next, t, amt)
        next = dispatchTrigger(next, { kind: "DamageDealt", amount: amt, target: t.side })
      })
      if (context.source === "card") {
        const firstTarget = targets[0]
        if (firstTarget) next = dispatchTrigger(next, { kind: "DamageTaken", amount: amt, target: firstTarget.side })
      }
      return next
    }
    case "gainShield": {
      const amt = resolveAmount(op.amount as any, normalized)
      const targets = resolveTargeting()
      let next = normalized
      targets.forEach((t) => {
        if (t.side === "player") {
          next = { ...next, player: { ...next.player, shield: (next.player.shield ?? 0) + amt } }
        } else {
          const enemy = getEnemyAt(next, t.index)
          next = setEnemyAt(next, t.index, { ...enemy, shield: (enemy.shield ?? 0) + amt })
        }
      })
      if (amt > 0 && targets.some((t) => t.side === "player")) {
        next = { ...next, counters: { ...next.counters, shieldGainedThisTurn: next.counters.shieldGainedThisTurn + amt } }
      }
      return next
    }
    case "heal": {
      const amt = resolveAmount(op.amount as any, normalized)
      const targets = resolveTargeting()
      let next = normalized
      targets.forEach((t) => {
        next = heal(next, t, amt)
      })
      return next
    }
    case "draw": {
      const skipUids =
        context.cardInstanceId && context.cardDef && cardHasKeyword(context.cardDef, "exhaust")
          ? new Set([context.cardInstanceId])
          : undefined
      return drawCards(normalized, op.amount, { skipUids })
    }
    case "backfire": {
      return addErrorCardsToDeck(normalized, op.amount)
    }
    case "addCardToDeck": {
      const count = op.count ?? 1
      const sourceId = op.cardId === "self" ? context.cardDef?.id : op.cardId
      if (!sourceId) return normalized
      return addCardsToDeck(normalized, sourceId, count, op.shuffle ?? true, {
        temporaryCost: op.temporaryCost,
        fleeting: op.fleeting,
        createdFrom: context.cardDef?.id,
      })
    }
    case "createCardsInHand": {
      return addCardsToHand(normalized, op.cardId, op.count, {
        temporaryCost: op.temporaryCost,
        fleeting: op.fleeting,
        createdFrom: context.cardDef?.id,
      })
    }
    case "convertShieldToHeal": {
      const side = actor
      const shield = side === "player"
        ? normalized.player.shield ?? 0
        : getEnemyAt(normalized, context.actorEnemyIndex ?? 0).shield ?? 0
      const amount = Math.min(shield, op.amount)
      if (amount <= 0) return normalized
      let next = normalized
      if (side === "player") {
        next = { ...next, player: { ...next.player, shield: shield - amount } }
        return heal(next, { side: "player" }, amount)
      }
      const enemyIndex = context.actorEnemyIndex ?? 0
      const enemy = getEnemyAt(next, enemyIndex)
      next = setEnemyAt(next, enemyIndex, { ...enemy, shield: shield - amount })
      return heal(next, { side: "enemy", index: enemyIndex }, amount)
    }
    case "applyElement": {
      const targets = resolveTargeting()
      let next = normalized
      targets.forEach((t) => {
        for (let i = 0; i < op.amount; i++) {
          next = applyElementStack(next, t, op.element)
        }
      })
      return next
    }
    case "dealRandom": {
      const rolls = op.rolls ?? 1
      let total = 0
      for (let i = 0; i < rolls; i++) {
        const r = state.rng()
        total += Math.floor(r * (op.max - op.min + 1)) + op.min
      }
      const targets = resolveTargeting()
      let next = normalized
      targets.forEach((t) => {
        const targetRef = typeof t === "string" ? { side: t } : t
        next = applyDamage(next, targetRef, total)
        next = dispatchTrigger(next, { kind: "DamageDealt", amount: total, target: targetRef.side })
      })
      return next
    }
    case "applyStatus": {
      const targets = resolveTargeting()
      let next = normalized
      targets.forEach((t) => {
        next = addStatusToSide(next, t, op.status)
        // if a status has no triggers, fire its effects immediately upon application
        if (!op.status.triggers || op.status.triggers.length === 0) {
          op.status.effects.forEach((ef) => {
            next = resolveEffect(next, ef, t.side, t.side === "player" ? "enemy" : "player", {
              source: "status",
              status: { ...op.status, remaining: op.status.duration },
              actorEnemyIndex: t.side === "enemy" ? t.index : undefined,
            })
          })
        }
      })
      return next
    }
    case "modifyCost": {
      // cost mods are applied ad-hoc; for now handled via prepared keyword externally
      return state
    }
    case "modifyStat": {
      if (op.stat === "maxHP") {
        if (actor === "player") {
          const nextPlayer = { ...normalized.player, maxHP: normalized.player.maxHP + op.delta, hp: normalized.player.hp + op.delta }
          return { ...normalized, player: nextPlayer }
        }
        const enemyIndex = context.actorEnemyIndex ?? 0
        const enemy = getEnemyAt(normalized, enemyIndex)
        const nextEnemy = { ...enemy, maxHP: enemy.maxHP + op.delta, hp: enemy.hp + op.delta }
        return setEnemyAt(normalized, enemyIndex, nextEnemy)
      }
      return normalized
    }
    case "modifyHandLimit": {
      const nextLimit = Math.max(0, normalized.config.handLimit + op.delta)
      return { ...normalized, config: { ...normalized.config, handLimit: nextLimit } }
    }
    case "modifyEnergyPerTurn": {
      const nextEnergy = Math.max(0, normalized.config.energyPerTurn + op.delta)
      return { ...normalized, config: { ...normalized.config, energyPerTurn: nextEnergy } }
    }
    case "repeatNext": {
      const status: StatusTemplate = {
        id: `repeat_next_${op.targetType}`,
        name: "Repeat Next",
        duration: 1,
        triggers: [{ kind: "CardPlayed" } as CombatTrigger],
        effects: [{ operation: op as EffectOperation } as EffectSpec],
      }
      return addStatusToSide(normalized, actor === "player" ? { side: "player" } : { side: "enemy", index: context.actorEnemyIndex ?? 0 }, status)
    }
    case "skipTurn": {
      const status: StatusTemplate = {
        id: "skip_turn",
        name: "Skip Turn",
        duration: 1,
        triggers: [],
        effects: [],
      }
      return addStatusToSide(normalized, op.side === "player" ? { side: "player" } : { side: "enemy", index: 0 }, status)
    }
    case "noop":
    case "combatEnd": {
      const zones = { ...normalized.zones, hand: [], deck: [], discard: [], exhaust: [...normalized.zones.exhaust, ...normalized.zones.hand, ...normalized.zones.deck, ...normalized.zones.discard] }
      const enemies = (normalized.enemies ?? [normalized.enemy]).map((enemy) => ({ ...enemy, hp: 0 }))
      const next: CombatState = { ...normalized, energy: 0, zones, enemies, enemy: enemies[0] }
      return dispatchTrigger(next, { kind: "CombatEnd" })
    }
    case "moveFromDiscardToDeck": {
      const zones = cloneZones(state.zones)
      let idx = zones.discard.length - 1
      if (idx < 0) return state
      const top = zones.discard[idx]
      // Skip the card currently being played if it's on top of discard
      if (context.cardInstanceId && top?.uid === context.cardInstanceId) {
        idx -= 1
      }
      if (idx < 0) return state
      const targetCard = zones.discard[idx]
      if (!targetCard) return state
      if (op.mode === "copyTop") {
        const copy: CardInstance = { ...targetCard, uid: `${targetCard.cardId}__copy__${state.rng().toString().slice(2)}` }
        zones.deck.unshift(copy)
      } else {
        zones.discard.splice(idx, 1)
        zones.deck.unshift(targetCard)
      }
      return { ...state, zones }
    }
    case "exhaustFromDiscardTop": {
      const zones = cloneZones(state.zones)
      for (let i = 0; i < op.count; i++) {
        const card = zones.discard.pop()
        if (!card) break
        zones.exhaust.push(card)
      }
      return { ...state, zones }
    }
    case "recastDiscardTop": {
      const zones = cloneZones(state.zones)
      const top = zones.discard.pop()
      if (!top) return state
      const def = state.cardLibrary[top.cardId]
      if (!def) return state
      let next = { ...state, zones }
      const resolvedTarget = (() => {
        const desired = op.defaultTarget ?? targetSide
        if (desired === "self") return actor
        if (desired === "enemySingle" || desired === "enemiesAll") return actor === "player" ? "enemy" : "player"
        return desired as "player" | "enemy"
      })()
      def.effects.forEach((ef) => {
        next = resolveEffect(next, ef, actor, resolvedTarget, { source: "card", cardDef: def })
      })
      // place the recast card back on discard to preserve state
      const backZones = cloneZones(next.zones)
      backZones.discard.push(top)
      return { ...next, zones: backZones }
    }
    default:
      return state
  }
}

export const startCombat = (state: CombatState): CombatState => {
  let next = ensureEnemies(state)

  // resolve autocast cards at combat start
  next.autoCastCards
    .filter((c) => c.trigger === "CombatStart")
    .forEach(({ cardId }) => {
      const def = next.cardLibrary[cardId]
      if (!def) return
      def.effects.forEach((effect) => {
        next = resolveEffect(next, effect, "player", "enemy", { source: "autocast", cardDef: def })
      })
    })

  // move innate cards into opening hand before drawing
  const zones = cloneZones(next.zones)
  const innateUids: string[] = []
  zones.deck.forEach((ci) => {
    const def = next.cardLibrary[ci.cardId]
    if (def && cardHasKeyword(def, "innate")) innateUids.push(ci.uid)
  })

  innateUids.forEach((uid) => {
    const idx = zones.deck.findIndex((c) => c.uid === uid)
    if (idx >= 0) {
      const [card] = zones.deck.splice(idx, 1)
      zones.hand.push(card)
    }
  })

  // prepared cards enter hand at combat start if not already drawn
  if (next.preparedCardIds.length > 0) {
    next.preparedCardIds.forEach((cardId) => {
      const alreadyInHand = zones.hand.some((c) => c.cardId === cardId)
      if (alreadyInHand) return
      const deckIndex = zones.deck.findIndex((ci) => ci.cardId === cardId)
      if (deckIndex === -1) return
      const [card] = zones.deck.splice(deckIndex, 1)
      zones.hand.push(card)
    })
  }

  next = { ...next, zones }
  const openingSlots = Math.max(0, next.config.handLimit - next.zones.hand.length)
  next = drawCards(next, openingSlots)

  next = dispatchTrigger(next, { kind: "CombatStart" })

  return next
}

export const startTurn = (state: CombatState): CombatState => {
  const normalized = ensureEnemies(state)
  const enemies = normalized.enemies.map((enemy) => ({ ...enemy, shield: 0 }))
  let next: CombatState = {
    ...normalized,
    turn: normalized.turn + 1,
    energy: normalized.config.energyPerTurn,
    counters: {
      ...normalized.counters,
      cardsPlayedThisTurn: 0,
      attackCardsPlayedThisTurn: 0,
      damageDealtThisTurn: 0,
      damageTicksThisTurn: 0,
      shieldGainedThisTurn: 0,
    },
    player: { ...normalized.player, shield: 0 },
    enemies,
    enemy: enemies[0],
  }

  // autocast on TurnStart
  next.autoCastCards
    .filter((c) => c.trigger === "TurnStart")
    .forEach(({ cardId }) => {
      const def = next.cardLibrary[cardId]
      if (!def) return
      def.effects.forEach((effect) => {
        next = resolveEffect(next, effect, "player", "enemy", { source: "autocast", cardDef: def })
      })
    })

  // elemental per-turn effects
  next = applyElementalTurnStart(next, { side: "player" })
  next.enemies.forEach((_, index) => {
    next = applyElementalTurnStart(next, { side: "enemy", index })
  })

  // cursed cards in hand backfire each turn
  if (next.zones.hand.length > 0) {
    next.zones.hand.forEach((ci) => {
      const def = next.cardLibrary[ci.cardId]
      if (def && cardHasKeyword(def, "cursed")) {
        next = addErrorCardsToDeck(next, 1)
      }
    })
  }

  // draw up to hand limit (Slay the Spire style)
  const drawCount = Math.max(0, next.config.handLimit - next.zones.hand.length)
  if (drawCount > 0) {
    next = drawCards(next, drawCount)
  }

  next = dispatchTrigger(next, { kind: "TurnStart" })
  return next
}

const moveExhaustFromDiscard = (zones: CombatZones, cardLibrary: Record<string, CardDefinition>): CombatZones => {
  const remainingDiscard: CardInstance[] = []
  const exhaustPile = [...zones.exhaust]
  zones.discard.forEach((card) => {
    const def = cardLibrary[card.cardId]
    if (def && cardHasKeyword(def, "exhaust")) {
      exhaustPile.push(card)
    } else {
      remainingDiscard.push(card)
    }
  })
  return { ...zones, discard: remainingDiscard, exhaust: exhaustPile }
}

const moveFleetingFromDiscard = (zones: CombatZones, cardLibrary: Record<string, CardDefinition>): CombatZones => {
  const remainingDiscard: CardInstance[] = []
  const exhaustPile = [...zones.exhaust]
  zones.discard.forEach((card) => {
    const def = cardLibrary[card.cardId]
    const isFleeting = card.fleeting || (def && cardHasKeyword(def, "fleeting"))
    if (isFleeting) {
      exhaustPile.push(card)
    } else {
      remainingDiscard.push(card)
    }
  })
  return { ...zones, discard: remainingDiscard, exhaust: exhaustPile }
}

const discardNonRetained = (state: CombatState): CombatState => {
  const zones = cloneZones(state.zones)
  const keepInHand: CardInstance[] = []
  zones.hand.forEach((card) => {
    const def = state.cardLibrary[card.cardId]
    if (def && cardHasKeyword(def, "retain")) {
      keepInHand.push(card)
    } else {
      zones.discard.push(card)
    }
  })
  zones.hand = keepInHand
  const finalZones = moveExhaustFromDiscard(zones, state.cardLibrary)
  return { ...state, zones: finalZones }
}

const clearExpiredStatuses = (state: CombatState): CombatState => {
  const normalized = ensureEnemies(state)
  const enemies = normalized.enemies.map((enemy) => ({
    ...enemy,
    statuses: reduceStatuses(enemy.statuses),
  }))
  return {
    ...normalized,
    player: { ...normalized.player, statuses: reduceStatuses(normalized.player.statuses) },
    enemies,
    enemy: enemies[0],
  }
}

export const endTurn = (state: CombatState): CombatState => {
  let next = dispatchTrigger(state, { kind: "TurnEnd" })
  next = discardNonRetained(next)
  next = { ...next, zones: moveFleetingFromDiscard(next.zones, next.cardLibrary) }
  next = clearExpiredStatuses(next)
  return { ...next, energy: 0 }
}

const findCardInstance = (zones: CombatZones, uid: string): { zone: ZoneName; card: CardInstance } | null => {
  for (const zone of ["hand", "deck", "discard", "exhaust", "inPlay"] as ZoneName[]) {
    const found = zones[zone].find((c) => c.uid === uid)
    if (found) return { zone, card: found }
  }
  return null
}

export const playCard = (state: CombatState, params: PlayCardParams): PlayResult => {
  const normalized = ensureEnemies(state)
  const located = findCardInstance(normalized.zones, params.cardInstanceId)
  if (!located || located.zone !== "hand") {
    return { state: normalized, ok: false, reason: "Card not in hand" }
  }

  const cardDef = normalized.cardLibrary[located.card.cardId]
  if (!cardDef) return { state: normalized, ok: false, reason: "Unknown card" }

  if (cardHasKeyword(cardDef, "cursed")) {
    return { state: normalized, ok: false, reason: "Cursed" }
  }

  const hasLock = cardDef.tags.some((t) => normalized.tagLocks.includes(t))
  if (hasLock) return { state: normalized, ok: false, reason: "Tag locked" }

  const cost = Math.max(0, located.card.temporaryCost ?? cardDef.cost)
  if (normalized.energy < cost) return { state: normalized, ok: false, reason: "Not enough energy" }

  let next = { ...normalized, energy: normalized.energy - cost }

  // remove from hand
  next = { ...next, zones: moveCard(next.zones, "hand", "discard", located.card.uid) }

  // resolve effects
  const targetSpecifier = params.target
  const targetSide = typeof targetSpecifier === "object" ? targetSpecifier.side : targetSpecifier ?? "enemy"
  cardDef.effects.forEach((effect) => {
    next = resolveEffect(next, effect, "player", targetSide, { source: "card", cardDef, cardInstanceId: located.card.uid }, targetSpecifier)
  })

  next = dispatchTrigger(next, { kind: "CardPlayed", card: cardDef })

  const isAttack = cardDef.type === "attack" || cardDef.type === "DMG"
  const counters: CombatCounters = {
    ...next.counters,
    cardsPlayedThisTurn: next.counters.cardsPlayedThisTurn + 1,
    cardsPlayedThisCombat: next.counters.cardsPlayedThisCombat + 1,
    attackCardsPlayedThisTurn:
      isAttack ? next.counters.attackCardsPlayedThisTurn + 1 : next.counters.attackCardsPlayedThisTurn,
    attackCardsPlayedThisCombat:
      isAttack ? next.counters.attackCardsPlayedThisCombat + 1 : next.counters.attackCardsPlayedThisCombat,
  }
  next = { ...next, counters }

  // exhaust or persist handling
  if (cardHasKeyword(cardDef, "exhaust")) {
    next = { ...next, zones: moveCard(next.zones, "discard", "exhaust", located.card.uid) }
  } else if (cardDef.persistent) {
    next = { ...next, zones: moveCard(next.zones, "discard", "inPlay", located.card.uid) }
  }

  return { state: next, ok: true }
}

export const enemyPing = (state: CombatState, amount = 1): CombatState => {
  const next = applyDamage(ensureEnemies(state), { side: "player" }, amount)
  return dispatchTrigger(next, { kind: "DamageTaken", amount, target: "player" })
}

export const applyEnemyCard = (state: CombatState, cardId: string): CombatState => {
  const def = state.cardLibrary[cardId]
  if (!def) return state
  let next = ensureEnemies(state)
  def.effects.forEach((effect) => {
    next = resolveEffect(next, effect, "enemy", "player", { source: "card", cardDef: def, actorEnemyIndex: 0 })
  })
  next = dispatchTrigger(next, { kind: "CardPlayed", card: def })
  return next
}
