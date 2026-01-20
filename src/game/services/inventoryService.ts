import type {
  GameState,
  InventoryEntry,
  ItemInstance,
  ItemTemplate,
} from "../types"

const randomId = () => Math.random().toString(36).slice(2)

export const findEntryByInstanceId = (
  state: GameState,
  instanceId: string,
): InventoryEntry | undefined => {
  const entries = state.inventoryEntries
  if (!entries) return undefined
  for (const key in entries) {
    const entry = entries[key]
    if (entry.instanceId === instanceId) return entry
  }
  return undefined
}

const ensureTemplate = (state: GameState, templateId: string): ItemTemplate => {
  const template = state.itemTemplates?.[templateId]
  if (!template) throw new Error(`Missing item template: ${templateId}`)
  return template
}

export const createItemInstance = (
  state: GameState,
  templateId: string,
  ownerId: string,
  quantity = 1,
): { state: GameState; instance: ItemInstance; entry: InventoryEntry } => {
  ensureTemplate(state, templateId)
  const instanceId = randomId()
  const instance: ItemInstance = {
    id: instanceId,
    templateId,
    ownerId,
    quantity,
  }

  const entryId = `${ownerId}__${instanceId}`
  const entry: InventoryEntry = {
    id: entryId,
    ownerId,
    templateId,
    instanceId,
    quantity,
    slot: null,
  }

  const itemInstances = { ...(state.itemInstances ?? {}), [instanceId]: instance }
  const inventoryEntries = { ...(state.inventoryEntries ?? {}), [entryId]: entry }
  const nextState: GameState = { ...state, itemInstances, inventoryEntries }
  return { state: nextState, instance, entry }
}

export const grantItemToOwner = (
  state: GameState,
  templateId: string,
  ownerId: string,
  quantity = 1,
): GameState => {
  const template = ensureTemplate(state, templateId)
  if (template.stackable) {
    // try to find an existing stack for this owner+template
    const entries = state.inventoryEntries
    let existingEntry: InventoryEntry | undefined
    if (entries) {
      for (const key in entries) {
        const entry = entries[key]
        if (entry.ownerId === ownerId && entry.templateId === templateId) {
          existingEntry = entry
          break
        }
      }
    }
    if (existingEntry) {
      const updatedEntry: InventoryEntry = {
        ...existingEntry,
        quantity: existingEntry.quantity + quantity,
      }
      return {
        ...state,
        inventoryEntries: {
          ...(state.inventoryEntries ?? {}),
          [updatedEntry.id]: updatedEntry,
        },
      }
    }
  }
  return createItemInstance(state, templateId, ownerId, quantity).state
}

export const removeItemInstance = (
  state: GameState,
  instanceId: string,
): GameState => {
  const instances = { ...(state.itemInstances ?? {}) }
  const entries = { ...(state.inventoryEntries ?? {}) }
  delete instances[instanceId]
  for (const key in entries) {
    if (entries[key].instanceId === instanceId) {
      delete entries[key]
      break
    }
  }
  return { ...state, itemInstances: instances, inventoryEntries: entries }
}

export const consumeItem = (
  state: GameState,
  instanceId: string,
  quantity = 1,
): GameState => {
  const instance = state.itemInstances?.[instanceId]
  if (!instance) return state
  const template = ensureTemplate(state, instance.templateId)
  if (template.kind !== "consumable") return state

  const entries = { ...(state.inventoryEntries ?? {}) }
  const entry = findEntryByInstanceId(state, instanceId)
  if (!entry) return state

  const remaining = entry.quantity - quantity
  if (remaining <= 0) {
    delete entries[entry.id]
    const instances = { ...(state.itemInstances ?? {}) }
    delete instances[instanceId]
    return { ...state, inventoryEntries: entries, itemInstances: instances }
  }

  entries[entry.id] = { ...entry, quantity: remaining }
  const instances = { ...(state.itemInstances ?? {}) }
  instances[instanceId] = { ...instance, quantity: remaining }
  return { ...state, inventoryEntries: entries, itemInstances: instances }
}

export const listOwnerInventory = (
  state: GameState,
  ownerId: string,
): { entry: InventoryEntry; instance: ItemInstance; template: ItemTemplate }[] => {
  const entries = state.inventoryEntries
  if (!entries) return []

  const results: { entry: InventoryEntry; instance: ItemInstance; template: ItemTemplate }[] = []
  for (const key in entries) {
    const entry = entries[key]
    if (entry.ownerId !== ownerId) continue
    const instance = state.itemInstances?.[entry.instanceId]
    const template = state.itemTemplates?.[entry.templateId]
    if (!instance || !template) continue
    results.push({ entry, instance, template })
  }
  return results
}
