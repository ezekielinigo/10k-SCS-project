import type { CardRef, CyberwareSlot, CyberwareSlotKey, EquipmentSlot, ItemTemplate, WeaponSlot } from "@shared/game/types"
import { CYBER_BUCKETS } from "./profilePanelConstants"

/*
Utilities for ProfilePanel display labels, slot parsing, and icons.
Slot keys use "bucket:index" for cyberware (e.g., "combatInterface:0").
*/

export const rarityRank: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  unique: 4,
}

export const capitalizeSlot = (slot?: string) => {
  if (!slot) return ""
  return slot.charAt(0).toUpperCase() + slot.slice(1)
}

const CYBERWARE_LABELS = Object.fromEntries(CYBER_BUCKETS.map((bucket) => [bucket.key, bucket.label])) as Record<
  CyberwareSlot,
  string
>

const CYBERWARE_ICON_BY_BUCKET: Record<CyberwareSlot, string> = {
  combatInterface: "cpu",
  vitalSystems: "shield",
  auxiliaries: "tool",
}

const EQUIPMENT_ICON_BY_SLOT: Record<EquipmentSlot, string> = {
  accessory: "watch",
  top: "layers",
  bottom: "square",
  utility: "tool",
  trash: "trash",
}

const CARD_TYPE_ICON_BY_KIND: Record<string, string> = {
  attack: "crosshair",
  DMG: "crosshair",
  utility: "zap",
  SKL: "zap",
  skill: "activity",
  defense: "shield",
  DEF: "shield",
  ERR: "alert-triangle",
}

export const getCyberwareBucketFromKey = (slot: CyberwareSlotKey): CyberwareSlot => {
  const [bucket] = slot.split(":")
  return bucket as CyberwareSlot
}

export const formatCyberwareSlotLabel = (slot?: CyberwareSlot) => {
  if (!slot) return ""
  return CYBERWARE_LABELS[slot] ?? "Cyberware"
}

export const formatSlotLabel = (slot?: EquipmentSlot | WeaponSlot | CyberwareSlotKey | null) => {
  if (!slot) return ""
  if (slot.includes(":")) return formatCyberwareSlotLabel(getCyberwareBucketFromKey(slot as CyberwareSlotKey))
  return capitalizeSlot(slot)
}

export const formatItemKindLabel = (template: ItemTemplate) => {
  switch (template.kind) {
    case "equipment": {
      const slot = capitalizeSlot(template.equipSlot)
      return slot || "Equipment"
    }
    case "cybernetic": {
      const slotLabel = formatCyberwareSlotLabel(template.equipSlot as CyberwareSlot)
      return slotLabel || "Cyberware"
    }
    case "weapon": {
      if (template.weaponSlotPolicy === "primaryOnly") return "Primary"
      if (template.weaponSlotPolicy === "secondaryOnly") return "Secondary"
      return "Primary/Secondary"
    }
    case "consumable":
      return "Consumable"
    case "misc":
      return "Misc"
    default:
      return capitalizeSlot(template.kind)
  }
}

export const resolveItemIcon = (template: ItemTemplate) => {
  switch (template.kind) {
    case "equipment": {
      return EQUIPMENT_ICON_BY_SLOT[template.equipSlot as EquipmentSlot] ?? "shield"
    }
    case "cybernetic":
      return "cpu"
    case "weapon":
      return "crosshair"
    case "consumable":
      return "droplet"
    default:
      return "package"
  }
}

export const resolveCardTypeIcon = (type?: string) => {
  if (!type) return "layers"
  return CARD_TYPE_ICON_BY_KIND[type] ?? "layers"
}

export const resolveSlotIcon = (slot: EquipmentSlot | WeaponSlot | CyberwareSlotKey) => {
  if (slot.includes(":")) {
    const bucket = getCyberwareBucketFromKey(slot as CyberwareSlotKey)
    return CYBERWARE_ICON_BY_BUCKET[bucket] ?? "box"
  }
  switch (slot) {
    case "primary":
    case "secondary":
      return "crosshair"
    default:
      return EQUIPMENT_ICON_BY_SLOT[slot as EquipmentSlot] ?? "box"
  }
}

export const collectCardRefs = (template?: ItemTemplate | null): CardRef[] => {
  if (!template) return []
  const refs = new Set<CardRef>()
  template.cardRefs?.forEach((ref) => refs.add(ref))
  template.passiveCardRefs?.forEach((ref) => refs.add(ref))
  if (template.weaponCards) {
    Object.values(template.weaponCards).forEach((list) => list?.forEach((ref) => refs.add(ref)))
  }
  return [...refs]
}

export const describeEffect = (effect: any): string[] => {
  if (!effect) return []
  const lines: string[] = []
  if (effect.kind === "stat") {
    if (effect.vitals) {
      Object.entries(effect.vitals).forEach(([key, val]) => {
        lines.push(`${capitalizeSlot(key)} ${Number(val) >= 0 ? "+" : ""}${val}`)
      })
    }
    if (effect.skills) {
      Object.entries(effect.skills).forEach(([key, val]) => {
        if (key === "subSkills" && val && typeof val === "object") {
          Object.entries(val as Record<string, number>).forEach(([subKey, subVal]) => {
            lines.push(`${capitalizeSlot(subKey)} ${Number(subVal) >= 0 ? "+" : ""}${subVal}`)
          })
        } else if (typeof val === "number") {
          lines.push(`${capitalizeSlot(key)} ${Number(val) >= 0 ? "+" : ""}${val}`)
        }
      })
    }
  } else if (effect.kind === "faction") {
    if (effect.factionTags?.length) lines.push(`Faction: ${effect.factionTags.join(", ")}`)
  } else if (effect.kind === "custom") {
    lines.push("Custom effect")
  }
  return lines
}
