import React, { useMemo, useState, useEffect } from "react"
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native"
import fontConfig from "@shared/utils/fontConfig"
const FACES = fontConfig.fontFaceNames()
import { ChevronLeft, ChevronRight } from "lucide-react-native"
import ModalCard from "./ModalCard"
import manifest from "@shared/assets/characterManifest"
import { GLPaletteSwap } from "../utils/avatarPaletteSwapper"
import type { Tone, PaletteCategory } from "@shared/utils/avatarPaletteConfig"
import { SKIN_PALETTES, PALETTE_VARIATIONS, BASE_PALETTE } from "@shared/utils/avatarPaletteConfig"
import { RENDER_ORDER, type RenderKey, CONTROL_ORDER, CONTROL_TO_CATEGORY, OUTER_KEYS, type ControlKey } from "@shared/utils/avatarConfig"
import { StatusBar } from "expo-status-bar"
import * as NavigationBar from "expo-navigation-bar"

type Props = {
  open: boolean
  onClose: () => void
}

type PaletteSelection = Partial<Record<PaletteCategory, Tone | null>>

function paletteListForCategory(cat: PaletteCategory | null): Tone[] {
  if (!cat) return []
  if (cat === "skin") return SKIN_PALETTES
  return PALETTE_VARIATIONS[cat] ?? []
}

function choose(arr: any[]): any | null {
  if (!arr?.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function AvatarMixerModal({ open, onClose }: Props) {
  useEffect(() => {
    if (Platform.OS !== "android") return
    let cancelled = false
    ;(async () => {
      try {
        if (open) {
          await NavigationBar.setVisibilityAsync("hidden")
        } else {
          await NavigationBar.setVisibilityAsync("visible")
        }
      } catch (e) {
        // ignore
      }
    })()
    return () => {
      if (Platform.OS === "android" && !cancelled) NavigationBar.setVisibilityAsync("visible")
      cancelled = true
    }
  }, [open])
  const [indices, setIndices] = useState<Record<ControlKey, number>>(() => {
    const initial: Record<ControlKey, number> = {
      BG: 0,
      H_BACK: 0,
      BODY_BACK: 0,
      NECK: 0,
      SHAPE: 0,
      BODY_INNER: 0,
      EYES: 0,
      EYEBROWS: 0,
      NOSE: 0,
      MOUTH: 0,
      ACCESSORY: 0,
      H_SIDE: 0,
      H_FRONT: 0,
      BODY_FRONT: 0,
      H_ACCESSORY: 0,
      OUTER_BODY: 0,
    }
    return initial
  })
  const [selection, setSelection] = useState<PaletteSelection>({})
  const [activeControl, setActiveControl] = useState<ControlKey>("SHAPE")

  const layerSources = useMemo(() => manifest, [])

  const randomize = () => {
    const next: Record<ControlKey, number> = { ...indices }
    for (const ctl of CONTROL_ORDER) {
      const arr = ctl.key === "OUTER_BODY" ? (layerSources["BODY_BACK"] ?? []) : (layerSources[ctl.key] ?? [])
      const len = arr.length
      if (len) next[ctl.key] = Math.floor(Math.random() * len)
    }
    setIndices(next)
  }

  const randomizeColors = () => {
    const next: PaletteSelection = {}
    for (const cat of ["skin", "hair", "eyes", "accessory", "outer_body", "inner_body"] as PaletteCategory[]) {
      const list = paletteListForCategory(cat)
      next[cat] = choose(list)
    }
    setSelection(next)
  }

  const cycle = (ctl: ControlKey, delta: number) => {
    const arr = ctl === "OUTER_BODY" ? (layerSources["BODY_BACK"] ?? []) : (layerSources[ctl] ?? [])
    const len = arr.length
    if (!len) return
    setIndices((prev) => ({ ...prev, [ctl]: ((prev[ctl] ?? 0) + delta + len) % len }))
  }

  const renderLayers: { key: RenderKey; src?: any; category: PaletteCategory | null }[] = RENDER_ORDER.map((key) => {
    let srcList = layerSources[key] ?? []
    if (OUTER_KEYS.includes(key)) {
      const outerIdx = indices["OUTER_BODY"] ?? 0
      srcList = layerSources[key] ?? []
      return { key, src: srcList[outerIdx % (srcList.length || 1)], category: CONTROL_TO_CATEGORY[key] }
    }
    const idx = indices[key as ControlKey] ?? 0
    return { key, src: srcList[idx % (srcList.length || 1)], category: CONTROL_TO_CATEGORY[key] }
  })

  const activeCategory = CONTROL_TO_CATEGORY[activeControl]
  const palettes = paletteListForCategory(activeCategory)
  const activePalette = activeCategory ? selection[activeCategory] ?? null : null

  const AVATAR_SIZE = 200

  return (
    <ModalCard open={open} onClose={onClose} title="Avatar Mixer" maxHeight="90%">
      <StatusBar hidden={open} />
      <View style={styles.previewWrap}>
        <View style={[styles.previewBox, { width: AVATAR_SIZE, height: AVATAR_SIZE }]}>
          {renderLayers.map((layer, idx) => {
            if (!layer.src) return null
            const base = layer.category ? BASE_PALETTE[layer.category] : undefined
            const sel = layer.category ? selection[layer.category] ?? null : null
            // Merge selection with skin-driven misc overrides when appropriate
            let target = sel ?? base
            const skinSel = selection["skin"] ?? null
            if (skinSel && layer.category && layer.category !== "skin") {
              const overrides: any = {}
              // map misc_dark/misc_mid/misc_deep/misc_light to skin dark/mid/deep/light when base defines them
              const map: Array<[string, keyof typeof skinSel]> = [
                ["misc_deep", "deep"],
                ["misc_dark", "dark"],
                ["misc_mid", "mid"],
                ["misc_light", "light"],
              ]
              for (const [miscKey, skinKey] of map) {
                // @ts-ignore
                if (base && (base as any)[miscKey]) {
                  // @ts-ignore
                  const skinVal = (skinSel as any)[skinKey]
                  if (skinVal) overrides[miscKey] = skinVal
                }
              }
              if (Object.keys(overrides).length) {
                target = { ...(target ?? {}), ...overrides }
              }
            }
            return (
              <View key={`${layer.key}-${idx}`} style={styles.layer} pointerEvents="none">
                <GLPaletteSwap
                  source={layer.src}
                  baseTone={base}
                  targetTone={target ?? base}
                  tolerance={18}
                  size={AVATAR_SIZE}
                />
              </View>
            )
          })}
        </View>
      </View>

      <View style={styles.controlsRow}>
        <Pressable onPress={() => cycle(activeControl, -1)} style={styles.navBtn}><ChevronLeft color="#fff" size={16} /></Pressable>
        <Text style={styles.activeLabel}>{CONTROL_ORDER.find((c) => c.key === activeControl)?.label}</Text>
        <Pressable onPress={() => cycle(activeControl, 1)} style={styles.navBtn}><ChevronRight color="#fff" size={16} /></Pressable>
      </View>

      <ScrollView horizontal style={styles.controlStrip} contentContainerStyle={{ gap: 8 }}>
        {CONTROL_ORDER.map((ctl) => {
          const arr = ctl.key === "OUTER_BODY" ? (layerSources["BODY_BACK"] ?? []) : (layerSources[ctl.key] ?? [])
          const len = arr.length
          const idx = indices[ctl.key] ?? 0
          return (
            <Pressable key={ctl.key} style={[styles.controlChip, activeControl === ctl.key && styles.controlChipActive]} onPress={() => setActiveControl(ctl.key)}>
              <Text style={styles.controlChipText}>{ctl.label}</Text>
              <Text style={styles.controlChipCount}>{len ? `${idx + 1}/${len}` : "0/0"}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={styles.paletteHeader}>
        <Text style={styles.sectionLabel}>Palette</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={randomizeColors} style={styles.actionBtn}><Text style={styles.actionBtnText}>Shuffle</Text></Pressable>
          <Pressable onPress={randomize} style={styles.actionBtn}><Text style={styles.actionBtnText}>Randomize</Text></Pressable>
        </View>
      </View>

      <ScrollView style={styles.paletteScroll} contentContainerStyle={styles.paletteGrid}>
        {palettes.map((p, idx) => {
          const selected = activePalette === p
          return (
            <Pressable key={idx} style={[styles.paletteBtn, selected && styles.paletteBtnSelected]} onPress={() => {
              if (!activeCategory) return
              setSelection((prev) => ({ ...prev, [activeCategory]: p }))
            }}>
              <View style={[styles.swatch, { backgroundColor: p.dark }]} />
              <View style={[styles.swatch, { backgroundColor: p.mid }]} />
            </Pressable>
          )
        })}
      </ScrollView>
    </ModalCard>
  )
}

const styles = StyleSheet.create({
  previewWrap: { alignItems: "center", marginBottom: 14 },
  previewBox: { width: 200, height: 200, backgroundColor: "#0d0f1a", borderRadius: 16, overflow: "hidden" },
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  controlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  navBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#1b5cff", borderRadius: 8 },
  navBtnText: { color: "#fff", fontFamily: FACES.BOLD },
  activeLabel: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 16 },
  controlStrip: { marginBottom: 12 },
  controlChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: "#161620", borderWidth: 1, borderColor: "#1f2030" },
  controlChipActive: { borderColor: "#1b5cff" },
  controlChipText: { color: "#fff", fontFamily: FACES.BOLD },
  controlChipCount: { color: "#7d8299", fontSize: 12 },
  paletteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionLabel: { color: "#fff", fontFamily: FACES.BOLD, fontSize: 15 },
  actionBtn: { backgroundColor: "#1b5cff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { color: "#fff", fontFamily: FACES.BOLD },
  paletteScroll: { maxHeight: 160 },
  paletteBtn: { flexDirection: "row", gap: 0, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: "#161620", borderWidth: 1, borderColor: "#1f2030" },
  paletteBtnSelected: { borderColor: "#1b5cff" },
  swatch: { width: 16, height: 16, borderRadius: 4 },
  paletteGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", alignItems: "center" },
})
