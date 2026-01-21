import type { CardDefinition, StatusTemplate } from "../engine/combatTypes"

/***

implemented cards

Field Uplink				Heal 5, +5 max HP at combat start
Flash Focus					Prepared: draw 1, exhaust
Data Loop					Power: draw 1 at turn start
Echo Setup					Next attack this turn is repeated
INT Overload				Deal damage = INT
Stash						Gain: draw 1 next turn
Survey Weakness				Deal 1 damage per attack card in hand
Flurry Recall				Deal damage = attacks played this turn
Attrition Count				Deal damage = attacks played this combat
Static Net					All enemies skip next turn
Blood Tax					Take 1 damage at start of next 5 turns
Smash and Bleed				Deal 10 damage, -10 HP
Last Stand					Deal 8 damage, if HP < 50% deal another 8
Wild Barrage				Deal 1d20 damage, 1d20 times
Tighten Focus				Hand size -1, energy per turn +1 for combat
Last Resort Trigger			Win battle, item breaks
Recall Echo					Recast top card of discard pile
Archive Pull				Put a copy of a card from your discard into your deck
Purge Surge					Exhaust 3 cards from top of discard pile, +3 max energy



*****/

const STATUS_TURN_DRAW: StatusTemplate = {
  id: "power_turn_draw",
  name: "Data Loop",
  description: "Draw 1 card at the start of each turn.",
  duration: "combat",
  stacking: "refresh",
  triggers: [{ kind: "TurnStart" }],
  effects: [{ operation: { op: "draw", amount: 1 } }],
}

const STATUS_REPEAT_NEXT_ATTACK: StatusTemplate = {
  id: "repeat_next_attack",
  name: "Echo Strike",
  description: "Your next attack card is repeated once.",
  duration: 1,
  stacking: "stack",
  triggers: [{ kind: "CardPlayed" }],
  effects: [{ operation: { op: "repeatNext", targetType: "attack" } }],
}

const STATUS_DRAW_NEXT_TURN: StatusTemplate = {
  id: "draw_next_turn",
  name: "Plan Ahead",
  description: "Draw 1 card at the start of next turn.",
  duration: 1,
  stacking: "stack",
  triggers: [{ kind: "TurnStart" }],
  effects: [{ operation: { op: "draw", amount: 1 } }],
}

const STATUS_SKIP_NEXT_TURN: StatusTemplate = {
  id: "skip_next_turn",
  name: "Lockdown",
  description: "Skip your next turn.",
  duration: 1,
  stacking: "stack",
  triggers: [{ kind: "TurnStart" }],
  effects: [{ operation: { op: "skipTurn", side: "enemy" } }],
}

const STATUS_HAND_SIZE_MINUS_ONE: StatusTemplate = {
  id: "hand_size_minus_one",
  name: "Tight Grip",
  description: "Hand size reduced by 1.",
  duration: "combat",
  stacking: "stack",
  triggers: [],
  effects: [{ operation: { op: "modifyHandLimit", delta: -1 } }],
}

const STATUS_ENERGY_PLUS_ONE: StatusTemplate = {
  id: "energy_plus_one",
  name: "Overcharge",
  description: "Gain +1 energy per turn.",
  duration: "combat",
  stacking: "stack",
  triggers: [],
  effects: [{ operation: { op: "modifyEnergyPerTurn", delta: 1 } }],
}

const CARDS: CardDefinition[] = [
  {
    id: "combat_start_boost",
    name: "Field Uplink",
    type: "utility",
    rarity: "uncommon",
    cost: 0,
    tags: ["INT"],
    description: "Auto-cast: increase max HP by 5 and heal 5 at combat start.",
    keywords: [{ kind: "autoCast", trigger: "CombatStart" }],
    effects: [
      { operation: { op: "modifyStat", stat: "maxHP", delta: 5 } },
      { operation: { op: "heal", amount: 5 }, target: "self" },
    ],
  },
  {
    id: "flash_focus",
    name: "Flash Focus",
    type: "utility",
    rarity: "common",
    cost: 0,
    tags: ["INT"],
    description: "Prepared: enters hand at turn start with 0 cost. Draw 1. Exhaust.",
    keywords: [{ kind: "prepared" }, { kind: "exhaust" }],
    effects: [{ operation: { op: "draw", amount: 1 } }],
  },
  {
    id: "data_loop",
    name: "Data Loop",
    type: "utility",
    rarity: "rare",
    cost: 1,
    tags: ["INT"],
    description: "Power: stays in play and draws 1 card at each turn start.",
    keywords: [{ kind: "retain" }],
    persistent: true,
    effects: [{ target: "self", operation: { op: "applyStatus", status: STATUS_TURN_DRAW } }],
  },
  {
    id: "echo_strike_setup",
    name: "Echo Setup",
    type: "utility",
    rarity: "uncommon",
    cost: 1,
    tags: ["REF"],
    description: "Your next attack this turn is repeated. Exhaust.",
    keywords: [{ kind: "exhaust" }],
    effects: [{ operation: { op: "applyStatus", status: STATUS_REPEAT_NEXT_ATTACK }, target: "self" }],
  },
  {
    id: "int_overload",
    name: "Overload",
    type: "attack",
    rarity: "common",
    cost: 1,
    tags: ["INT"],
    description: "Deal damage equal to INT.",
    effects: [{ operation: { op: "dealDamage", amount: { type: "stat", key: "int" } }, target: "enemySingle" }],
  },
  {
    id: "next_turn_draw",
    name: "Stash",
    type: "utility",
    rarity: "common",
    cost: 0,
    tags: ["INT"],
    description: "Gain: Draw 1 at the start of next turn.",
    effects: [{ operation: { op: "applyStatus", status: STATUS_DRAW_NEXT_TURN }, target: "self" }],
  },
  {
    id: "hand_count_attack",
    name: "Survey Weakness",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    tags: ["REF"],
    description: "Deal 1 damage per attack card in hand.",
    effects: [{ operation: { op: "dealDamage", amount: { type: "handCountByType", cardType: "attack" } }, target: "enemySingle" }],
  },
  {
    id: "attack_count_turn",
    name: "Flurry Recall",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    tags: ["REF"],
    description: "Deal damage equal to attacks played this turn.",
    effects: [{ operation: { op: "dealDamage", amount: { type: "counter", key: "attackCardsPlayedThisTurn" } }, target: "enemySingle" }],
  },
  {
    id: "attack_count_combat",
    name: "Attrition Count",
    type: "attack",
    rarity: "rare",
    cost: 2,
    tags: ["STR"],
    description: "Deal damage equal to attacks played this combat.",
    effects: [{ operation: { op: "dealDamage", amount: { type: "counter", key: "attackCardsPlayedThisCombat" } }, target: "enemySingle" }],
  },
  {
    id: "skip_all_enemies",
    name: "Static Net",
    type: "utility",
    rarity: "rare",
    cost: 2,
    tags: ["INT"],
    description: "All enemies skip their next turn.",
    effects: [{ operation: { op: "applyStatus", status: STATUS_SKIP_NEXT_TURN }, target: "enemiesAll" }],
  },
  {
    id: "dot_self",
    name: "Blood Tax",
    type: "utility",
    rarity: "common",
    cost: 0,
    tags: ["STR"],
    description: "Enemy takes 1 damage at the start of their next 5 turns.",
    effects: [
      {
        operation: {
          op: "applyStatus",
          status: {
            id: "blood_tax",
            name: "Blood Tax",
            description: "Lose 1 HP at turn start.",
            duration: 5,
            stacking: "stack",
            triggers: [{ kind: "TurnStart" }],
            effects: [{ operation: { op: "dealDamage", amount: 1 }, target: "self" }],
          },
        },
        target: "enemySingle",
      },
    ],
  },
  {
    id: "smash_and_bleed",
    name: "Smash and Bleed",
    type: "attack",
    rarity: "common",
    cost: 1,
    tags: ["STR"],
    description: "Deal 10 damage. Lose 10 HP.",
    effects: [
      { operation: { op: "dealDamage", amount: 10 }, target: "enemySingle" },
      { operation: { op: "dealDamage", amount: 10 }, target: "self" },
    ],
  },
  {
    id: "under_50_double",
    name: "Last Stand",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    tags: ["STR"],
    description: "Deal 8 damage. If HP < 50%, deal another 8.",
    effects: [
      { operation: { op: "dealDamage", amount: 8 }, target: "enemySingle" },
      { operation: { op: "dealDamage", amount: 8 }, target: "enemySingle", condition: { type: "hpBelowPct", side: "player", pct: 0.5 } },
    ],
  },
  {
    id: "wild_barrage",
    name: "Wild Barrage",
    type: "attack",
    rarity: "rare",
    cost: 2,
    tags: ["REF"],
    description: "Deal 1d20 damage, 1d20 times (uses combat RNG).",
    effects: [{ operation: { op: "dealRandom", min: 1, max: 20, rolls: 20 }, target: "enemySingle" }],
  },
  {
    id: "tighten_focus",
    name: "Tighten Focus",
    type: "utility",
    rarity: "rare",
    cost: 1,
    tags: ["INT"],
    description: "Hand size -1, energy per turn +1 for combat.",
    effects: [
      { operation: { op: "applyStatus", status: STATUS_HAND_SIZE_MINUS_ONE }, target: "self" },
      { operation: { op: "applyStatus", status: STATUS_ENERGY_PLUS_ONE }, target: "self" },
    ],
  },
  {
    id: "breaker_victory",
    name: "Last Resort Trigger",
    type: "unique",
    rarity: "unique",
    cost: 0,
    tags: ["STR"],
    description: "Immediately win this battle. (The source item would break after use.)",
    effects: [
      { operation: { op: "combatEnd" } },
    ],
  },
  {
    id: "recast_top_discard",
    name: "Recall Echo",
    type: "utility",
    rarity: "rare",
    cost: 1,
    tags: ["INT"],
    description: "Recast the top card of your discard pile.",
    effects: [{ operation: { op: "recastDiscardTop", defaultTarget: "enemySingle" } }],
  },
  {
    id: "copy_discard_to_deck",
    name: "Archive Pull",
    type: "utility",
    rarity: "uncommon",
    cost: 1,
    tags: ["INT"],
    description: "Copy the top card of your discard into your deck (top).",
    effects: [{ operation: { op: "moveFromDiscardToDeck", mode: "copyTop" } }],
  },
  {
    id: "exhaust_three_energy",
    name: "Purge Surge",
    type: "utility",
    rarity: "rare",
    cost: 1,
    tags: ["INT"],
    description: "Exhaust top 3 of discard. Gain +3 energy per turn this combat.",
    effects: [
      { operation: { op: "exhaustFromDiscardTop", count: 3 } },
      { operation: { op: "applyStatus", status: { ...STATUS_ENERGY_PLUS_ONE, id: "energy_plus_three", name: "Surge", effects: [{ operation: { op: "modifyEnergyPerTurn", delta: 3 } }] } }, target: "self" },
    ],
  },
  {
    id: "next_turn_draw",
    name: "Stash",
    type: "utility",
    rarity: "common",
    cost: 0,
    tags: ["INT"],
    description: "Gain: Draw 1 at the start of next turn.",
    effects: [{ operation: { op: "applyStatus", status: STATUS_DRAW_NEXT_TURN }, target: "self" }],
  },
  {
    id: "hand_count_attack",
    name: "Survey Weakness",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    tags: ["REF"],
    description: "Deal 1 damage per attack card in hand.",
    effects: [{ operation: { op: "dealDamage", amount: { type: "handCountByType", cardType: "attack" } }, target: "enemySingle" }],
  },
  {
    id: "attack_count_turn",
    name: "Flurry Recall",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    tags: ["REF"],
    description: "Deal damage equal to attacks played this turn.",
    effects: [{ operation: { op: "dealDamage", amount: { type: "counter", key: "attackCardsPlayedThisTurn" } }, target: "enemySingle" }],
  },
  {
    id: "attack_count_combat",
    name: "Attrition Count",
    type: "attack",
    rarity: "rare",
    cost: 2,
    tags: ["STR"],
    description: "Deal damage equal to attacks played this combat.",
    effects: [{ operation: { op: "dealDamage", amount: { type: "counter", key: "attackCardsPlayedThisCombat" } }, target: "enemySingle" }],
  },
  {
    id: "skip_all_enemies",
    name: "Static Net",
    type: "utility",
    rarity: "rare",
    cost: 2,
    tags: ["INT"],
    description: "All enemies skip their next turn.",
    effects: [{ operation: { op: "applyStatus", status: STATUS_SKIP_NEXT_TURN }, target: "enemiesAll" }],
  },
  {
    id: "dot_self",
    name: "Blood Tax",
    type: "utility",
    rarity: "common",
    cost: 0,
    tags: ["STR"],
    description: "Take 1 damage at the start of your next 5 turns.",
    effects: [
      {
        operation: {
          op: "applyStatus",
          status: {
            id: "blood_tax",
            name: "Blood Tax",
            description: "Lose 1 HP at turn start.",
            duration: 5,
            stacking: "stack",
            triggers: [{ kind: "TurnStart" }],
            effects: [{ operation: { op: "dealDamage", amount: 1 }, target: "self" }],
          },
        },
        target: "self",
      },
    ],
  },
]

export default CARDS
export { STATUS_TURN_DRAW, STATUS_REPEAT_NEXT_ATTACK }
