import { Dimensions } from "react-native"
import fontConfig from "@shared/utils/fontConfig"

export const FACES = fontConfig.fontFaceNames()
export const EQUIP_SLOTS = ["accessory", "top", "bottom", "primary", "secondary", "utility", "trash"] as const
export const CYBER_BUCKETS = [
	{ key: "combatInterface", label: "Combat Interface" },
	{ key: "vitalSystems", label: "Vital Systems" },
	{ key: "auxiliaries", label: "Auxiliaries" },
] as const
export const ITEM_ICON_SIZE = 34
export const SELECTION_ICON_SIZE = 56
export const MINI_CARD_SIZE = 44
export const SCREEN_WIDTH = Dimensions.get("window").width
export const GRID_COLUMNS = SCREEN_WIDTH > 420 ? 5 : 4
export const GRID_GAP = 10
export const GRID_WIDTH = SCREEN_WIDTH - 80
export const GRID_CARD_WIDTH = Math.max(72, Math.floor((GRID_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS))
export const GRID_CARD_HEIGHT = Math.floor(GRID_CARD_WIDTH * 1.35)
