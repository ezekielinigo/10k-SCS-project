import type { CardDefinition, StatusTemplate } from "../engine/combatTypes"

/* RULESET (DO NOT DELETE)

- Exhaust: When this card is played, put in exhaust pile. (cannot be reused)
	- ex: "Deal 5 DMG. Exhaust."
- Fleeting: On turn end, if this card is still in discard pile, Exhaust.
	- Deal 5 DMG. Fleeting.
- Prepared: If not on hand on combat start, draw the card from deck
	- Deal 5 DMG. Prepared.
- Backfire(X): shuffle X error cards in draw pile.
- Cursed: This card is unplayable
	- Each turn in hand, Backfire 1. Cursed.
- Delay(X): This effect triggers after X turns
	- Deal 5 DMG. Delay (1): Apply 4 burn.

*/

/*

BUGS TO FIX:

- animations should not play if the cards cannot be played (ex: not enough energy)
- I also want animations to be 2x faster than they are now
- the moving card animation should be based on the actual position of the card in hand
  - instead of "creating an instance" of the card to be used solely for animation, use the actual card themselves.

*/

const STATUS_SMOKE_SCREEN: StatusTemplate = {
  id: "smoke_screen_next",
  name: "Smoke Screen",
  description: "Gain 10 DEF at start of next turn.",
  duration: 1,
  stacking: "refresh",
  triggers: [{ kind: "TurnStart" }],
  effects: [{ operation: { op: "gainShield", amount: 10 }, target: "self" }],
}

const STATUS_COUNTER_TURN_END: StatusTemplate = {
  id: "counter_turn_end",
  name: "Counter",
  description: "Deal damage based on remaining DEF at turn end.",
  duration: 1,
  stacking: "refresh",
  triggers: [{ kind: "TurnEnd" }],
  effects: [
    { operation: { op: "dealDamage", amount: { type: "shield", side: "player", divisor: 10 } }, target: "enemySingle" },
    { operation: { op: "backfire", amount: 5 }, condition: { type: "shieldAtLeast", side: "player", value: 50 } },
  ],
}

const CARDS: CardDefinition[] = [

  {
    id: "reboot",
    name: "Reboot",
    type: "ERR",
    rarity: "common",
    cost: 1,
    tags: [],
    description: "Exhaust.",
    keywords: [{ kind: "exhaust" }],
    effects: [],
  },
  {
    id: "aimed_shot",
    name: "Aimed Shot",
    type: "DMG",
    rarity: "uncommon",
    cost: 3,
    tags: [],
    description: "Deal 40 DMG. If you gained DEF this turn, Backfire 3.",
    effects: [
      { operation: { op: "dealDamage", amount: 40 }, target: "enemySingle" },
      { operation: { op: "backfire", amount: 3 }, condition: { type: "shieldGainedThisTurnAtLeast", value: 1 } },
    ],
  },
  {
    id: "burst_fire",
    name: "Burst Fire",
    type: "DMG",
    rarity: "uncommon",
    cost: 2,
    tags: [],
    description: "Deal 20 DMG. Add a copy of this card to deck. Fleeting.",
    keywords: [{ kind: "fleeting" }],
    effects: [
      { operation: { op: "dealDamage", amount: 20 }, target: "enemySingle" },
      { operation: { op: "addCardToDeck", cardId: "self", count: 1, shuffle: true } },
    ],
  },
  {
    id: "full_auto",
    name: "Full Auto",
    type: "DMG",
    rarity: "uncommon",
    cost: 3,
    tags: [],
    description: "Create 3 fleeting 0-cost Hip Fire cards in hand.",
    effects: [{ operation: { op: "createCardsInHand", cardId: "hip_fire", count: 3, temporaryCost: 0, fleeting: true } }],
  },
  {
    id: "counter",
    name: "Counter",
    type: "DMG",
    rarity: "uncommon",
    cost: 2,
    tags: [],
    description: "On turn end, deal 10 DMG per 10 DEF remaining. If this deals 50+ DMG, Backfire 5.",
    effects: [{ operation: { op: "applyStatus", status: STATUS_COUNTER_TURN_END }, target: "self" }],
  },
  {
    id: "hip_fire",
    name: "Hip Fire",
    type: "DMG",
    rarity: "common",
    cost: 1,
    tags: [],
    description: "Deal 10 DMG. Exhaust.",
    keywords: [{ kind: "exhaust" }],
    effects: [{ operation: { op: "dealDamage", amount: 10 }, target: "enemySingle" }],
  },
  {
    id: "smoke_screen",
    name: "Smoke Screen",
    type: "DEF",
    rarity: "uncommon",
    cost: 2,
    tags: [],
    description: "Gain 20 DEF. Next turn, gain 10 DEF.",
    effects: [
      { operation: { op: "gainShield", amount: 20 }, target: "self" },
      { operation: { op: "applyStatus", status: STATUS_SMOKE_SCREEN }, target: "self" },
    ],
  },
  {
    id: "evasive_maneuvers",
    name: "Evasive Maneuvers",
    type: "DEF",
    rarity: "uncommon",
    cost: 3,
    tags: [],
    description: "Create 3 fleeting 0-cost Dodge cards in hand.",
    effects: [{ operation: { op: "createCardsInHand", cardId: "dodge", count: 3, temporaryCost: 0, fleeting: true } }],
  },
  {
    id: "dodge",
    name: "Dodge",
    type: "DEF",
    rarity: "common",
    cost: 1,
    tags: [],
    description: "Gain 10 DEF. Exhaust.",
    keywords: [{ kind: "exhaust" }],
    effects: [{ operation: { op: "gainShield", amount: 10 }, target: "self" }],
  },
  {
    id: "recover",
    name: "Recover",
    type: "SKL",
    rarity: "common",
    cost: 1,
    tags: [],
    description: "Convert up to 10 DEF to 10 HP. Exhaust.",
    keywords: [{ kind: "exhaust" }],
    effects: [{ operation: { op: "convertShieldToHeal", amount: 10 }, target: "self" }],
  },
  {
    id: "recover_plus",
    name: "Recover+",
    type: "SKL",
    rarity: "uncommon",
    cost: 2,
    tags: [],
    description: "Convert up to 30 DEF to 30 HP. Exhaust.",
    keywords: [{ kind: "exhaust" }],
    effects: [{ operation: { op: "convertShieldToHeal", amount: 30 }, target: "self" }],
  },
  {
    id: "energy_surge",
    name: "Energy Surge",
    type: "DEF",
    rarity: "uncommon",
    cost: 2,
    tags: [],
    description: "Gain 10 DEF per DMG tick dealt. If this gains 50+ DEF, Backfire 5.",
    effects: [
      { operation: { op: "gainShield", amount: { type: "counterTimes", key: "damageTicksThisTurn", multiplier: 10 } }, target: "self" },
      { operation: { op: "backfire", amount: 5 }, condition: { type: "shieldGainedThisTurnAtLeast", value: 50 } },
    ],
  },
  {
    id: "burn_away",
    name: "Burn Away",
    type: "DMG",
    rarity: "rare",
    cost: 0,
    tags: [],
    description: "Deal 4 FIRE. Take 20 DMG.",
    effects: [
      { operation: { op: "applyElement", element: "FIRE", amount: 4 }, target: "enemySingle" },
      { operation: { op: "dealDamage", amount: 20 }, target: "self" },
    ],
  },
]

export default CARDS
