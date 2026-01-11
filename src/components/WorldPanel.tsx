import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  Image as RNImage,
  GestureResponderEvent,
} from "react-native"
import { Canvas, Image as SkiaImage, useImage, useTouchHandler } from "@shopify/react-native-skia"
import fontConfig from "@shared/utils/fontConfig"
import pngSampler from "../utils/pngSampler"

const FACES = fontConfig.fontFaceNames()

function SkiaMap({ onColor, displaySize }: { onColor: (hex: string) => void; displaySize: { w: number; h: number } }) {
  const gfx = useImage(require("../assets/map_gfx.png"))
  const idMap = useImage(require("../assets/map_ID.png"))

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
    const maxFit = Math.min(displaySize.w || baseSize, displaySize.h || baseSize)
    const integerScale = Math.floor(maxFit / baseSize)
    const side = integerScale >= 1 ? baseSize * integerScale : Math.max(1, Math.floor(maxFit))
    const idDim = getDim(idMap)
    return { gfxDim, idDim, baseSize, maxFit, integerScale, side }
  }, [gfx, idMap, displaySize])

  useEffect(() => {
    // image dims updated
  }, [gfx, idMap, displaySize, dims])

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

    // touch mapped to image coords

    try {
      const rp = (idMap as any).readPixels
      // attempt native readPixels
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
        // native readPixels missing or returned empty; try JS-decoding fallback
        try {
          const png = await pngSampler.loadPngPixels(require("../assets/map_ID.png"))
          const sample = pngSampler.samplePixel(png, ix, iy)
          if (sample) {
            const { r, g, b, a } = sample
            const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
            onColor(`${hex} (a:${a})`)
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
        onColor(`${hex} (a:${a})`)
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

  // sizing info available in `dims`

  return gfx ? (
    <View style={{ width: dims.side, height: dims.side, borderWidth: 2, borderColor: "#ff4d4d" }}>
      <Canvas style={{ width: dims.side, height: dims.side, backgroundColor: "#111" }} onTouch={touchHandler}>
        <SkiaImage image={gfx} x={0} y={0} width={dims.side} height={dims.side} />
      </Canvas>
      {/* debug overlay removed */}
      {/* Always add RN responder overlay to ensure touches arrive even if Skia handler fails */}
      <View
        style={{ position: "absolute", width: dims.side, height: dims.side, backgroundColor: "transparent" }}
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
      {/* removed duplicated map_gfx RNImage to allow idMap overlay visibility */}
      <Text style={{ position: "absolute", top: 4, left: 4, color: "#fff", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6 }}>MAP DBG</Text>
    </View>
  ) : (
    <Text style={{ color: "#c9cdd8" }}>Loading map…</Text>
  )
}

export default function WorldPanel() {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [debugHex, setDebugHex] = useState<string>("")
  const [skiaAvailable, setSkiaAvailable] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    // Prefer global flag from App init
    try {
      // @ts-ignore
      if (typeof globalThis !== "undefined" && typeof (globalThis as any).__SKIA_AVAILABLE__ !== "undefined") {
        // @ts-ignore
        const g = (globalThis as any).__SKIA_AVAILABLE__
        setSkiaAvailable(Boolean(g))
        console.log("[WorldPanel] skiaAvailable (from global)=", g)
        return
      }
    } catch (err) {
      // ignore
    }

    // Fallback: assume available since module is statically imported. If it fails, component will throw and we can catch in logs.
    setSkiaAvailable(true)
    console.log("[WorldPanel] skiaAvailable fallback=true (static import)")
  }, [])

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize({ w: width, h: Math.max(100, height - 56) })
    console.log("[WorldPanel] onLayout size=", width, height)
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Text style={styles.title}>World</Text>

      <View style={styles.mapContainer}>
        {skiaAvailable === false ? (
          <Text style={styles.body}>
            Skia not installed. Install @shopify/react-native-skia to enable map touch sampling.
          </Text>
        ) : (
          <SkiaMap onColor={setDebugHex} displaySize={size} />
        )}
      </View>

      <Text style={styles.debug}>Touched color: {debugHex}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0c0f18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#1d2435" },
  title: { color: "#f5f6fb", fontFamily: FACES?.BOLD, fontSize: 16, marginBottom: 8 },
  body: { color: "#c9cdd8" },
  mapContainer: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 8 },
  debug: { color: "#c9cdd8", marginTop: 8, fontFamily: FACES?.REGULAR },
})
