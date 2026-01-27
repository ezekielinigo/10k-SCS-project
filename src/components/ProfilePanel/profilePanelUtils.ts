import type { CardRef, CyberSlot, EquipmentSlot, ItemTemplate, WeaponSlot } from "@shared/game/types"

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

export const formatItemKindLabel = (template: ItemTemplate) => {
  switch (template.kind) {
    case "equipment": {
      const slot = capitalizeSlot(template.equipSlot)
      return slot || "Equipment"
    }
    case "cybernetic": {
      const slot = capitalizeSlot(template.equipSlot)
      return slot ? `${slot} Cyberware` : "Cyberware"
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
      switch (template.equipSlot) {
        case "accessory":
          return "watch"
        case "top":
          return "layers"
        case "bottom":
          return "square"
        case "utility":
          return "tool"
        default:
          return "shield"
      }
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
  switch (type) {
    case "attack":
    case "DMG":
      return "crosshair"
    case "utility":
    case "SKL":
      return "zap"
    case "skill":
      return "activity"
    case "defense":
    case "DEF":
      return "shield"
    case "ERR":
      return "alert-triangle"
    default:
      return "layers"
  }
}

export const resolveSlotIcon = (slot: EquipmentSlot | WeaponSlot | CyberSlot) => {
  switch (slot) {
    case "accessory":
      return "watch"
    case "top":
      return "layers"
    case "bottom":
      return "square"
    case "utility":
      return "tool"
    case "primary":
    case "secondary":
      return "crosshair"
    case "neural":
      return "cpu"
    case "ocular":
      return "eye"
    case "skeletal":
      return "activity"
    case "dermal":
      return "shield"
    case "systems":
      return "hard-drive"
    case "external":
      return "wifi"
    default:
      return "box"
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
