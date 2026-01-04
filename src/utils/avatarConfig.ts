import type { PaletteCategory } from "./avatarPaletteConfig"

export const RENDER_ORDER = [
  "BG",
  "H_BACK",
  "BODY_BACK",
  "NECK",
  "SHAPE",
  "BODY_INNER",
  "EYES",
  "EYEBROWS",
  "NOSE",
  "MOUTH",
  "ACCESSORY",
  "H_SIDE",
  "H_FRONT",
  "BODY_FRONT",
  "H_ACCESSORY",
] as const
export type RenderKey = typeof RENDER_ORDER[number]

export const CONTROL_ORDER: { key: ControlKey; label: string }[] = [
  { key: "BG", label: "Background" },
  { key: "SHAPE", label: "Base" },
  { key: "NECK", label: "Neck" },
  { key: "OUTER_BODY", label: "Outer" },
  { key: "BODY_INNER", label: "Inner" },
  { key: "EYES", label: "Eyes" },
  { key: "EYEBROWS", label: "Brows" },
  { key: "NOSE", label: "Nose" },
  { key: "MOUTH", label: "Mouth" },
  { key: "H_BACK", label: "Hair Back" },
  { key: "H_SIDE", label: "Hair Side" },
  { key: "H_FRONT", label: "Hair Front" },
  { key: "H_ACCESSORY", label: "Hair Acc." },
  { key: "ACCESSORY", label: "Accessory" },
]

export type ControlKey = RenderKey | "OUTER_BODY"

export const CONTROL_TO_CATEGORY: Record<ControlKey, PaletteCategory | null> = {
  BG: null,
  H_BACK: "hair",
  BODY_BACK: "outer_body",
  NECK: "skin",
  SHAPE: "skin",
  BODY_INNER: "inner_body",
  EYES: "eyes",
  EYEBROWS: "hair",
  NOSE: "skin",
  MOUTH: "skin",
  ACCESSORY: "accessory",
  H_SIDE: "hair",
  H_FRONT: "hair",
  BODY_FRONT: "outer_body",
  H_ACCESSORY: "accessory",
  OUTER_BODY: "outer_body",
}

export const OUTER_KEYS: RenderKey[] = ["BODY_BACK", "BODY_FRONT"]
