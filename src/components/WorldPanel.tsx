import React, { useState, useEffect } from "react"
import { View, Text, StyleSheet, LayoutChangeEvent, GestureResponderEvent, Pressable } from "react-native"
import { Canvas, Image as SkiaImage, useImage, useTouchHandler, Skia, FilterMode, MipmapMode } from "@shopify/react-native-skia"
import { Scan } from 'lucide-react-native'
import fontConfig from "@shared/utils/fontConfig"
import { useGame } from "@shared/game/engine/GameContext"
import DISTRICTS, { getDistrictById } from "@shared/game/content/districts"
import pngSampler from "../utils/pngSampler"

const FACES = fontConfig.fontFaceNames()

const COLOR_LABELS: Record<string, string> = {
  "#e43b44": "redlined_cermieshaven",
  "#f77622": "capital_c23",
  "#fee761": "capital_c1",
  "#63c74d": "redlined_cliffcity",
  "#0095e9": "redlined_sanctuary",
  "#3e8948": "deadzone_centralsitezero",
  "#124e89": "fallen_oldminingdistrict",
  "#2ce8f5": "redlined_chodanshell",
}

function SkiaMap({ onColor, displaySize, currentDistrictId, onReady }: { onColor: (hex: string) => void; displaySize: { w: number; h: number }; currentDistrictId?: string | null; onReady?: () => void }) {
  const gfx = useImage(require("../assets/map_gfx.png"))
  const idMap = useImage(require("../assets/map_ID.png"))
  const readyOnceRef = React.useRef(false)

  useEffect(() => {
    if (readyOnceRef.current) return
    if (!gfx) return
    readyOnceRef.current = true
    onReady?.()
  }, [gfx, onReady])

  const getDim = (img: any) => {
    if (!img) return null
    try {
      const w = typeof img.width === "function" ? img.width() : img.width
      const h = typeof img.height === "function" ? img.height() : img.height
      return { w, h }
    } catch (e) {
      return null
    }
  }

  const dims = React.useMemo(() => {
    const gfxDim = getDim(gfx)
    const baseSize = gfxDim ? (gfxDim.w || gfxDim.h || 128) : 128
    // fill as much as possible without cropping: square side capped by min(width, height)
    const availW = Math.max(0, Math.floor(displaySize.w || baseSize))
    const availH = Math.max(0, Math.floor(displaySize.h || baseSize))
    // Prefer integer scaling for pixel-art: snap side to integer * baseSize when possible
    const candidateSide = Math.max(1, Math.min(availW, availH))
    const integerScale = Math.floor(candidateSide / baseSize)
    const side = integerScale >= 1 ? Math.max(1, integerScale * baseSize) : candidateSide
    const idDim = getDim(idMap)
    return { gfxDim, idDim, baseSize, integerScale, side }
  }, [gfx, idMap, displaySize])

  // Per-district pin positions (normalized 0..1 relative to the source image)
  // Add or tweak these entries to fine-tune pin placement for each district id.
  const PIN_COORDS: Record<string, { x: number; y: number }> = {
    redlined_cermieshaven: { x: 0.09, y: 0.18 },
    capital_c23: { x: 0.63, y: 0.24 },
    capital_c1: { x: 0.77, y: 0.40 },
    redlined_cliffcity: { x: 0.83, y: 0.70 },
    redlined_sanctuary: { x: 0.32, y: 0.75 },
    deadzone_centralsitezero: { x: 0.50, y: 0.43 },
    fallen_oldminingdistrict: { x: 0.15, y: 0.53 },
    redlined_chodanshell: { x: 0.11, y: 0.37 },
  }

  const handleTouch = async (pt: any) => {
    if (!idMap || !gfx || !dims.idDim) {
      onColor("(no-idmap-or-gfx)")
      return
    }

    const side = Math.max(1, dims.side)
    const imgW = dims.idDim.w
    const imgH = dims.idDim.h

    const ix = Math.min(imgW - 1, Math.max(0, Math.floor((pt.x / side) * imgW)))
    const iy = Math.min(imgH - 1, Math.max(0, Math.floor((pt.y / side) * imgH)))

    try {
      const rp = (idMap as any).readPixels
      let pixels: Uint8Array | undefined
      if (typeof rp === "function") {
        // Try numeric args first (common signature)
        try {
          pixels = rp.call(idMap, ix, iy, 1, 1)
        } catch (err1) {
          // numeric signature failed
        }
        // If numeric args failed or returned falsy, try object signature
        if (!pixels) {
          try {
            pixels = rp.call(idMap, { x: ix, y: iy, width: 1, height: 1 })
          } catch (err2) {
            // object signature failed
          }
        }
      }
      if (!pixels) {
        try {
          const png = await pngSampler.loadPngPixels(require("../assets/map_ID.png"))
          const sample = pngSampler.samplePixel(png, ix, iy)
          if (sample) {
            const { r, g, b, a } = sample
            const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
            const label = COLOR_LABELS[hex.toLowerCase()] ?? `Unknown (${hex})`
            onColor(label)
            return
          }
        } catch (err) {
          // png fallback failed
        }
        onColor("(readPixels-missing)")
        return
      }
      if (pixels.length >= 4) {
        const r = pixels[0]
        const g = pixels[1]
        const b = pixels[2]
        const a = pixels[3]
        const hex =
          "#" +
          [r, g, b]
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("")
        const label = COLOR_LABELS[hex.toLowerCase()] ?? `Unknown (${hex})`
        onColor(label)
      } else {
        onColor("(no-pixels-read)")
      }
      } catch (err) {
      onColor(`(read-error ${String(err)})`)
    }
  }

  const touchHandler = typeof useTouchHandler === "function"
    ? useTouchHandler({ onStart: handleTouch, onActive: handleTouch, onEnd: handleTouch })
    : undefined

  const fallbackTouch = (e: GestureResponderEvent) => {
    // Use RN responder as fallback when Skia useTouchHandler is unavailable
    const pt = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
    handleTouch(pt)
  }

  const nearestPaint = React.useMemo(() => {
    const p = Skia.Paint()
    if (p.setFilterMode) p.setFilterMode(Skia.FilterMode.Nearest)
    if (p.setMipmapMode) p.setMipmapMode(Skia.MipmapMode.None)
    return p
  }, [])

    return gfx ? (
      <View style={{ width: dims.side, height: dims.side, alignSelf: "center", borderRadius: 8, overflow: "hidden" }}>
        <Canvas style={{ width: dims.side, height: dims.side, backgroundColor: "#111", borderRadius: 8 }} onTouch={touchHandler}>
          <SkiaImage
            image={gfx}
            x={0}
            y={0}
            width={dims.side}
            height={dims.side}
            paint={nearestPaint}
            fit="fill"
            sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
          />
        </Canvas>

        {/* Player pin — render at normalized coords for the provided district id (if available) */}
        {currentDistrictId ? (() => {
          const coord = PIN_COORDS[currentDistrictId]
          if (!coord) return null
          const iconSize = 20
          const nx = coord.x
          const ny = coord.y
          const left = Math.round(nx * dims.side) - Math.round(iconSize / 2)
          const top = Math.round(ny * dims.side) - Math.round(iconSize / 2)
          return (
            <View pointerEvents="none" style={{ position: 'absolute', left, top, width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' }}>
              <Scan size={iconSize} color="#e43b44" />
            </View>
          )
        })() : null}

        <View
          style={{ position: "absolute", width: dims.side, height: dims.side, backgroundColor: "transparent", borderRadius: 8 }}
          collapsable={false}
          pointerEvents="box-only"
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={fallbackTouch}
          onResponderMove={fallbackTouch}
          onResponderRelease={fallbackTouch}
          onTouchStart={fallbackTouch}
          onTouchMove={fallbackTouch}
          onTouchEnd={fallbackTouch}
        />
      </View>
    ) : (
      <Text style={{ color: "#c9cdd8" }}>Loading map…</Text>
    )
}

export default function WorldPanel({ onReady }: { onReady?: () => void }) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null)
  const { state, dispatch } = useGame()
  const [skiaAvailable, setSkiaAvailable] = React.useState<boolean | null>(null)
  const [mapReady, setMapReady] = React.useState(false)
  const panelReadyOnceRef = React.useRef(false)

  React.useEffect(() => {
    try {
      // @ts-ignore
      if (typeof globalThis !== "undefined" && typeof (globalThis as any).__SKIA_AVAILABLE__ !== "undefined") {
        // @ts-ignore
        const g = (globalThis as any).__SKIA_AVAILABLE__
        setSkiaAvailable(Boolean(g))
        return
      }
    } catch (err) {
      // ignore
    }

    setSkiaAvailable(true)
  }, [])

  React.useEffect(() => {
    if (panelReadyOnceRef.current) return
    if (skiaAvailable === false) {
      panelReadyOnceRef.current = true
      onReady?.()
      return
    }
    if (skiaAvailable && mapReady) {
      panelReadyOnceRef.current = true
      onReady?.()
    }
  }, [mapReady, onReady, skiaAvailable])

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize({ w: width, h: Math.max(100, height - 56) })
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Text style={styles.title}>You are currently in {getDistrictById(state.player?.currentDistrict ?? "")?.name ?? "Unknown"}</Text>

      <View style={styles.mapContainer}>
        {skiaAvailable === false ? (
          <Text style={styles.body}>
            Skia not installed. Install @shopify/react-native-skia to enable map touch sampling.
          </Text>
        ) : (
          <SkiaMap
            onColor={(label) => {
              // label is expected to be a district id from COLOR_LABELS
              setSelectedDistrictId(label)
            }}
            displaySize={size}
            currentDistrictId={state.player?.currentDistrict ?? null}
            onReady={() => setMapReady(true)}
          />
        )}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.name}>{getDistrictById(selectedDistrictId ?? state.player?.currentDistrict ?? "")?.name ?? "Unknown"}</Text>
        <Text style={styles.body}>{getDistrictById(selectedDistrictId ?? state.player?.currentDistrict ?? "")?.description ?? ""}</Text>
      </View>
      
      <Pressable
        style={styles.action}
        onPress={() => {
          const target = selectedDistrictId ?? state.player?.currentDistrict ?? null
          if (!target) return
          dispatch({ type: "SET_PLAYER_DISTRICT", districtId: target })
          setSelectedDistrictId(null)
        }}
      >
        <Text style={styles.actionText}>Travel</Text>
      </Pressable>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: "relative", flex: 1, backgroundColor: "#0c0f18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#1d2435" },
  title: { color: "#f5f6fb", fontFamily: FACES?.BOLD, fontSize: 16, marginBottom: 8 },
  body: { color: "#c9cdd8" },
  mapContainer: { flex: 0, alignItems: "center", justifyContent: "flex-start", overflow: "hidden", borderRadius: 8, padding: 8 },
  infoBox: { marginTop: 8 },
  name: { color: "#fff", fontFamily: FACES?.BOLD, fontSize: 14, marginBottom: 6 },
  action: { position: "absolute", right: 18, bottom: 18, backgroundColor: "#1b5cff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: "#fff", fontFamily: FACES?.BOLD },
  debug: { color: "#c9cdd8", marginTop: 12, fontFamily: FACES?.REGULAR },
})
