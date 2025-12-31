import { useEffect, useMemo, useState, useRef } from "react"
import { FiChevronLeft, FiChevronRight } from "react-icons/fi"
import ModalShell from "./ModalShell"
import { SKIN_PALETTES, PALETTE_VARIATIONS } from "../utils/palettes"
import type { PaletteCategory } from "../utils/palettes"
import { paletteSwapSkinImage, paletteSwapHairImage, paletteSwapCategoryImage, maskMapColorFromOriginal } from "../utils/paletteSwap"
import { BASE_PALETTE } from "../utils/palettes"

// Render order keys (back to front)
const RENDER_ORDER = [
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

// Controls shown in UI (single OUTER_BODY drives both BODY_BACK/BODY_FRONT)
const CONTROLS = [
  { key: "BG", label: "Background" },
  { key: "SHAPE", label: "Base" },
  { key: "NECK", label: "Neck" },
  { key: "OUTER_BODY", label: "Outer Body" },
  { key: "BODY_INNER", label: "Inner Body" },
  { key: "EYES", label: "Eyes" },
  { key: "EYEBROWS", label: "Eyebrows" },
  { key: "NOSE", label: "Nose" },
  { key: "MOUTH", label: "Mouth" },
  { key: "H_BACK", label: "Hair Back" },
  { key: "H_SIDE", label: "Hair Side" },
  { key: "H_FRONT", label: "Hair Front" },
  { key: "H_ACCESSORY", label: "Hair Accessory" },
  { key: "ACCESSORY", label: "Accessory" },
] as const

type RenderKey = typeof RENDER_ORDER[number]
type ControlKey = typeof CONTROLS[number]["key"]
type CharOptionsMap = Record<string, string[]>

const CONTROL_LABELS = Object.fromEntries(
  CONTROLS.map((ctl) => [ctl.key, ctl.label])
) as Record<ControlKey, string>

function controlToCategory(key: ControlKey): PaletteCategory | null {
  switch (key) {
    case "H_BACK":
    case "H_SIDE":
    case "H_FRONT":
    case "H_ACCESSORY":
    case "EYEBROWS":
      return "hair"
    case "EYES":
      return "eyes"
    case "ACCESSORY":
      return "accessory"
    case "OUTER_BODY":
      return "outer_body"
    case "BODY_INNER":
      return "inner_body"
    case "SHAPE":
    case "NECK":
    case "NOSE":
    case "MOUTH":
      return "skin"
    default:
      return null
  }
}

type Props = {
  open: boolean
  onClose: () => void
}

const modules = import.meta.glob("../assets/characters/**/*.{png,jpg,jpeg,webp,svg}", { eager: true, import: "default" }) as Record<string, string>

function buildCharOptions(): CharOptionsMap {
  const options: CharOptionsMap = {}
  for (const [path, src] of Object.entries(modules)) {
    const parts = path.split("/")
    const folder = parts.at(-2)
    if (!folder) continue
    const key = folder.toUpperCase()
    const arr = options[key] ?? (options[key] = [])
    arr.push(src)
  }
  for (const k of Object.keys(options)) options[k] = options[k].slice().sort()
  return options
}

export default function DebugAvatarModal({ open, onClose }: Props) {
  const charOptions = useMemo(buildCharOptions, [])
  // Helper to ensure images are decoded before committing state
  const decodeImage = async (url: string): Promise<void> => {
    const img = new Image()
    img.src = url
    if (typeof img.decode === "function") {
      try {
        await img.decode()
      } catch {
        // ignore decode errors; browser will still attempt to render
      }
    } else {
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
    }
  }

  const [indices, setIndices] = useState<Record<ControlKey, number>>(() => {
    const initial = {} as Record<ControlKey, number>
    for (const ctl of CONTROLS) initial[ctl.key] = 0
    return initial
  })
  const [skinPaletteIndex, setSkinPaletteIndex] = useState<number | null>(null)
  const [hairPaletteIndex, setHairPaletteIndex] = useState<number | null>(null)
  const [eyesPaletteIndex, setEyesPaletteIndex] = useState<number | null>(null)
  const [accessoryPaletteIndex, setAccessoryPaletteIndex] = useState<number | null>(null)
  const [outerBodyPaletteIndex, setOuterBodyPaletteIndex] = useState<number | null>(null)
  const [innerBodyPaletteIndex, setInnerBodyPaletteIndex] = useState<number | null>(null)
  // activeCategory removed; palette follows `activeControl`
  const [activeControl, setActiveControl] = useState<ControlKey>("SHAPE")
  const [controlMenuOpen, setControlMenuOpen] = useState(false)
  const [swappedSkinSrcs, setSwappedSkinSrcs] = useState<Record<string, string>>({})
  const [swappedHairSrcs, setSwappedHairSrcs] = useState<Record<string, string>>({})
  const [swappedEyeSrcs, setSwappedEyeSrcs] = useState<Record<string, string>>({})
  const [swappedAccessorySrcs, setSwappedAccessorySrcs] = useState<Record<string, string>>({})
  const [swappedOuterBodySrcs, setSwappedOuterBodySrcs] = useState<Record<string, string>>({})
  const [swappedInnerBodySrcs, setSwappedInnerBodySrcs] = useState<Record<string, string>>({})
  // Version guards to avoid committing stale computations
  const skinTaskIdRef = useRef(0)
  const hairTaskIdRef = useRef(0)
  const eyesTaskIdRef = useRef(0)
  const accessoryTaskIdRef = useRef(0)
  const outerBodyTaskIdRef = useRef(0)
  const innerBodyTaskIdRef = useRef(0)

  const getCountForControl = (key: ControlKey): number => {
    if (key === "OUTER_BODY") {
      const backLen = (charOptions["BODY_BACK"] ?? []).length
      const frontLen = (charOptions["BODY_FRONT"] ?? []).length
      return Math.min(backLen, frontLen)
    }
    return (charOptions[key] ?? []).length
  }

  const cycle = (key: ControlKey, delta: number) => {
    const len = getCountForControl(key)
    if (!len) return
    setIndices((prev) => {
      const next = ((prev[key] ?? 0) + delta + len) % len
      return { ...prev, [key]: next }
    })
  }

  const randomize = () => {
    setIndices((prev) => {
      const next: Record<ControlKey, number> = { ...prev }
      for (const ctl of CONTROLS) {
        const len = getCountForControl(ctl.key)
        if (!len) continue
        next[ctl.key] = Math.floor(Math.random() * len)
      }
      return next
    })
  }

  const randomizeColors = () => {
    // Randomize available palette categories; skip if none present
    const rand = (n: number | undefined | null) => (n && n > 0 ? Math.floor(Math.random() * n) : null)
    setSkinPaletteIndex(rand(SKIN_PALETTES.length))
    setHairPaletteIndex(rand(PALETTE_VARIATIONS.hair?.length))
    setEyesPaletteIndex(rand(PALETTE_VARIATIONS.eyes?.length))
    setAccessoryPaletteIndex(rand(PALETTE_VARIATIONS.accessory?.length))
    setOuterBodyPaletteIndex(rand(PALETTE_VARIATIONS.outer_body?.length))
    setInnerBodyPaletteIndex(rand(PALETTE_VARIATIONS.inner_body?.length))
  }

  // reset removed per request

  useEffect(() => {
    if (!controlMenuOpen) return
    const handle = () => setControlMenuOpen(false)
    document.addEventListener("click", handle)
    return () => document.removeEventListener("click", handle)
  }, [controlMenuOpen])

  const SKIN_KEYS: RenderKey[] = [
    "SHAPE",
    "NECK",
    "NOSE",
    "MOUTH",
  ]
  const HAIR_KEYS: RenderKey[] = ["H_BACK", "H_SIDE", "H_FRONT", "EYEBROWS"]
  const EYE_KEYS: RenderKey[] = ["EYES"]
  const ACCESSORY_KEYS: RenderKey[] = ["ACCESSORY", "H_ACCESSORY"]
  const OUTER_BODY_KEYS: RenderKey[] = ["BODY_BACK", "BODY_FRONT"]
  const INNER_BODY_KEYS: RenderKey[] = ["BODY_INNER"]
  const activeControlCount = getCountForControl(activeControl)
  const activeControlIndex = indices[activeControl] ?? 0

  useEffect(() => {
    let cancelled = false
    const taskId = ++skinTaskIdRef.current
    const run = async () => {
      if (skinPaletteIndex == null) return
      const target = SKIN_PALETTES[skinPaletteIndex]
      const updates: Record<string, string> = {}

      const collectSrcForKey = (rk: RenderKey): string | undefined => {
        if (rk === "BODY_BACK") {
          const arr = charOptions["BODY_BACK"] ?? []
          const idx = indices["OUTER_BODY"] ?? 0
          return arr.length ? arr[idx % arr.length] : undefined
        }
        if (rk === "BODY_FRONT") {
          const arr = charOptions["BODY_FRONT"] ?? []
          const idx = indices["OUTER_BODY"] ?? 0
          return arr.length ? arr[idx % arr.length] : undefined
        }
        const arr = charOptions[rk] ?? []
        const idx = indices[rk as ControlKey] ?? 0
        return arr.length ? arr[idx % arr.length] : undefined
      }

      const srcs = SKIN_KEYS.map(collectSrcForKey).filter(Boolean) as string[]
      const unique = Array.from(new Set(srcs))
      await Promise.all(
        unique.map(async (src) => {
          try {
            const url = await paletteSwapSkinImage(src, target, 18)
            await decodeImage(url)
            updates[src] = url
          } catch (e) {
            // ignore
          }
        })
      )
      if (!cancelled && taskId === skinTaskIdRef.current) {
        setSwappedSkinSrcs((prev) => ({ ...prev, ...updates }))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [skinPaletteIndex, indices, charOptions])

  // Hair swap + skin override batched and preloaded; single commit
  useEffect(() => {
    let cancelled = false
    const taskId = ++hairTaskIdRef.current
    const run = async () => {
      // If neither palette index is set and no hair keys present, nothing to do
      const hasHairKeys = HAIR_KEYS.some((rk) => (charOptions[rk] ?? []).length)
      if (!hasHairKeys) return

      const targetHair = hairPaletteIndex != null ? (PALETTE_VARIATIONS.hair ?? [])[hairPaletteIndex] : null
      const hairBaseMisc = BASE_PALETTE.hair?.misc_dark
      const skinTargetDark = skinPaletteIndex != null ? SKIN_PALETTES[skinPaletteIndex]?.dark : null

      const updates: Record<string, string> = {}

      const collectSrcForKey = (rk: RenderKey): string | undefined => {
        const arr = charOptions[rk] ?? []
        const idx = indices[rk as ControlKey] ?? 0
        return arr.length ? arr[idx % arr.length] : undefined
      }

      const srcs = HAIR_KEYS.map(collectSrcForKey).filter(Boolean) as string[]
      const unique = Array.from(new Set(srcs))

      await Promise.all(
        unique.map(async (baseSrc) => {
          try {
            // 1) hair swap (if any)
            const hairUrl = targetHair ? await paletteSwapHairImage(baseSrc, targetHair, 18) : baseSrc
            // 2) skin override on original-mask (if applicable)
            const finalUrl = hairBaseMisc && skinTargetDark
              ? await maskMapColorFromOriginal(baseSrc, hairUrl, hairBaseMisc, skinTargetDark, 18)
              : hairUrl
            // 3) preload final image
            await decodeImage(finalUrl)
            updates[baseSrc] = finalUrl
          } catch (e) {
            // ignore failures; fall back to base
            updates[baseSrc] = baseSrc
          }
        })
      )

      if (!cancelled && taskId === hairTaskIdRef.current) {
        setSwappedHairSrcs((prev) => ({ ...prev, ...updates }))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [hairPaletteIndex, skinPaletteIndex, indices, charOptions])

  // Eyes swap + optional skin misc mapping — run on any avatar update
  useEffect(() => {
    let cancelled = false
    const taskId = ++eyesTaskIdRef.current
    const run = async () => {
      if ((PALETTE_VARIATIONS.eyes?.length ?? 0) === 0) return
      const target = eyesPaletteIndex != null ? (PALETTE_VARIATIONS.eyes ?? [])[eyesPaletteIndex] : null
      const updates: Record<string, string> = {}

      const collectSrcForKey = (rk: RenderKey): string | undefined => {
        const arr = charOptions[rk] ?? []
        const idx = indices[rk as ControlKey] ?? 0
        return arr.length ? arr[idx % arr.length] : undefined
      }

      const srcs = EYE_KEYS.map(collectSrcForKey).filter(Boolean) as string[]
      const unique = Array.from(new Set(srcs))
      const skinTargetDark = skinPaletteIndex != null ? SKIN_PALETTES[skinPaletteIndex]?.dark : null
      const skinTargetMid = skinPaletteIndex != null ? SKIN_PALETTES[skinPaletteIndex]?.mid : null
      const eyeBaseMiscDark = BASE_PALETTE.eyes?.misc_dark
      const eyeBaseMiscMid = BASE_PALETTE.eyes?.misc_mid
      for (const baseSrc of unique) {
        try {
          // If an eye palette is selected, apply it; otherwise use the base image
          let url = target ? await paletteSwapCategoryImage(baseSrc, "eyes", target, 18) : baseSrc
          if (eyeBaseMiscDark && skinTargetDark) {
            url = await maskMapColorFromOriginal(baseSrc, url, eyeBaseMiscDark, skinTargetDark, 18)
          }
          if (eyeBaseMiscMid && skinTargetMid) {
            url = await maskMapColorFromOriginal(baseSrc, url, eyeBaseMiscMid, skinTargetMid, 18)
          }
          await decodeImage(url)
          updates[baseSrc] = url
        } catch {
          // ignore
        }
      }
      if (!cancelled && taskId === eyesTaskIdRef.current) {
        setSwappedEyeSrcs((prev) => ({ ...prev, ...updates }))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [eyesPaletteIndex, skinPaletteIndex, indices, charOptions])

  // Accessory swap with misc -> skin mapping; runs on any avatar update
  useEffect(() => {
    let cancelled = false
    const taskId = ++accessoryTaskIdRef.current
    const run = async () => {
      if ((PALETTE_VARIATIONS.accessory?.length ?? 0) === 0) return
      const target = accessoryPaletteIndex != null ? (PALETTE_VARIATIONS.accessory ?? [])[accessoryPaletteIndex] : null
      const updates: Record<string, string> = {}

      const collectSrcForKey = (rk: RenderKey): string | undefined => {
        const arr = charOptions[rk] ?? []
        const idx = indices[rk as ControlKey] ?? 0
        return arr.length ? arr[idx % arr.length] : undefined
      }

      const srcs = ACCESSORY_KEYS.map(collectSrcForKey).filter(Boolean) as string[]
      const unique = Array.from(new Set(srcs))
      const skinTargetDark = skinPaletteIndex != null ? SKIN_PALETTES[skinPaletteIndex]?.dark : null
      const skinTargetMid = skinPaletteIndex != null ? SKIN_PALETTES[skinPaletteIndex]?.mid : null
      const accBaseMiscDark = BASE_PALETTE.accessory?.misc_dark
      const accBaseMiscMid = BASE_PALETTE.accessory?.misc_mid
      for (const baseSrc of unique) {
        try {
          // apply accessory palette if selected, otherwise use the base image
          let url = target ? await paletteSwapCategoryImage(baseSrc, "accessory", target, 18) : baseSrc
          if (accBaseMiscDark && skinTargetDark) {
            url = await maskMapColorFromOriginal(baseSrc, url, accBaseMiscDark, skinTargetDark, 18)
          }
          if (accBaseMiscMid && skinTargetMid) {
            url = await maskMapColorFromOriginal(baseSrc, url, accBaseMiscMid, skinTargetMid, 18)
          }
          await decodeImage(url)
          updates[baseSrc] = url
        } catch {
          // ignore
        }
      }
      if (!cancelled && taskId === accessoryTaskIdRef.current) {
        setSwappedAccessorySrcs((prev) => ({ ...prev, ...updates }))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [accessoryPaletteIndex, skinPaletteIndex, indices, charOptions])

  // Outer body swap
  useEffect(() => {
    let cancelled = false
    const taskId = ++outerBodyTaskIdRef.current
    const run = async () => {
      if (outerBodyPaletteIndex == null || (PALETTE_VARIATIONS.outer_body?.length ?? 0) === 0) return
      const target = (PALETTE_VARIATIONS.outer_body ?? [])[outerBodyPaletteIndex]
      const updates: Record<string, string> = {}

      const collectSrcForKey = (rk: RenderKey): string | undefined => {
        if (rk === "BODY_BACK" || rk === "BODY_FRONT") {
          const arr = charOptions[rk] ?? []
          const idx = indices["OUTER_BODY"] ?? 0
          return arr.length ? arr[idx % arr.length] : undefined
        }
        const arr = charOptions[rk] ?? []
        const idx = indices[rk as ControlKey] ?? 0
        return arr.length ? arr[idx % arr.length] : undefined
      }

      const srcs = OUTER_BODY_KEYS.map(collectSrcForKey).filter(Boolean) as string[]
      const unique = Array.from(new Set(srcs))
      for (const baseSrc of unique) {
        try {
          const url = await paletteSwapCategoryImage(baseSrc, "outer_body", target, 18)
          await decodeImage(url)
          updates[baseSrc] = url
        } catch {
          // ignore
        }
      }
      if (!cancelled && taskId === outerBodyTaskIdRef.current) {
        setSwappedOuterBodySrcs((prev) => ({ ...prev, ...updates }))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [outerBodyPaletteIndex, indices, charOptions])

  // Inner body swap
  useEffect(() => {
    let cancelled = false
    const taskId = ++innerBodyTaskIdRef.current
    const run = async () => {
      if (innerBodyPaletteIndex == null || (PALETTE_VARIATIONS.inner_body?.length ?? 0) === 0) return
      const target = (PALETTE_VARIATIONS.inner_body ?? [])[innerBodyPaletteIndex]
      const updates: Record<string, string> = {}

      const collectSrcForKey = (rk: RenderKey): string | undefined => {
        const arr = charOptions[rk] ?? []
        const idx = indices[rk as ControlKey] ?? 0
        return arr.length ? arr[idx % arr.length] : undefined
      }

      const srcs = INNER_BODY_KEYS.map(collectSrcForKey).filter(Boolean) as string[]
      const unique = Array.from(new Set(srcs))
      const skinTargetDark = skinPaletteIndex != null ? SKIN_PALETTES[skinPaletteIndex]?.dark : null
      const skinTargetMid = skinPaletteIndex != null ? SKIN_PALETTES[skinPaletteIndex]?.mid : null
      const innerBaseMiscDark = BASE_PALETTE.inner_body?.misc_dark
      const innerBaseMiscMid = BASE_PALETTE.inner_body?.misc_mid
      for (const baseSrc of unique) {
        try {
          let url = target ? await paletteSwapCategoryImage(baseSrc, "inner_body", target, 18) : baseSrc
          // map inner_body misc accents to skin tones when available
          if (innerBaseMiscDark && skinTargetDark) {
            url = await maskMapColorFromOriginal(baseSrc, url, innerBaseMiscDark, skinTargetDark, 18)
          }
          if (innerBaseMiscMid && skinTargetMid) {
            url = await maskMapColorFromOriginal(baseSrc, url, innerBaseMiscMid, skinTargetMid, 18)
          }
          await decodeImage(url)
          updates[baseSrc] = url
        } catch {
          // ignore
        }
      }
      if (!cancelled && taskId === innerBodyTaskIdRef.current) {
        setSwappedInnerBodySrcs((prev) => ({ ...prev, ...updates }))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [innerBodyPaletteIndex, skinPaletteIndex, indices, charOptions])

  return (
    <ModalShell open={open} onClose={onClose} durationMs={200} className="modal-card debug-avatar-modal">
      {({ requestClose }) => (
        <div className="debug-avatar-column">
          {/* header removed (compact vertical layout) */}

          <div className="debug-avatar-column">
            <div className="debug-avatar-preview-wrap">
              <div className="debug-avatar-preview">
                {RENDER_ORDER.map((rk) => {
                  let src: string | undefined
                  if (rk === "BODY_BACK") {
                    const arr = charOptions["BODY_BACK"] ?? []
                    const idx = indices["OUTER_BODY"] ?? 0
                      src = arr[idx % (arr.length || 1)]
                  } else if (rk === "BODY_FRONT") {
                    const arr = charOptions["BODY_FRONT"] ?? []
                    const idx = indices["OUTER_BODY"] ?? 0
                      src = arr[idx % (arr.length || 1)]
                  } else {
                    const arr = charOptions[rk] ?? []
                    const idx = indices[rk as ControlKey] ?? 0
                    src = arr.length ? arr[idx % arr.length] : undefined
                  }
                    if (src && HAIR_KEYS.includes(rk) && swappedHairSrcs[src]) {
                      src = swappedHairSrcs[src] ?? src
                    }
                    if (src && SKIN_KEYS.includes(rk) && swappedSkinSrcs[src]) {
                      src = swappedSkinSrcs[src] ?? src
                    }
                    if (src && EYE_KEYS.includes(rk) && swappedEyeSrcs[src]) {
                      src = swappedEyeSrcs[src] ?? src
                    }
                    if (src && ACCESSORY_KEYS.includes(rk) && swappedAccessorySrcs[src]) {
                      src = swappedAccessorySrcs[src] ?? src
                    }
                    if (src && OUTER_BODY_KEYS.includes(rk) && swappedOuterBodySrcs[src]) {
                      src = swappedOuterBodySrcs[src] ?? src
                    }
                    if (src && INNER_BODY_KEYS.includes(rk) && swappedInnerBodySrcs[src]) {
                      src = swappedInnerBodySrcs[src] ?? src
                    }
                  if (!src) return null
                  return (
                    <img key={rk} src={src} alt={rk} className="debug-avatar-img" />
                  )
                })}
              </div>
            </div>
            <div className="debug-avatar-row-space">
              <button onClick={randomize} className="debug-avatar-btn-small">Random</button>
              <button onClick={randomizeColors} className="debug-avatar-btn-small">Random Colors</button>
            </div>

            <div className="debug-avatar-controls">
              <div className="debug-avatar-control-row">
                <button onClick={() => cycle(activeControl, -1)} className="debug-avatar-chevron-btn" aria-label="Previous"><FiChevronLeft /></button>
                <div className="debug-avatar-control-inner">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setControlMenuOpen((prev) => !prev)
                    }}
                    className="debug-avatar-menu-btn"
                  >
                    {CONTROL_LABELS[activeControl]} {activeControlCount ? `${activeControlIndex + 1}/${activeControlCount}` : "0/0"}
                  </button>
                  {controlMenuOpen && (
                    <div onClick={(e) => e.stopPropagation()} className="debug-avatar-menu hide-scrollbar">
                      {CONTROLS.map((ctl) => {
                        const len = getCountForControl(ctl.key)
                        const idx = indices[ctl.key] ?? 0
                        return (
                          <button
                            key={ctl.key}
                            onClick={() => {
                              setActiveControl(ctl.key)
                              setControlMenuOpen(false)
                            }}
                            className="debug-avatar-control"
                          >
                            <span className="debug-avatar-control-label">{ctl.label}</span>
                            <span className="debug-avatar-control-count">{len ? `${idx + 1}/${len}` : "0/0"}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <button onClick={() => cycle(activeControl, 1)} className="debug-avatar-chevron-btn" aria-label="Next"><FiChevronRight /></button>
              </div>

              <div>
                {(() => {
                  const category = controlToCategory(activeControl) ?? "skin"
                  const palettes = category === "skin" ? SKIN_PALETTES : (PALETTE_VARIATIONS[category] ?? [])
                  const selectedIndex = (() => {
                    switch (category) {
                      case "skin": return skinPaletteIndex
                      case "hair": return hairPaletteIndex
                      case "eyes": return eyesPaletteIndex
                      case "accessory": return accessoryPaletteIndex
                      case "outer_body": return outerBodyPaletteIndex
                      case "inner_body": return innerBodyPaletteIndex
                      default: return null
                    }
                  })()
                  const setIndex = (idx: number) => {
                    switch (category) {
                      case "skin": setSkinPaletteIndex(idx); break
                      case "hair": setHairPaletteIndex(idx); break
                      case "eyes": setEyesPaletteIndex(idx); break
                      case "accessory": setAccessoryPaletteIndex(idx); break
                      case "outer_body": setOuterBodyPaletteIndex(idx); break
                      case "inner_body": setInnerBodyPaletteIndex(idx); break
                    }
                  }
                  return (
                    <div className="debug-avatar-palette-scroll hide-scrollbar">
                      <div className="debug-avatar-palette-grid">
                        {palettes.map((p, idx) => (
                          <button
                            key={idx}
                            onClick={() => setIndex(idx)}
                            className={`debug-avatar-palette-btn ${selectedIndex === idx ? "selected" : ""}`}
                          >
                            <div style={{ background: p.dark }} />
                            <div style={{ background: p.mid }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* control list removed — palette follows active control */}
            </div>

            <div className="debug-avatar-done-wrap">
              <button onClick={requestClose} className="debug-avatar-done-btn">Done</button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
