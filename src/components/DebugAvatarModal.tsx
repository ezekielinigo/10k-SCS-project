import { useEffect, useMemo, useState, useRef } from "react"
import ModalShell from "./ModalShell"
import { SKIN_PALETTES, PALETTE_VARIATIONS } from "../utils/palettes"
import type { PaletteCategory } from "../utils/palettes"
import { paletteSwapSkinImage, paletteSwapHairImage, maskMapColorFromOriginal } from "../utils/paletteSwap"
import { BASE_PALETTE } from "../utils/palettes"

// Render order keys (including BODY_BACK/BODY_FRONT for sandwiching around SHAPE)
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
  "H_SIDE",
  "H_FRONT",
  "BODY_FRONT",
  "ACCESSORY",
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
  const [activeCategory, setActiveCategory] = useState<PaletteCategory>("skin")
  const [swappedSkinSrcs, setSwappedSkinSrcs] = useState<Record<string, string>>({})
  const [swappedHairSrcs, setSwappedHairSrcs] = useState<Record<string, string>>({})
  // Version guards to avoid committing stale computations
  const skinTaskIdRef = useRef(0)
  const hairTaskIdRef = useRef(0)

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

  const reset = () => {
    setIndices((prev) => {
      const next: Record<ControlKey, number> = { ...prev }
      for (const ctl of CONTROLS) next[ctl.key] = 0
      return next
    })
    setSkinPaletteIndex(null)
    setHairPaletteIndex(null)
    setSwappedSkinSrcs({})
    setSwappedHairSrcs({})
  }

  const SKIN_KEYS: RenderKey[] = [
    "SHAPE",
    "NECK",
    "BODY_INNER",
    "NOSE",
    "MOUTH",
    "BODY_BACK",
    "BODY_FRONT",
  ]
  const HAIR_KEYS: RenderKey[] = ["H_BACK", "H_SIDE", "H_FRONT", "EYEBROWS"]

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

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (hairPaletteIndex == null || (PALETTE_VARIATIONS.hair?.length ?? 0) === 0) return
      const target = (PALETTE_VARIATIONS.hair ?? [])[hairPaletteIndex]
      const updates: Record<string, string> = {}

      const collectSrcForKey = (rk: RenderKey): string | undefined => {
        const arr = charOptions[rk] ?? []
        const idx = indices[rk as ControlKey] ?? 0
        return arr.length ? arr[idx % arr.length] : undefined
      }

      const srcs = HAIR_KEYS.map(collectSrcForKey).filter(Boolean) as string[]
      const unique = Array.from(new Set(srcs))
      await Promise.all(
        unique.map(async (src) => {
          try {
            const url = await paletteSwapHairImage(src, target, 18)
            updates[src] = url
          } catch (e) {
            // ignore
          }
        })
      )
      if (!cancelled) setSwappedHairSrcs((prev) => ({ ...prev, ...updates }))
    }
    run()
    return () => {
      cancelled = true
    }
  }, [hairPaletteIndex, indices, charOptions])

  return (
    <ModalShell open={open} onClose={onClose} durationMs={200} style={{ padding: "0.75rem", minWidth: 320, borderRadius: 10, background: "#0c0c0f", border: "1px solid #333" }}>
      {({ requestClose }) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Debug Avatar Mixer</strong>
            <button onClick={requestClose} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 120px", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ zoom: 2, position: "relative", width: 120, height: 120, background: "#1a1a1f", border: "1px solid #333", borderRadius: 8, overflow: "hidden", boxShadow: "0 6px 20px rgba(0,0,0,0.35)" }}>
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
                    if (src && hairPaletteIndex !== null && HAIR_KEYS.includes(rk)) {
                      src = swappedHairSrcs[src] ?? src
                    }
                    if (src && skinPaletteIndex !== null && SKIN_KEYS.includes(rk)) {
                      src = swappedSkinSrcs[src] ?? src
                    }
                  if (!src) return null
                  return (
                    <img
                      key={rk}
                      src={src}
                      alt={rk}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }}
                    />
                  )
                })}
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button onClick={randomize} style={{ flex: 1, padding: "4px 6px", fontSize: 12 }}>Random</button>
                <button onClick={reset} style={{ flex: 1, padding: "4px 6px", fontSize: 12 }}>Reset</button>
              </div>

              {(() => {
                const categories: PaletteCategory[] = ["skin", ...(PALETTE_VARIATIONS.hair?.length ? (["hair"]) as PaletteCategory[] : [])]
                const currentIdx = Math.max(0, categories.indexOf(activeCategory))
                const labelMap: Record<PaletteCategory, string> = { skin: "Skin", hair: "Hair", outer_body: "Outer" }
                const palettes = activeCategory === "skin" ? SKIN_PALETTES : (PALETTE_VARIATIONS[activeCategory] ?? [])
                const selectedIndex = activeCategory === "skin" ? skinPaletteIndex : hairPaletteIndex
                const setIndex = (idx: number) => {
                  if (activeCategory === "skin") setSkinPaletteIndex(idx)
                  else if (activeCategory === "hair") setHairPaletteIndex(idx)
                }
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6 }}>
                      <button onClick={() => {
                        const next = (currentIdx - 1 + categories.length) % categories.length
                        setActiveCategory(categories[next])
                      }}>◀</button>
                      <div style={{ flex: 1, textAlign: "center", fontSize: 12, opacity: 0.9 }}>{labelMap[activeCategory]}</div>
                      <button onClick={() => {
                        const next = (currentIdx + 1) % categories.length
                        setActiveCategory(categories[next])
                      }}>▶</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                      {palettes.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => setIndex(idx)}
                          style={{
                            width: "100%",
                            aspectRatio: "5 / 3",
                            border: selectedIndex === idx ? "2px solid #fff" : "1px solid #666",
                            borderRadius: 4,
                            padding: 0,
                            overflow: "hidden",
                            display: "grid",
                            gridTemplateRows: "1fr 1fr",
                          }}
                        >
                          <div style={{ background: p.dark }} />
                          <div style={{ background: p.mid }} />
                        </button>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>

            <div style={{ flex: 1, minWidth: 260, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.4rem 0.6rem" }}>
              {CONTROLS.map((ctl) => {
                const len = getCountForControl(ctl.key)
                const hasOptions = len > 0
                const idx = indices[ctl.key] ?? 0
                const countText = `${hasOptions ? idx + 1 : 0}/${len}`
                return (
                  <div key={ctl.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ flex: 1 }}>{ctl.label}</div>
                    <button disabled={!hasOptions} onClick={() => cycle(ctl.key, -1)}>◀</button>
                    <span style={{ minWidth: 64, textAlign: "center", opacity: hasOptions ? 0.9 : 0.6 }}>{countText}</span>
                    <button disabled={!hasOptions} onClick={() => cycle(ctl.key, 1)}>▶</button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
