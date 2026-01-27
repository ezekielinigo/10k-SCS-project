import type {
  CardRef,
  EquipmentSlot,
  GameState,
  ItemEffect,
  ItemInstance,
  ItemTemplate,
  WeaponSlot,
  WeaponSlotPolicy,
  Loadout,
  CyberwareSlot,
  CyberwareSlotKey,
  CyberwareSlotIndex,
} from "../types"
import { findEntryByInstanceId, removeItemInstance } from "./inventoryService"

const equipmentSlots: EquipmentSlot[] = ["accessory", "top", "bottom", "utility", "trash"]
const weaponSlots: WeaponSlot[] = ["primary", "secondary"]
const cyberwareBuckets = ["combatInterface", "vitalSystems", "auxiliaries"] as const

type SlotKind = "equipment" | "weapon" | "cyber"

const randomId = () => Math.random().toString(36).slice(2)

const normalizeCyberBucket = (bucket?: (string | null)[]): [string | null, string | null] => [
  bucket?.[0] ?? null,
  bucket?.[1] ?? null,
]

const ensureLoadout = (loadout?: Loadout): Loadout => ({
  equipment: {
    accessory: null,
    top: null,
    bottom: null,
    utility: null,
    trash: null,
    ...(loadout?.equipment ?? {}),
  },
  weapons: {
    primary: null,
    secondary: null,
    ...(loadout?.weapons ?? {}),
  },
  cyber: {
    combatInterface: normalizeCyberBucket(loadout?.cyber?.combatInterface),
    vitalSystems: normalizeCyberBucket(loadout?.cyber?.vitalSystems),
    auxiliaries: normalizeCyberBucket(loadout?.cyber?.auxiliaries),
  },
})

const isCyberwareBucket = (slot: string): slot is CyberwareSlot =>
  (cyberwareBuckets as readonly string[]).includes(slot)

const isCyberwareSlotKey = (slot: string): slot is CyberwareSlotKey => {
  const [bucket, index] = slot.split(":")
  if (!bucket || index === undefined) return false
  if (!isCyberwareBucket(bucket)) return false
  return index === "0" || index === "1"
}

const parseCyberwareSlotKey = (slot: CyberwareSlotKey): { bucket: CyberwareSlot; index: CyberwareSlotIndex } => {
  const [bucket, index] = slot.split(":")
  return { bucket: bucket as CyberwareSlot, index: (index === "1" ? 1 : 0) as CyberwareSlotIndex }
}

const makeCyberwareSlotKey = (bucket: CyberwareSlot, index: CyberwareSlotIndex): CyberwareSlotKey =>
  `${bucket}:${index}` as CyberwareSlotKey

const resolveSlotKind = (slot: EquipmentSlot | WeaponSlot | CyberwareSlot | CyberwareSlotKey): SlotKind | null => {
  if ((equipmentSlots as string[]).includes(slot)) return "equipment"
  if ((weaponSlots as string[]).includes(slot)) return "weapon"
  if (typeof slot === "string" && (isCyberwareBucket(slot) || isCyberwareSlotKey(slot))) return "cyber"
  return null
}

const policyAllows = (policy: WeaponSlotPolicy | undefined, slot: WeaponSlot) => {
  if (!policy || policy === "either") return true
  if (policy === "primaryOnly") return slot === "primary"
  if (policy === "secondaryOnly") return slot === "secondary"
  return false
}

export const canEquip = (
  state: GameState,
  instanceId: string,
  slot: EquipmentSlot | WeaponSlot | CyberwareSlot | CyberwareSlotKey,
): { ok: boolean; reason?: string } => {
  const instance = state.itemInstances?.[instanceId]
  if (!instance) return { ok: false, reason: "Missing instance" }
  const template = state.itemTemplates?.[instance.templateId]
  if (!template) return { ok: false, reason: "Missing template" }

  // trash accepts any item
  if (slot === "trash") return { ok: true }

  const slotKind = resolveSlotKind(slot)
  if (!slotKind) return { ok: false, reason: "Invalid slot" }

  switch (slotKind) {
    case "equipment": {
      if (template.kind !== "equipment") return { ok: false, reason: "Not equipment" }
      if (template.equipSlot !== slot) return { ok: false, reason: "Slot mismatch" }
      return { ok: true }
    }
    case "cyber": {
      if (template.kind !== "cybernetic") return { ok: false, reason: "Not cybernetic" }
      const bucket = isCyberwareSlotKey(slot as string) ? parseCyberwareSlotKey(slot as CyberwareSlotKey).bucket : (slot as CyberwareSlot)
      if (!bucket || template.equipSlot !== bucket) return { ok: false, reason: "Slot mismatch" }
      return { ok: true }
    }
    case "weapon": {
      if (template.kind !== "weapon") return { ok: false, reason: "Not weapon" }
      if (!policyAllows(template.weaponSlotPolicy, slot as WeaponSlot)) {
        return { ok: false, reason: "Policy mismatch" }
      }
      return { ok: true }
    }
    default:
      return { ok: false, reason: "Unsupported slot" }
  }
}

export const equipItem = (
  state: GameState,
  instanceId: string,
  slot: EquipmentSlot | WeaponSlot | CyberwareSlot | CyberwareSlotKey,
): GameState => {
  // allow trash specially
  const validation = canEquip(state, instanceId, slot)
  if (!validation.ok) return state

  // remember existing occupant for trash so we can remove it AFTER we update
  const previousOccupantIdForTrash = slot === "trash" ? state.loadout?.equipment?.[slot as EquipmentSlot] ?? null : null

  const loadout = ensureLoadout(state.loadout)
  const slotKind = resolveSlotKind(slot)
  if (!slotKind) return state

  const entry = findEntryByInstanceId(state, instanceId)
  const ownerId = entry?.ownerId ?? state.player.id

  const resolveCyberSlotKey = (l: Loadout): CyberwareSlotKey | null => {
    if (slotKind !== "cyber") return null
    if (isCyberwareSlotKey(slot as string)) return slot as CyberwareSlotKey
    const bucket = slot as CyberwareSlot
    if (!bucket) return null
    const firstEmpty = l.cyber[bucket].findIndex((id) => !id)
    const index = (firstEmpty >= 0 ? firstEmpty : 0) as CyberwareSlotIndex
    return makeCyberwareSlotKey(bucket, index)
  }

  const resolvedCyberSlotKey = resolveCyberSlotKey(loadout)

  const updateSlot = (setter: (l: Loadout) => Loadout) => setter(loadout)
  const nextLoadout = updateSlot((l) => {
    const clone: Loadout = {
      equipment: { ...l.equipment },
      weapons: { ...l.weapons },
      cyber: {
        combatInterface: [...l.cyber.combatInterface] as [string | null, string | null],
        vitalSystems: [...l.cyber.vitalSystems] as [string | null, string | null],
        auxiliaries: [...l.cyber.auxiliaries] as [string | null, string | null],
      },
    }

    // Ensure the instance is not present in any other slot before assigning
    Object.keys(clone.equipment).forEach((k) => {
      const key = k as EquipmentSlot
      if (clone.equipment[key] === instanceId) clone.equipment[key] = null
    })
    Object.keys(clone.weapons).forEach((k) => {
      const key = k as WeaponSlot
      if (clone.weapons[key] === instanceId) clone.weapons[key] = null
    })
    Object.entries(clone.cyber).forEach(([bucket, slots]) => {
      slots.forEach((id, index) => {
        if (id === instanceId) slots[index] = null
      })
      clone.cyber[bucket as CyberwareSlot] = slots as [string | null, string | null]
    })

    if (slotKind === "equipment") clone.equipment[slot as EquipmentSlot] = instanceId
    if (slotKind === "weapon") clone.weapons[slot as WeaponSlot] = instanceId
    if (slotKind === "cyber" && resolvedCyberSlotKey) {
      const { bucket, index } = parseCyberwareSlotKey(resolvedCyberSlotKey)
      clone.cyber[bucket][index] = instanceId
    }
    return clone
  })

  const entries = { ...(state.inventoryEntries ?? {}) }
  // clear any occupant entry.slot that matches the slot
  const occupantId =
    slotKind === "equipment"
      ? state.loadout?.equipment?.[slot as EquipmentSlot] ?? null
      : slotKind === "weapon"
        ? state.loadout?.weapons?.[slot as WeaponSlot] ?? null
        : (() => {
            if (!state.loadout?.cyber || !resolvedCyberSlotKey) return null
            const { bucket, index } = parseCyberwareSlotKey(resolvedCyberSlotKey)
            return state.loadout.cyber[bucket]?.[index] ?? null
          })()
  if (occupantId) {
    const occEntry = findEntryByInstanceId(state, occupantId)
    if (occEntry) {
      entries[occEntry.id] = { ...occEntry, slot: null }
    }
  }

  if (entry) {
    const entrySlot = slotKind === "cyber"
      ? (resolvedCyberSlotKey as CyberwareSlotKey)
      : (slot as EquipmentSlot | WeaponSlot | CyberwareSlotKey)
    entries[entry.id] = { ...entry, slot: entrySlot }
  } else {
    // instance without entry: create a passive entry to keep consistency
    const newEntryId = `${ownerId}__${instanceId}`
    entries[newEntryId] = {
      id: newEntryId,
      ownerId,
      templateId: state.itemInstances?.[instanceId]?.templateId ?? "",
      instanceId,
      quantity: state.itemInstances?.[instanceId]?.quantity ?? 1,
      slot: slotKind === "cyber"
        ? (resolvedCyberSlotKey as CyberwareSlotKey)
        : (slot as EquipmentSlot | WeaponSlot | CyberwareSlotKey),
    }
  }

  let nextState: GameState = { ...state, loadout: nextLoadout, inventoryEntries: entries }

  // if we replaced a trash occupant, remove it permanently now that the new
  // state references have been updated (avoids accidentally removing the
  // newly equipped instance or its inventory entry during processing)
  if (previousOccupantIdForTrash && previousOccupantIdForTrash !== instanceId) {
    nextState = removeItemInstance(nextState, previousOccupantIdForTrash)
  }

  return nextState
}

export const unequipSlot = (
  state: GameState,
  slot: EquipmentSlot | WeaponSlot | CyberwareSlotKey,
): GameState => {
  const loadout = ensureLoadout(state.loadout)
  const slotKind = resolveSlotKind(slot)
  if (!slotKind) return state

  let instanceId: string | null = null
  if (slotKind === "equipment") instanceId = loadout.equipment[slot as EquipmentSlot]
  if (slotKind === "weapon") instanceId = loadout.weapons[slot as WeaponSlot]
  if (slotKind === "cyber") {
    if (!isCyberwareSlotKey(slot as string)) return state
    const { bucket, index } = parseCyberwareSlotKey(slot as CyberwareSlotKey)
    instanceId = loadout.cyber[bucket][index]
  }

  const nextLoadout = { ...loadout }
  if (slotKind === "equipment") nextLoadout.equipment[slot as EquipmentSlot] = null
  if (slotKind === "weapon") nextLoadout.weapons[slot as WeaponSlot] = null
  if (slotKind === "cyber") {
    if (!isCyberwareSlotKey(slot as string)) return state
    const { bucket, index } = parseCyberwareSlotKey(slot as CyberwareSlotKey)
    nextLoadout.cyber[bucket][index] = null
  }

  const entries = { ...(state.inventoryEntries ?? {}) }
  if (instanceId) {
    const entry = findEntryByInstanceId(state, instanceId)
    if (entry) entries[entry.id] = { ...entry, slot: null }
  }

  return { ...state, loadout: nextLoadout, inventoryEntries: entries }
}

export const collectEquippedEffects = (
  state: GameState,
): { effects: ItemEffect[]; cards: CardRef[]; factionTags: string[] } => {
  const loadout = ensureLoadout(state.loadout)
  const ids = [
    ...Object.values(loadout.equipment),
    ...Object.values(loadout.weapons),
    ...Object.values(loadout.cyber).flat(),
  ].filter(Boolean) as string[]

  const effects: ItemEffect[] = []
  const cards: CardRef[] = []
  const factionTags: string[] = []

  ids.forEach((instanceId) => {
    const instance = state.itemInstances?.[instanceId]
    if (!instance) return
    const template = state.itemTemplates?.[instance.templateId]
    if (!template) return

    if (template.effects) effects.push(...template.effects)
    if (template.passiveCardRefs) cards.push(...template.passiveCardRefs)
    if (template.cardRefs) cards.push(...template.cardRefs)
    if (template.factionTags) factionTags.push(...template.factionTags)
  })

  // weapon slot specific cards
  Object.entries(loadout.weapons).forEach(([slotKey, instId]) => {
    if (!instId) return
    const instance = state.itemInstances?.[instId]
    const template = instance ? state.itemTemplates?.[instance.templateId] : undefined
    if (!template || !template.weaponCards) return
    const weaponSlot = slotKey as WeaponSlot
    const slotCards = template.weaponCards[weaponSlot]
    if (slotCards) cards.push(...slotCards)
  })

  return { effects, cards, factionTags }
}

export const recomputeDerivedLoadout = (state: GameState): GameState => {
  const { effects, cards, factionTags } = collectEquippedEffects(state)
  const derived = {
    statDeltas: effects,
    equippedCards: cards,
    equippedFactionTags: factionTags,
  }
  return { ...state, derivedLoadout: derived }
}

// convenience: equip and recompute in one call
export const equipAndRecompute = (
  state: GameState,
  instanceId: string,
  slot: EquipmentSlot | WeaponSlot | CyberwareSlot | CyberwareSlotKey,
): GameState => recomputeDerivedLoadout(equipItem(state, instanceId, slot))

// convenience: unequip and recompute in one call
export const unequipAndRecompute = (
  state: GameState,
  slot: EquipmentSlot | WeaponSlot | CyberwareSlotKey,
): GameState => recomputeDerivedLoadout(unequipSlot(state, slot))

export const createLoadoutEntry = (): Loadout => ({
  equipment: {
    accessory: null,
    top: null,
    bottom: null,
    utility: null,
    trash: null,
  },
  weapons: {
    primary: null,
    secondary: null,
  },
  cyber: {
    combatInterface: [null, null],
    vitalSystems: [null, null],
    auxiliaries: [null, null],
  },
})

export const createEmptyDerivedLoadout = () => ({
  statDeltas: [] as ItemEffect[],
  equippedCards: [] as CardRef[],
  equippedFactionTags: [] as string[],
})

// helper to seed starter gear quickly
export const grantAndEquip = (
  state: GameState,
  templateId: string,
  ownerId: string,
  slot: EquipmentSlot | WeaponSlot | CyberwareSlot | CyberwareSlotKey,
): GameState => {
  const entryId = randomId()
  // create a minimal instance + entry if one is missing
  const instanceId = randomId()
  const itemInstances = {
    ...(state.itemInstances ?? {}),
    [instanceId]: { id: instanceId, templateId, ownerId, quantity: 1 },
  }
  const inventoryEntries = {
    ...(state.inventoryEntries ?? {}),
    [entryId]: { id: entryId, ownerId, templateId, instanceId, quantity: 1, slot: null },
  }
  const withItem: GameState = { ...state, itemInstances, inventoryEntries }
  return equipAndRecompute(withItem, instanceId, slot)
}
