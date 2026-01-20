import { type ItemTemplate, type WeaponSlotPolicy } from "../types"

const asPolicy = (policy: WeaponSlotPolicy) => policy

const ITEMS: Record<string, ItemTemplate> = {
  knife_rusty: {
    id: "knife_rusty",
    name: "Rusty Knife",
    kind: "weapon",
    rarity: "common",
    weaponSlotPolicy: asPolicy("either"),
    weaponCards: {
      primary: ["stab_heavy", "parry"],
      secondary: ["quick_stab"],
    },
    tags: ["melee", "blade"],
    effects: [
      { kind: "stat", skills: { subSkills: { closeCombat: 1 } } },
    ],
    description: "A worn blade that still cuts. Works in a pinch.",
  },
  pistol_basic: {
    id: "pistol_basic",
    name: "Service Pistol",
    kind: "weapon",
    rarity: "common",
    weaponSlotPolicy: asPolicy("either"),
    weaponCards: {
      primary: ["aimed_shot", "double_tap"],
      secondary: ["snap_shot"],
    },
    tags: ["ranged", "pistol"],
    effects: [
      { kind: "stat", skills: { subSkills: { marksmanship: 1 } } },
    ],
    description: "Standard sidearm issued to low-tier security.",
  },
  smg_street: {
    id: "smg_street",
    name: "Street SMG",
    kind: "weapon",
    rarity: "uncommon",
    weaponSlotPolicy: asPolicy("primaryOnly"),
    weaponCards: {
      primary: ["burst_fire", "suppressing_fire"],
      secondary: ["hip_fire"]
    },
    tags: ["ranged", "smg"],
    effects: [
      { kind: "stat", skills: { subSkills: { marksmanship: 1, mobility: 1 } } },
    ],
    description: "Sprays lead fast; control is optional.",
  },
  medkit_small: {
    id: "medkit_small",
    name: "Medkit (Small)",
    kind: "consumable",
    rarity: "common",
    stackable: true,
    maxStack: 5,
    consumedOnUse: true,
    effects: [
      { kind: "stat", vitals: { health: 20, stress: -5 } },
    ],
    description: "Single-use kit to patch small wounds and steady nerves.",
  },
  energy_snack: {
    id: "energy_snack",
    name: "Energy Snack",
    kind: "consumable",
    rarity: "common",
    stackable: true,
    maxStack: 10,
    consumedOnUse: true,
    effects: [
      { kind: "stat", vitals: { stress: -3 }, skills: { subSkills: { mobility: 1 } } },
    ],
    description: "Sugary rush that helps you keep moving.",
  },
  jacket_cloth: {
    id: "jacket_cloth",
    name: "Padded Jacket",
    kind: "equipment",
    rarity: "uncommon",
    equipSlot: "top",
    tags: ["armor"],
    effects: [
      { kind: "stat", vitals: { health: 5, looks: -1 } },
    ],
    description: "Light padding with a questionable fashion sense.",
  },
  pants_reinforced: {
    id: "pants_reinforced",
    name: "Reinforced Pants",
    kind: "equipment",
    rarity: "uncommon",
    equipSlot: "bottom",
    tags: ["armor"],
    effects: [
      { kind: "stat", vitals: { health: 5 }, skills: { subSkills: { mobility: 1 } } },
    ],
    description: "Sturdy trousers with hidden plates for the cautious courier.",
  },
  rig_utility: {
    id: "rig_utility",
    name: "Utility Rig",
    kind: "equipment",
    rarity: "rare",
    equipSlot: "utility",
    tags: ["rig", "utility"],
    passiveCardRefs: ["deploy_tools"],
    effects: [
      { kind: "stat", vitals: { popularity: 2 } },
    ],
    description: "Straps and pockets for every tool you own.",
  },
  trinket_lucky_coin: {
    id: "trinket_lucky_coin",
    name: "Lucky Coin",
    kind: "equipment",
    rarity: "rare",
    equipSlot: "accessory",
    tags: ["lucky"],
    passiveCardRefs: ["lucky_draw"],
    effects: [
      { kind: "stat", vitals: { popularity: 1 } },
    ],
    description: "A tarnished coin that seems to bend odds in your favor.",
  },
  neural_chip_mk1: {
    id: "neural_chip_mk1",
    name: "Neural Chip Mk.I",
    kind: "cybernetic",
    rarity: "rare",
    equipSlot: "neural",
    tags: ["cyber"],
    factionTags: ["corp"],
    cardRefs: ["quick_think"],
    effects: [
      { kind: "stat", vitals: { humanity: -5 }, skills: { int: 1, subSkills: { hacking: 1 } } },
    ],
    description: "Boosts cognition at the cost of a little soul.",
  },
  ocular_hud_mk1: {
    id: "ocular_hud_mk1",
    name: "Ocular HUD Mk.I",
    kind: "cybernetic",
    rarity: "uncommon",
    equipSlot: "ocular",
    tags: ["cyber"],
    factionTags: ["corp"],
    cardRefs: ["scan"],
    effects: [
      { kind: "stat", skills: { subSkills: { stealth: 1 } } },
    ],
    description: "Overlay data feeds into your vision, enhancing awareness.",
  },
  dermal_weave_i: {
    id: "dermal_weave_i",
    name: "Dermal Weave I",
    kind: "cybernetic",
    rarity: "rare",
    equipSlot: "dermal",
    tags: ["cyber", "armor"],
    effects: [
      { kind: "stat", vitals: { health: 10, looks: -2 } },
    ],
    description: "Subdermal mesh stiffens the skin against impacts.",
  },
  skeletal_brace: {
    id: "skeletal_brace",
    name: "Skeletal Brace",
    kind: "cybernetic",
    rarity: "rare",
    equipSlot: "skeletal",
    tags: ["cyber"],
    effects: [
      { kind: "stat", skills: { subSkills: { athletics: 1 } }, vitals: { health: 5 } },
    ],
    description: "Reinforced frame for heavier loads and stronger blows.",
  },
  systems_overclocker: {
    id: "systems_overclocker",
    name: "Systems Overclocker",
    kind: "cybernetic",
    rarity: "unique",
    equipSlot: "systems",
    tags: ["cyber"],
    passiveCardRefs: ["overclock"],
    effects: [
      { kind: "stat", vitals: { humanity: -8, stress: 5 }, skills: { subSkills: { hacking: 2 } } },
    ],
    description: "Pushes your neural bus to unsafe speeds. Handle with care.",
  },
  external_drone_link: {
    id: "external_drone_link",
    name: "Drone Link Harness",
    kind: "cybernetic",
    rarity: "rare",
    equipSlot: "external",
    tags: ["cyber", "drone"],
    cardRefs: ["deploy_drone"],
    effects: [
      { kind: "stat", skills: { subSkills: { engineering: 1 } } },
    ],
    description: "Tethers your nervous system to a drone swarm interface.",
  },
}

export const listItems = () => Object.values(ITEMS)

export const getItemById = (id: string) => ITEMS[id]

export default ITEMS
