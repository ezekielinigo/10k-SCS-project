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
  StatusInstance,
  StatusStacking,
  StatusTemplate,
  ZoneName,
} from "./combatTypes"
import type { SkillBlock } from "../types"

export type CreateCombatParams = {
  player: { hp: number; maxHP: number; skills: SkillBlock }
  enemy: { hp: number; maxHP: number; skills?: SkillBlock }
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

const updateElements = (state: CombatState, side: "player" | "enemy", updater: (current: CombatantState["elements"]) => CombatantState["elements"]): CombatState => {
  const elements = updater(state[side].elements)
  if (side === "player") return { ...state, player: { ...state.player, elements } }
  return { ...state, enemy: { ...state.enemy, elements } }
}

const applyCorruptedEffect = (state: CombatState, side: "player" | "enemy"): CombatState => {
  if (side !== "player") return state
  let next = drawCards(state, 1)
  next = addErrorCardsToDeck(next, 1)
  return next
}

const applyElementStack = (state: CombatState, side: "player" | "enemy", element: "FIRE" | "PHYS" | "HACK" | "ELDR"): CombatState => {
  const elements = { ...state[side].elements }

  const applyStun = (current: CombatState) =>
    addStatusToSide(current, side, {
      id: "stun",
      name: "Stunned",
      description: "Skip next turn.",
      duration: 1,
      stacking: "refresh",
      triggers: [{ kind: "TurnStart" }],
      effects: [{ operation: { op: "skipTurn", side } }],
    })

  const applyMania = (current: CombatState) =>
    addStatusToSide(current, side, {
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
      return updateElements(state, side, () => elements)
    }
    if (elements.phys > 0) {
      elements.phys = Math.max(0, elements.phys - 1)
      let next = updateElements(state, side, () => elements)
      next = applyDamage(next, side, 20)
      return next
    }
    if (elements.hack > 0) {
      elements.hack = Math.max(0, elements.hack - 1)
      return updateElements(state, side, () => elements)
    }
    elements.fire = clampStack(elements.fire + 1)
    return updateElements(state, side, () => elements)
  }

  if (element === "PHYS") {
    if (elements.eldr > 0) {
      if (elements.phys + 1 >= 3) {
        elements.phys = Math.max(0, elements.phys - 2)
        elements.eldr = Math.max(0, elements.eldr - 1)
        let next = updateElements(state, side, () => elements)
        return applyStun(next)
      }
      elements.eldr = Math.max(0, elements.eldr - 1)
      let next = updateElements(state, side, () => elements)
      return applyCorruptedEffect(next, side)
    }
    if (elements.fire > 0) {
      elements.fire = Math.max(0, elements.fire - 1)
      let next = updateElements(state, side, () => elements)
      next = applyDamage(next, side, 20)
      return next
    }
    if (elements.hack > 0) {
      elements.hack = Math.max(0, elements.hack - 1)
      let next = updateElements(state, side, () => elements)
      return addStatusToSide(next, side, {
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
    return updateElements(state, side, () => elements)
  }

  if (element === "HACK") {
    if (elements.eldr > 0) {
      if (elements.hack + 1 >= 3) {
        elements.hack = Math.max(0, elements.hack - 2)
        elements.eldr = Math.max(0, elements.eldr - 1)
        let next = updateElements(state, side, () => elements)
        return applyMania(next)
      }
      elements.eldr = Math.max(0, elements.eldr - 1)
      let next = updateElements(state, side, () => elements)
      return applyCorruptedEffect(next, side)
    }
    if (elements.fire > 0) {
      elements.fire = Math.max(0, elements.fire - 1)
      return updateElements(state, side, () => elements)
    }
    if (elements.phys > 0) {
      elements.phys = Math.max(0, elements.phys - 1)
      let next = updateElements(state, side, () => elements)
      return addStatusToSide(next, side, {
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
    return updateElements(state, side, () => elements)
  }

  if (element === "ELDR") {
    if (elements.fire > 0) {
      elements.blueFire += elements.fire
      elements.fire = 0
      return updateElements(state, side, () => elements)
    }
    if (elements.phys > 0) {
      if (elements.phys >= 3) {
        elements.phys = Math.max(0, elements.phys - 3)
        let next = updateElements(state, side, () => elements)
        return applyStun(next)
      }
      elements.phys = Math.max(0, elements.phys - 1)
      let next = updateElements(state, side, () => elements)
      return applyCorruptedEffect(next, side)
    }
    if (elements.hack > 0) {
      if (elements.hack >= 3) {
        elements.hack = Math.max(0, elements.hack - 3)
        let next = updateElements(state, side, () => elements)
        return applyMania(next)
      }
      elements.hack = Math.max(0, elements.hack - 1)
      let next = updateElements(state, side, () => elements)
      return applyCorruptedEffect(next, side)
    }
    elements.eldr = clampStack(elements.eldr + 1)
    return updateElements(state, side, () => elements)
  }

  return state
}

const applyElementalTurnStart = (state: CombatState, side: "player" | "enemy"): CombatState => {
  let next = state
  const elements = { ...next[side].elements }

  if (elements.fire > 0) {
    elements.fire = Math.max(0, elements.fire - 1)
    next = updateElements(next, side, () => elements)
    next = applyDamage(next, side, 10)
  }

  if (elements.blueFire > 0) {
    elements.blueFire = Math.max(0, elements.blueFire - 1)
    next = updateElements(next, side, () => elements)
    next = applyDirectDamage(next, side, 20)
  }

  if (elements.phys > 0) {
    elements.phys = Math.max(0, elements.phys - 1)
    next = updateElements(next, side, () => elements)
    next = addStatusToSide(next, side, {
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
    next = updateElements(next, side, () => elements)
    next = addStatusToSide(next, side, {
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
    next = updateElements(next, side, () => elements)
    next = applyCorruptedEffect(next, side)
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

export const createCombatState = ({ player, enemy, deckCardIds, cardLibrary, rngSeed, config, tagLocks }: CreateCombatParams): CombatState => {
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

  return {
    turn: 0,
    activeSide: "player",
    energy: 0,
    config: { ...defaultConfig, ...config },
    counters: defaultCounters(),
    rngSeed,
    rng,
    playerSkills: player.skills,
    enemySkills: enemy.skills,
    preparedCardIds: prepared,
    autoCastCards: autoCast,
    zones,
    player: baseCombatant(player.hp, player.maxHP),
    enemy: baseCombatant(enemy.hp, enemy.maxHP),
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
      return state.playerSkills[cond.key] >= cond.value
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
  if (ref.type === "stat") return state.playerSkills[ref.key as keyof SkillBlock] ?? 0
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
    const shield = state[side].shield ?? 0
    const divisor = ref.divisor ?? 1
    return divisor > 1 ? Math.floor(shield / divisor) * divisor : shield
  }
  return 0
}

const applyDamage = (state: CombatState, target: "player" | "enemy", amount: number): CombatState => {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max))
  if (amount <= 0) return state

  const applyDirect = (current: CombatState, side: "player" | "enemy", raw: number): CombatState => {
    if (raw <= 0) return current
    if (side === "player") {
      const hp = clamp(current.player.hp - raw, current.player.maxHP)
      return { ...current, player: { ...current.player, hp } }
    }
    const hp = clamp(current.enemy.hp - raw, current.enemy.maxHP)
    const counters = {
      ...current.counters,
      damageDealtThisTurn: current.counters.damageDealtThisTurn + raw,
      damageDealtThisCombat: current.counters.damageDealtThisCombat + raw,
      damageTicksThisTurn: current.counters.damageTicksThisTurn + 1,
    }
    return { ...current, enemy: { ...current.enemy, hp }, counters }
  }

  const side = target
  const statusIds = new Set(state[side].statuses.map((s) => s.id))
  let next = state

  if (statusIds.has("jam_next")) {
    next = removeStatusById(next, side, "jam_next")
    return next
  }

  let incoming = amount
  if (statusIds.has("shorted_next")) {
    incoming = Math.floor(incoming * 0.75)
    next = removeStatusById(next, side, "shorted_next")
  }

  let shield = next[side].shield ?? 0
  if (shield > 0) {
    const ignoreShield = statusIds.has("vulnerable_next") ? 0.5 : 0
    if (statusIds.has("vulnerable_next")) {
      next = removeStatusById(next, side, "vulnerable_next")
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

  const hp = clamp(next.enemy.hp - incoming, next.enemy.maxHP)
  const counters = {
    ...next.counters,
    damageDealtThisTurn: next.counters.damageDealtThisTurn + incoming,
    damageDealtThisCombat: next.counters.damageDealtThisCombat + incoming,
    damageTicksThisTurn: next.counters.damageTicksThisTurn + (incoming > 0 ? 1 : 0),
  }
  return { ...next, enemy: { ...next.enemy, hp, shield }, counters }
}

const applyDirectDamage = (state: CombatState, target: "player" | "enemy", amount: number): CombatState => {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max))
  if (amount <= 0) return state
  if (target === "player") {
    const hp = clamp(state.player.hp - amount, state.player.maxHP)
    return { ...state, player: { ...state.player, hp } }
  }
  const hp = clamp(state.enemy.hp - amount, state.enemy.maxHP)
  const counters = {
    ...state.counters,
    damageDealtThisTurn: state.counters.damageDealtThisTurn + amount,
    damageDealtThisCombat: state.counters.damageDealtThisCombat + amount,
    damageTicksThisTurn: state.counters.damageTicksThisTurn + (amount > 0 ? 1 : 0),
  }
  return { ...state, enemy: { ...state.enemy, hp }, counters }
}

const heal = (state: CombatState, target: "player" | "enemy", amount: number): CombatState => {
  if (amount <= 0) return state
  if (target === "player") {
    const hp = Math.min(state.player.maxHP, state.player.hp + amount)
    return { ...state, player: { ...state.player, hp } }
  }
  const hp = Math.min(state.enemy.maxHP, state.enemy.hp + amount)
  return { ...state, enemy: { ...state.enemy, hp } }
}

const addStatusToSide = (state: CombatState, side: "player" | "enemy", status: StatusTemplate): CombatState => {
  if (side === "player") {
    return { ...state, player: { ...state.player, statuses: applyStatus(state.player.statuses, status) } }
  }
  return { ...state, enemy: { ...state.enemy, statuses: applyStatus(state.enemy.statuses, status) } }
}

const topDiscard = (zones: CombatZones): CardInstance | null => {
  if (zones.discard.length === 0) return null
  return zones.discard[zones.discard.length - 1]
}

const removeStatusById = (state: CombatState, side: "player" | "enemy", statusId: string): CombatState => {
  if (side === "player") {
    return { ...state, player: { ...state.player, statuses: state.player.statuses.filter((s) => s.id !== statusId) } }
  }
  return { ...state, enemy: { ...state.enemy, statuses: state.enemy.statuses.filter((s) => s.id !== statusId) } }
}

const dispatchTrigger = (state: CombatState, trigger: CombatTrigger): CombatState => {
  const runStatusEffects = (statuses: StatusInstance[], side: "player" | "enemy", current: CombatState): CombatState => {
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
              next = resolveEffect(next, ef, side, side === "player" ? "enemy" : "player", { source: "status", trigger, status })
            })
            next = removeStatusById(next, side, status.id)
          }
        } else {
          next = resolveEffect(next, effect, side, side === "player" ? "enemy" : "player", { source: "status", trigger, status })
        }
      })
    })
    return next
  }

  let nextState = runStatusEffects(state.player.statuses, "player", state)
  nextState = runStatusEffects(nextState.enemy.statuses, "enemy", nextState)
  return nextState
}

type ResolveContext = {
  source: "card" | "status" | "autocast"
  cardDef?: CardDefinition
  trigger?: CombatTrigger
  status?: StatusInstance
  cardInstanceId?: string
}

const resolveEffect = (
  state: CombatState,
  effect: EffectSpec,
  actor: "player" | "enemy",
  targetSide: "player" | "enemy" = actor === "player" ? "enemy" : "player",
  context: ResolveContext,
): CombatState => {
  if (!testCondition(effect.condition, state)) return state

  const op = effect.operation

  const resolveTargeting = (): ("player" | "enemy")[] => {
    const target = effect.target ?? targetSide
    if (target === "self") return [actor]
    if (target === "enemySingle") return [actor === "player" ? "enemy" : "player"]
    if (target === "enemiesAll") return [actor === "player" ? "enemy" : "player"]
    return [targetSide]
  }

  switch (op.op) {
    case "dealDamage": {
      const amt = resolveAmount(op.amount as any, state)
      const targets = resolveTargeting()
      let next = state
      targets.forEach((t) => {
        next = applyDamage(next, t, amt)
        next = dispatchTrigger(next, { kind: "DamageDealt", amount: amt, target: t })
      })
      if (context.source === "card") {
        next = dispatchTrigger(next, { kind: "DamageTaken", amount: amt, target: targets[0] })
      }
      return next
    }
    case "gainShield": {
      const amt = resolveAmount(op.amount as any, state)
      const targets = resolveTargeting()
      let next = state
      targets.forEach((t) => {
        if (t === "player") next = { ...next, player: { ...next.player, shield: (next.player.shield ?? 0) + amt } }
        else next = { ...next, enemy: { ...next.enemy, shield: (next.enemy.shield ?? 0) + amt } }
      })
      if (amt > 0 && targets.includes("player")) {
        next = { ...next, counters: { ...next.counters, shieldGainedThisTurn: next.counters.shieldGainedThisTurn + amt } }
      }
      return next
    }
    case "heal": {
      const amt = resolveAmount(op.amount as any, state)
      const targets = resolveTargeting()
      let next = state
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
      return drawCards(state, op.amount, { skipUids })
    }
    case "backfire": {
      return addErrorCardsToDeck(state, op.amount)
    }
    case "addCardToDeck": {
      const count = op.count ?? 1
      const sourceId = op.cardId === "self" ? context.cardDef?.id : op.cardId
      if (!sourceId) return state
      return addCardsToDeck(state, sourceId, count, op.shuffle ?? true, {
        temporaryCost: op.temporaryCost,
        fleeting: op.fleeting,
        createdFrom: context.cardDef?.id,
      })
    }
    case "createCardsInHand": {
      return addCardsToHand(state, op.cardId, op.count, {
        temporaryCost: op.temporaryCost,
        fleeting: op.fleeting,
        createdFrom: context.cardDef?.id,
      })
    }
    case "convertShieldToHeal": {
      const side = actor
      const shield = state[side].shield ?? 0
      const amount = Math.min(shield, op.amount)
      if (amount <= 0) return state
      let next = state
      if (side === "player") {
        next = { ...next, player: { ...next.player, shield: shield - amount } }
      } else {
        next = { ...next, enemy: { ...next.enemy, shield: shield - amount } }
      }
      return heal(next, side, amount)
    }
    case "applyElement": {
      const targets = resolveTargeting()
      let next = state
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
      const targets = effect.target ? resolveTargeting() : [targetSide]
      let next = state
      targets.forEach((t) => {
        next = applyDamage(next, t, total)
        next = dispatchTrigger(next, { kind: "DamageDealt", amount: total, target: t })
      })
      return next
    }
    case "applyStatus": {
      const targets = resolveTargeting()
      let next = state
      targets.forEach((t) => {
        next = addStatusToSide(next, t, op.status)
        // if a status has no triggers, fire its effects immediately upon application
        if (!op.status.triggers || op.status.triggers.length === 0) {
          op.status.effects.forEach((ef) => {
            next = resolveEffect(next, ef, t, t === "player" ? "enemy" : "player", {
              source: "status",
              status: { ...op.status, remaining: op.status.duration },
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
          const nextPlayer = { ...state.player, maxHP: state.player.maxHP + op.delta, hp: state.player.hp + op.delta }
          return { ...state, player: nextPlayer }
        }
        const nextEnemy = { ...state.enemy, maxHP: state.enemy.maxHP + op.delta, hp: state.enemy.hp + op.delta }
        return { ...state, enemy: nextEnemy }
      }
      return state
    }
    case "modifyHandLimit": {
      const nextLimit = Math.max(0, state.config.handLimit + op.delta)
      return { ...state, config: { ...state.config, handLimit: nextLimit } }
    }
    case "modifyEnergyPerTurn": {
      const nextEnergy = Math.max(0, state.config.energyPerTurn + op.delta)
      return { ...state, config: { ...state.config, energyPerTurn: nextEnergy } }
    }
    case "repeatNext": {
      const status: StatusTemplate = {
        id: `repeat_next_${op.targetType}`,
        name: "Repeat Next",
        duration: 1,
        triggers: [{ kind: "CardPlayed" } as CombatTrigger],
        effects: [{ operation: op as EffectOperation } as EffectSpec],
      }
      return addStatusToSide(state, actor, status)
    }
    case "skipTurn": {
      const status: StatusTemplate = {
        id: "skip_turn",
        name: "Skip Turn",
        duration: 1,
        triggers: [],
        effects: [],
      }
      return addStatusToSide(state, op.side, status)
    }
    case "noop":
    case "combatEnd": {
      const zones = { ...state.zones, hand: [], deck: [], discard: [], exhaust: [...state.zones.exhaust, ...state.zones.hand, ...state.zones.deck, ...state.zones.discard] }
      const next: CombatState = { ...state, energy: 0, zones, enemy: { ...state.enemy, hp: 0 } }
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
  let next = { ...state }

  // resolve autocast cards at combat start
  state.autoCastCards
    .filter((c) => c.trigger === "CombatStart")
    .forEach(({ cardId }) => {
      const def = state.cardLibrary[cardId]
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
  let next: CombatState = {
    ...state,
    turn: state.turn + 1,
    energy: state.config.energyPerTurn,
    counters: {
      ...state.counters,
      cardsPlayedThisTurn: 0,
      attackCardsPlayedThisTurn: 0,
      damageDealtThisTurn: 0,
      damageTicksThisTurn: 0,
      shieldGainedThisTurn: 0,
    },
    player: { ...state.player, shield: 0 },
    enemy: { ...state.enemy, shield: 0 },
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
  next = applyElementalTurnStart(next, "player")
  next = applyElementalTurnStart(next, "enemy")

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

const clearExpiredStatuses = (state: CombatState): CombatState => ({
  ...state,
  player: { ...state.player, statuses: reduceStatuses(state.player.statuses) },
  enemy: { ...state.enemy, statuses: reduceStatuses(state.enemy.statuses) },
})

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
  const located = findCardInstance(state.zones, params.cardInstanceId)
  if (!located || located.zone !== "hand") {
    return { state, ok: false, reason: "Card not in hand" }
  }

  const cardDef = state.cardLibrary[located.card.cardId]
  if (!cardDef) return { state, ok: false, reason: "Unknown card" }

  if (cardHasKeyword(cardDef, "cursed")) {
    return { state, ok: false, reason: "Cursed" }
  }

  const hasLock = cardDef.tags.some((t) => state.tagLocks.includes(t))
  if (hasLock) return { state, ok: false, reason: "Tag locked" }

  const cost = Math.max(0, located.card.temporaryCost ?? cardDef.cost)
  if (state.energy < cost) return { state, ok: false, reason: "Not enough energy" }

  let next = { ...state, energy: state.energy - cost }

  // remove from hand
  next = { ...next, zones: moveCard(next.zones, "hand", "discard", located.card.uid) }

  // resolve effects
  cardDef.effects.forEach((effect) => {
    next = resolveEffect(next, effect, "player", params.target ?? "enemy", { source: "card", cardDef, cardInstanceId: located.card.uid })
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
  const next = applyDamage(state, "player", amount)
  return dispatchTrigger(next, { kind: "DamageTaken", amount, target: "player" })
}

export const applyEnemyCard = (state: CombatState, cardId: string): CombatState => {
  const def = state.cardLibrary[cardId]
  if (!def) return state
  let next = state
  def.effects.forEach((effect) => {
    next = resolveEffect(next, effect, "enemy", "player", { source: "card", cardDef: def })
  })
  next = dispatchTrigger(next, { kind: "CardPlayed", card: def })
  return next
}
