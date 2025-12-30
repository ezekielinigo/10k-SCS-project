export type Hex = string
export type Tone = {
	deep?: Hex
	dark: Hex
	mid: Hex
	light?: Hex
	misc_deep?: Hex
	misc_dark?: Hex
	misc_mid?: Hex
	misc_light?: Hex
}
export type PaletteCategory = "skin" | "hair" | "outer_body"
export const BASE_PALETTE: Record<PaletteCategory, Tone> = {
	skin: {
		dark: "#e9b5a3",
		mid: "#fad6b8",
		light: "#fad6b8",
	},
	hair: {
		deep: "#796755",
		dark: "#a08662",
		mid: "#c7b08b",
		light: "#e4d2aa",
		misc_dark: "#e9b5a3",
	},
	outer_body: {
		deep: "#181425",
		dark: "#9e2835",
		mid: "#e43b44",
		light: "#ff0044",
	},
}

export const SKIN_PALETTES: Tone[] = [
  {
		dark: "#c28569",
		mid: "#e8b796",
		light: "#fef3c0",
  },
  {
		dark: "#b86f50",
		mid: "#e4a672",
		light: "#fef3c0",
  },
  {
		dark: "#d87644",
		mid: "#e4a672",
		light: "#fef3c0",
  },
  {
		dark: "#be4a2f",
		mid: "#d87644",
		light: "#fef3c0",
  },
  {
		dark: "#71413b",
		mid: "#c28569",
		light: "#fef3c0",
  },
  {
		dark: "#743f39",
		mid: "#b86f50",
		light: "#fef3c0",
  },
  {
		dark: "#181425",
		mid: "#423934",
		light: "#fef3c0",
  },
  {
		dark: "#423934",
		mid: "#5a4e44",
		light: "#fef3c0",
  },
  {
		dark: "#5a4e44",
		mid: "#796755",
		light: "#fef3c0",
  },
  {
		dark: "#796755",
		mid: "#a08662",
		light: "#fef3c0",
  },
  {
		dark: "#a08662",
		mid: "#c7b08b",
		light: "#fef3c0",
  },
  {
		dark: "#c7b08b",
		mid: "#e4d2aa",
		light: "#fef3c0",
  },
  {
		dark: "#e4d2aa",
		mid: "#fef3c0",
		light: "#fef3c0",
  },
  {
		dark: "#fad6b8",
		mid: "#fef3c0",
		light: "#fef3c0",
  },
  {
		dark: "#f4d29c",
		mid: "#fef3c0",
		light: "#fef3c0",
  },
  {
		dark: "#dba463",
		mid: "#f4d29c",
		light: "#fef3c0",
  },
  {
		dark: "#bb7547",
		mid: "#dba463",
		light: "#f4d29c",
  },
  {
		dark: "#71413b",
		mid: "#bb7547",
		light: "#fef3c0",
  },
  {
		dark: "#422433",
		mid: "#71413b",
		light: "#fef3c0",
  },
  {
		dark: "#181425",
		mid: "#422433",
		light: "#fef3c0",
  },
  {
		dark: "#422433",
		mid: "#5b3138",
		light: "#fef3c0",
  },
  {
		dark: "#5b3138",
		mid: "#8e5252",
		light: "#fef3c0",
  },
  {
		dark: "#8e5252",
		mid: "#ba756a",
		light: "#fef3c0",
  },
  {
		dark: "#ba756a",
		mid: "#e9b5a3",
		light: "#fef3c0",
  },
  {
		dark: "#e9b5a3",
		mid: "#fad6b8",
		light: "#fad6b8",
  },
  {
		dark: "#f5a097",
		mid: "#fad6b8",
		light: "#fad6b8",
  },
  {
		dark: "#e86a73",
		mid: "#e9b5a3",
		light: "#fad6b8",
  },
  {
		dark: "#b55088",
		mid: "#e86a73",
		light: "#fad6b8",
  },
  {
		dark: "#68386c",
		mid: "#b55088",
		light: "#fad6b8",
  },
]

export const HAIR_PALETTES: Tone[] = [
	{
		deep: "#796755",
		dark: "#a08662",
		mid: "#c7b08b",
		light: "#e4d2aa",
	},
	{
		deep: "#5a4e44",
		dark: "#796755",
		mid: "#a08662",
		light: "#c7b08b",
	},
	{
		deep: "#423934",
		dark: "#5a4e44",
		mid: "#796755",
		light: "#a08662",
	},
	{
		deep: "#181425",
		dark: "#423934",
		mid: "#5a4e44",
		light: "#796755",
	},
	{
		deep: "#5b3138",
		dark: "#8e5252",
		mid: "#ba756a",
		light: "#e9b5a3",
	},
	{
		deep: "#422433",
		dark: "#5b3138",
		mid: "#8e5252",
		light: "#ba756a",
	},
	{
		deep: "#181425",
		dark: "#422433",
		mid: "#5b3138",
		light: "#8e5252",
	},
	{
		deep: "#5b3138",
		dark: "#8e5252",
		mid: "#c28569",
		light: "#fad6b8",
	},
	{
		deep: "#bb7547",
		dark: "#dba463",
		mid: "#f4d29c",
		light: "#fef3c0",
	},
	{
		deep: "#71413b",
		dark: "#bb7547",
		mid: "#dba463",
		light: "#f4d29c",
	},
	{
		deep: "#3f2832",
		dark: "#71413b",
		mid: "#bb7547",
		light: "#dba463",
	},
	{
		deep: "#e86a73",
		dark: "#f5a097",
		mid: "#fad6b8",
		light: "#fef3c0",
	},
	{
		deep: "#e86a73",
		dark: "#f6757a",
		mid: "#f5a097",
		light: "#fad6b8",
	},
	{
		deep: "#68386c",
		dark: "#b55088",
		mid: "#e86a73",
		light: "#f5a097",
	},
	{
		deep: "#262b44",
		dark: "#68386c",
		mid: "#b55088",
		light: "#f5a097",
	},
	{
		deep: "#181425",
		dark: "#262b44",
		mid: "#68386c",
		light: "#b55088",
	},
	{
		deep: "#181425",
		dark: "#262b44",
		mid: "#3a4466",
		light: "#5a6988",
	},
	{
		deep: "#262b44",
		dark: "#3a4466",
		mid: "#5a6988",
		light: "#8b9bb4",
	},
	{
		deep: "#3a4466",
		dark: "#5a6988",
		mid: "#8b9bb4",
		light: "#c0cbdc",
	},
	{
		deep: "#5a6988",
		dark: "#8b9bb4",
		mid: "#c0cbdc",
		light: "#ffffff",
	},
	{
		deep: "#124e89",
		dark: "#0095e9",
		mid: "#2ce8f5",
		light: "#ffffff",
	},
	{
		deep: "#262b44",
		dark: "#124e89",
		mid: "#0095e9",
		light: "#2ce8f5",
	},
	{
		deep: "#181425",
		dark: "#262b44",
		mid: "#124e89",
		light: "#0095e9",
	},
	{
		deep: "#181425",
		dark: "#193c3e",
		mid: "#265c42",
		light: "#3e8948",
	},
	{
		deep: "#193c3e",
		dark: "#265c42",
		mid: "#3e8948",
		light: "#63c74d",
	},
	{
		deep: "#265c42",
		dark: "#3e8948",
		mid: "#63c74d",
		light: "#fef3c0",
	},
	{
		deep: "#be4a2f",
		dark: "#f77622",
		mid: "#feae34",
		light: "#fef3c0",
	},
	{
		deep: "#9e2835",
		dark: "#be4a2f",
		mid: "#f77622",
		light: "#feae34",
	},
	{
		deep: "#422433",
		dark: "#9e2835",
		mid: "#be4a2f",
		light: "#f77622",
	},
	{
		deep: "#3f2832",
		dark: "#9e2835",
		mid: "#e43b44",
		light: "#f5a097",
	}
	
]

export const PALETTE_VARIATIONS: Record<PaletteCategory, Tone[]> = {
	skin: SKIN_PALETTES,
	hair: HAIR_PALETTES,
	outer_body: [],
}

export function hexToRgb(hex: Hex): { r: number; g: number; b: number } {
  const h = hex.replace("#", "")
  const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}
