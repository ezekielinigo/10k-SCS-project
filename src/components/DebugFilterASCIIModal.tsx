import React, { useEffect, useMemo, useState } from "react"
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent, ActivityIndicator, Image as RNImage, ScrollView, TextInput } from "react-native"
import { Canvas, Paragraph, Skia, FontStyle } from "@shopify/react-native-skia"
// Minimal typing shim for upng-js (no @types available)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const UPNG: { decode: (ab: ArrayBuffer) => any; toRGBA8: (img: any) => Uint8Array[] } = require("upng-js")
import ModalCard from "./ModalCard"
import fontConfig from "@shared/utils/fontConfig"

const FACES = fontConfig.fontFaceNames()
const PT_MONO = fontConfig.fontFaceNames("pt-mono").REGULAR
const MAP_GFX = require("../assets/map_gfx.png")

type DitherKind = "none" | "bayer4x4" | "noise" | "floyd-lite"

type AsciiKnobs = {
  targetCols: number
  brightness: number
  contrast: number
  gamma: number
  invert: boolean
  threshold: number
  edgeStrength: number
  dither: DitherKind
  spaceDensity: number
  charSet: string
  directional: boolean
  useAlphaAsMask: boolean
  backgroundChar: string
  fontSize: number
}

const DEFAULT_KNOBS: AsciiKnobs = {
  targetCols: 90,
  brightness: 0,
  contrast: 1.1,
  gamma: 1.2,
  invert: false,
  threshold: 0.18,
  edgeStrength: 1.4,
  dither: "bayer4x4",
  spaceDensity: 0.08,
  charSet: " .-|+",
  directional: false,
  useAlphaAsMask: false,
  backgroundChar: " ",
  fontSize: 8,
}

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

// Preset charset options for quick switching
const CHARSET_PRESETS: { [key: string]: string } = {
  Classic: "@%#*+=-:. ",
  Density: " .:-=+*#%@",
  Shades: " .,:;i1tfLCG08@",
  Blocks: " ░▒▓█",
  Basic: " .-|+",
}
// Multiplier applied to glyph aspect and preview line height
const GLYPH_LINE_MULTIPLIER = 1.1
export default function DebugFilterASCIIModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asciiLines, setAsciiLines] = useState<string[]>([])
  const [paragraph, setParagraph] = useState<any>(null)
  const [canvasWidth, setCanvasWidth] = useState(320)
  const [knobs, setKnobs] = useState<AsciiKnobs>(DEFAULT_KNOBS)
  const fontProvider = useMemo(() => {
    const provider = Skia.TypefaceFontProvider.Make()
    const sys = Skia.FontMgr.System()
    const register = (family: string) => {
      const face = sys.matchFamilyStyle(family, FontStyle.Normal)
      if (face) provider.registerFont(face, family)
    }
    register("Menlo")
    register("Courier")
    register("monospace")
    return provider
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const png = await loadPngPixels(MAP_GFX)
        if (cancelled) return
        const lines = toAscii(knobs, png)
        setAsciiLines(lines)
      } catch (err) {
        setError(String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [open, knobs])

  useEffect(() => {
    if (!asciiLines.length) return
    const paraStyle = {
      textStyle: {
        color: Skia.Color("#c9cdd8"),
        fontFamilies: ["Menlo", "Courier", "monospace"],
        fontSize: 8,
      },
      paragraphStyle: { maxLines: asciiLines.length },
    }
    const builder = Skia.ParagraphBuilder.Make(paraStyle, fontProvider)
    builder.addText(asciiLines.join("\n"))
    const p = builder.build()
    p.layout(canvasWidth)
    setParagraph(p)
  }, [asciiLines, canvasWidth, fontProvider])

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = Math.max(160, Math.floor(e.nativeEvent.layout.width))
    setCanvasWidth(w)
  }

  function updateKnob<K extends keyof AsciiKnobs>(key: K, value: AsciiKnobs[K]) {
    setKnobs((prev) => ({ ...prev, [key]: value }))
  }

  const changeNumber = (key: keyof AsciiKnobs, delta: number, min?: number, max?: number, step = 1) => {
    const cur = (knobs as any)[key]
    if (typeof cur !== "number") return
    let next = Math.round((cur + delta) / step) * step
    if (typeof min === "number") next = Math.max(min, next)
    if (typeof max === "number") next = Math.min(max, next)
    updateKnob(key as any, next as any)
  }

  const DITHER_OPTIONS: DitherKind[] = ["none", "bayer4x4", "noise", "floyd-lite"]
  const cycleDither = () => {
    const i = DITHER_OPTIONS.indexOf(knobs.dither)
    updateKnob("dither", DITHER_OPTIONS[(i + 1) % DITHER_OPTIONS.length])
  }

  const paraHeight = paragraph?.getHeight?.() ?? 0

  function SimpleSlider({
    min = 0,
    max = 1,
    step = 0.01,
    value = 0,
    onValueChange = (v: number) => {},
    style,
  }: {
    min?: number
    max?: number
    step?: number
    value: number
    onValueChange: (v: number) => void
    style?: any
  }) {
    const [width, setWidth] = useState(0)
    const clamp = (v: number) => Math.min(max, Math.max(min, v))
    const toStep = (v: number) => Math.round(v / step) * step

    const handle = (e: any) => {
      if (!width) return
      const x = e.nativeEvent.locationX
      const ratio = clamp01(x / width)
      const v = toStep(min + ratio * (max - min))
      onValueChange(clamp(v))
    }

    const fillRatio = width ? (clamp(value) - min) / (max - min || 1) : 0
    const fillPx = Math.max(0, Math.round(fillRatio * width))
    const thumbLeft = Math.max(0, fillPx - 6)

    return (
      <View style={[styles.sliderContainer, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} onStartShouldSetResponder={() => true} onResponderGrant={handle} onResponderMove={handle}>
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: fillPx }]} />
          <View style={[styles.sliderThumb, { left: thumbLeft }]} />
        </View>
      </View>
    )
  }

  return (
    <ModalCard open={open} onClose={onClose} title="ASCII Filter">
      <View style={styles.container} onLayout={handleLayout}>
        {/* Controls (moved above the preview) - expanded so modal scrolls instead of inner box */}
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Columns</Text>
            <View style={styles.sliderRow}>
              <SimpleSlider style={{ flex: 1 } as any} min={4} max={400} step={1} value={knobs.targetCols} onValueChange={(v: number) => updateKnob("targetCols", Math.round(v))} />
              <Text style={styles.controlValue}>{knobs.targetCols}</Text>
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Brightness</Text>
            <View style={styles.sliderRow}>
              <SimpleSlider style={{ flex: 1 } as any} min={-1} max={1} step={0.01} value={knobs.brightness} onValueChange={(v: number) => updateKnob("brightness", v)} />
              <Text style={styles.controlValue}>{knobs.brightness.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Contrast</Text>
            <View style={styles.sliderRow}>
              <SimpleSlider style={{ flex: 1 } as any} min={0.1} max={6} step={0.05} value={knobs.contrast} onValueChange={(v: number) => updateKnob("contrast", v)} />
              <Text style={styles.controlValue}>{knobs.contrast.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Gamma</Text>
            <View style={styles.sliderRow}>
              <SimpleSlider style={{ flex: 1 } as any} min={0.2} max={3} step={0.05} value={knobs.gamma} onValueChange={(v: number) => updateKnob("gamma", v)} />
              <Text style={styles.controlValue}>{knobs.gamma.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Threshold</Text>
            <View style={styles.sliderRow}>
              <SimpleSlider style={{ flex: 1 } as any} min={0} max={1} step={0.01} value={knobs.threshold} onValueChange={(v: number) => updateKnob("threshold", v)} />
              <Text style={styles.controlValue}>{knobs.threshold.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Edge Strength</Text>
            <View style={styles.sliderRow}>
              <SimpleSlider style={{ flex: 1 } as any} min={0} max={10} step={0.05} value={knobs.edgeStrength} onValueChange={(v: number) => updateKnob("edgeStrength", v)} />
              <Text style={styles.controlValue}>{knobs.edgeStrength.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Space Density</Text>
            <View style={styles.sliderRow}>
              <SimpleSlider style={{ flex: 1 } as any} min={0} max={1} step={0.01} value={knobs.spaceDensity} onValueChange={(v: number) => updateKnob("spaceDensity", v)} />
              <Text style={styles.controlValue}>{knobs.spaceDensity.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Dither</Text>
            <Pressable style={styles.smallButton} onPress={cycleDither}><Text style={styles.buttonText}>{knobs.dither}</Text></Pressable>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>CharSet</Text>
            <View style={{ flex: 1 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
                {Object.keys(CHARSET_PRESETS).map((k) => (
                  <Pressable key={k} style={[styles.presetButton, knobs.charSet === CHARSET_PRESETS[k] ? styles.presetSelected : null]} onPress={() => updateKnob("charSet", CHARSET_PRESETS[k])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={`Charset preset ${k}`}>
                    <Text style={styles.presetButtonText}>{k}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput placeholder="custom charset" placeholderTextColor="#6b7287" style={styles.textInput} value={knobs.charSet} onChangeText={(t) => updateKnob("charSet", t)} />
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Directional</Text>
            <Pressable style={[styles.toggle, knobs.directional ? styles.on : styles.off]} onPress={() => updateKnob("directional", !knobs.directional)}>
              <Text style={styles.buttonText}>{knobs.directional ? "On" : "Off"}</Text>
            </Pressable>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Invert</Text>
            <Pressable style={[styles.toggle, knobs.invert ? styles.on : styles.off]} onPress={() => updateKnob("invert", !knobs.invert)}>
              <Text style={styles.buttonText}>{knobs.invert ? "On" : "Off"}</Text>
            </Pressable>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Use Alpha Mask</Text>
            <Pressable style={[styles.toggle, knobs.useAlphaAsMask ? styles.on : styles.off]} onPress={() => updateKnob("useAlphaAsMask", !knobs.useAlphaAsMask)}>
              <Text style={styles.buttonText}>{knobs.useAlphaAsMask ? "On" : "Off"}</Text>
            </Pressable>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Background Char</Text>
            <TextInput style={styles.textInputSmall} value={knobs.backgroundChar} onChangeText={(t) => updateKnob("backgroundChar", t.slice(0, 1))} />
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Font Size</Text>
            <View style={styles.sliderRow}>
              <SimpleSlider style={{ flex: 1 } as any} min={4} max={20} step={1} value={knobs.fontSize} onValueChange={(v: number) => updateKnob("fontSize", Math.round(v))} />
              <Text style={styles.controlValue}>{knobs.fontSize}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.label}>Map preview (edge-based ASCII)</Text>
        {loading ? (
          <View style={styles.centerRow}><ActivityIndicator color="#1b5cff" /><Text style={styles.loading}>Generating…</Text></View>
        ) : error ? (
          <Text style={styles.error}>Error: {error}</Text>
        ) : asciiLines.length ? (
          // Nested scroll views: vertical outer for rows, horizontal inner for long lines
          (() => {
            const maxCols = Math.max(1, ...asciiLines.map((l) => l.length))
            const fontSize = Math.max(1, Math.round(knobs.fontSize || 8))
            const charWidth = Math.max(1, Math.floor(fontSize * 0.6))
            const contentWidth = Math.max(canvasWidth, maxCols * charWidth)
            // apply multiplier to lineHeight so lines are spaced by the requested factor
            const lineHeight = fontSize * GLYPH_LINE_MULTIPLIER
            const contentHeight = Math.min(600, Math.max(lineHeight, asciiLines.length * lineHeight))
            return (
              <View style={{ width: canvasWidth, height: Math.min(contentHeight, 400), backgroundColor: "#05070e", borderRadius: 8, borderWidth: 1, borderColor: "#1f1f29" }}>
                <ScrollView style={{ flex: 1 }} nestedScrollEnabled>
                  <ScrollView horizontal contentContainerStyle={{ width: contentWidth }} nestedScrollEnabled>
                    <Text style={{ color: "#c9cdd8", fontFamily: PT_MONO, fontSize: fontSize, lineHeight: lineHeight }}>
                      {asciiLines.join("\n")}
                    </Text>
                  </ScrollView>
                </ScrollView>
              </View>
            )
          })()
        ) : (
          <Text style={styles.body}>No ASCII result yet.</Text>
        )}

        <View style={styles.row}>
          <Pressable style={styles.button} onPress={() => setAsciiLines((prev) => [...prev]) /* force rebuild paragraph */}>
            <Text style={styles.buttonText}>Refresh</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => {
            setAsciiLines([])
            setParagraph(null)
            setLoading(true)
            loadPngPixels(MAP_GFX).then((png) => {
              const lines = toAscii({ ...knobs }, png)
              setAsciiLines(lines)
            }).catch((err) => setError(String(err))).finally(() => setLoading(false))
          }}>
            <Text style={styles.buttonText}>Rebuild</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.metaBox}>
          <Text style={styles.metaText}>Cols: {knobs.targetCols} | Dither: {knobs.dither} | Threshold: {knobs.threshold.toFixed(2)}</Text>
          <Text style={styles.metaText}>EdgeStrength: {knobs.edgeStrength.toFixed(2)} | Gamma: {knobs.gamma.toFixed(2)}</Text>
          <Text style={styles.metaText}>Brightness: {knobs.brightness.toFixed(2)} | Contrast: {knobs.contrast.toFixed(2)}</Text>
        </ScrollView>
        
      </View>
    </ModalCard>
  )
}

async function loadPngPixels(moduleRequire: any) {
  const src = RNImage.resolveAssetSource(moduleRequire)
  const uri = src?.uri
  if (!uri) throw new Error("Missing asset URI")
  const res = await fetch(uri)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  const ab = await res.arrayBuffer()
  const img = UPNG.decode(ab)
  const rgbaArr = UPNG.toRGBA8(img)[0]
  return { rgba: new Uint8Array(rgbaArr), width: img.width, height: img.height }
}

function toAscii(knobs: AsciiKnobs, png: { rgba: Uint8Array; width: number; height: number }): string[] {
  const { rgba, width, height } = png
  const luma = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4
    const r = rgba[idx]
    const g = rgba[idx + 1]
    const b = rgba[idx + 2]
    const a = rgba[idx + 3]
    let v = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    if (knobs.useAlphaAsMask) v *= a / 255
    v = applyBrightnessContrastGamma(v, knobs.brightness, knobs.contrast, knobs.gamma)
    if (knobs.invert) v = 1 - v
    luma[i] = clamp01(v)
  }

  const cols = Math.max(4, knobs.targetCols | 0)
  // Derive rows from columns while preserving source aspect and glyph aspect.
  // Estimate glyph aspect from render font size (keep in sync with preview fontSize)
    const fontSizeEstimate = Math.max(1, Math.round(knobs.fontSize || 8))
  const charWidth = Math.max(1, Math.floor(fontSizeEstimate * 0.6))
  const charHeight = Math.max(1, fontSizeEstimate + 2)
  const glyphAspect = (charHeight / charWidth) * GLYPH_LINE_MULTIPLIER

  // rows = (imageHeight / imageWidth) * cols / glyphAspect
  const rows = Math.max(4, Math.max(1, Math.round((height / width) * cols / glyphAspect)))

  // Compute integer cell sizes for bookkeeping (sampling uses fractional mapping below)
  const cellW = Math.max(1, Math.floor(width / cols))
  const cellH = Math.max(1, Math.floor(height / rows))
  const lines: string[] = new Array(rows)

  const threshold = clamp01(knobs.threshold)

  for (let cy = 0; cy < rows; cy++) {
    let line = ""
    for (let cx = 0; cx < cols; cx++) {
      // Fractional mapping: place sample at cell center using float scaling
      const px = clampInt(Math.floor((cx + 0.5) * (width / cols)), 0, width - 1)
      const py = clampInt(Math.floor((cy + 0.5) * (height / rows)), 0, height - 1)
      const { mag, angle } = sobel(luma, width, height, px, py)
      let strength = clamp01(mag * knobs.edgeStrength)
      strength = applyDither(strength, knobs.dither, cx, cy)
      if (strength < threshold) {
        line += knobs.backgroundChar
        continue
      }
      if (Math.random() < knobs.spaceDensity) {
        line += knobs.backgroundChar
        continue
      }
      line += chooseGlyph(strength, angle, knobs)
    }
    lines[cy] = line
  }
  return lines
}

function applyBrightnessContrastGamma(v: number, brightness: number, contrast: number, gamma: number) {
  let x = v + brightness
  x = (x - 0.5) * contrast + 0.5
  x = Math.pow(clamp01(x), Math.max(0.1, gamma))
  return clamp01(x)
}

function sobel(luma: Float32Array, w: number, h: number, x: number, y: number) {
  const sample = (ix: number, iy: number) => luma[clampInt(iy, 0, h - 1) * w + clampInt(ix, 0, w - 1)]
  const tl = sample(x - 1, y - 1), t = sample(x, y - 1), tr = sample(x + 1, y - 1)
  const l = sample(x - 1, y), c = sample(x, y), r = sample(x + 1, y)
  const bl = sample(x - 1, y + 1), b = sample(x, y + 1), br = sample(x + 1, y + 1)
  const gx = -tl - 2 * l - bl + tr + 2 * r + br
  const gy = -tl - 2 * t - tr + bl + 2 * b + br
  const mag = Math.hypot(gx, gy) / 4
  const angle = Math.atan2(gy, gx)
  return { mag, angle, c }
}

function applyDither(val: number, kind: DitherKind, x: number, y: number) {
  if (kind === "none") return val
  if (kind === "noise") return clamp01(val + (Math.random() - 0.5) * 0.08)
  if (kind === "bayer4x4") {
    const m = (BAYER_4X4[y & 3][x & 3] / 16 - 0.5) * 0.08
    return clamp01(val + m)
  }
  if (kind === "floyd-lite") {
    // Minimal diffusion: nudge every other cell to mimic error spread
    const sign = ((x + y) & 1) === 0 ? 1 : -1
    return clamp01(val + 0.04 * sign)
  }
  return val
}

function chooseGlyph(strength: number, angle: number, knobs: AsciiKnobs) {
  if (knobs.directional) {
    const a = Math.abs(Math.cos(angle))
    if (a > 0.75) return "-"
    if (a < 0.25) return "|"
    return angle > 0 ? "/" : "\\"
  }
  const set = knobs.charSet || " .-"
  const idx = Math.min(set.length - 1, Math.floor(strength * set.length))
  return set[idx]
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function clampInt(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v | 0))
}

const styles = StyleSheet.create({
  container: { padding: 12, gap: 12 },
  label: { color: "#c9cdd8", fontFamily: FACES?.REGULAR },
  body: { color: "#c9cdd8", fontFamily: FACES?.REGULAR },
  row: { flexDirection: "row", gap: 8 },
  button: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#10121c", borderWidth: 1, borderColor: "#1f1f29" },
  buttonText: { color: "#fff", fontFamily: FACES?.BOLD },
  loading: { color: "#c9cdd8", marginLeft: 8 },
  centerRow: { flexDirection: "row", alignItems: "center" },
  error: { color: "#ff6b6b", fontFamily: FACES?.REGULAR },
  metaBox: { maxHeight: 80, borderRadius: 8, borderWidth: 1, borderColor: "#1f1f29", padding: 8, backgroundColor: "#0b0d14" },
  metaText: { color: "#6b7287", fontSize: 12, fontFamily: FACES?.REGULAR },
  controls: { marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: "#1f1f29", padding: 8, backgroundColor: "#05050a" },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  controlLabel: { color: "#c9cdd8", fontFamily: FACES?.REGULAR },
  controlActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  controlValue: { color: "#c9cdd8", minWidth: 56, textAlign: "center", fontFamily: FACES?.BOLD },
  smallButton: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "#10121c", borderRadius: 6, borderWidth: 1, borderColor: "#1f1f29" },
  presetRow: { flexDirection: "row", alignItems: "center", paddingBottom: 8 },
  presetButton: { paddingHorizontal: 12, paddingVertical: 8, minWidth: 84, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: "#1f1f29", backgroundColor: "#070814", marginRight: 8 },
  presetButtonText: { color: "#c9cdd8", fontFamily: FACES?.REGULAR },
  presetSelected: { backgroundColor: "#1b5cff", borderColor: "#1b5cff" },
  toggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  on: { backgroundColor: "#1b5cff" },
  off: { backgroundColor: "#10121c" },
  sliderContainer: { width: "100%", paddingVertical: 6 },
  sliderTrack: { height: 8, backgroundColor: "#0b0d14", borderRadius: 6, overflow: "hidden", position: "relative" },
  sliderFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#1b5cff" },
  sliderThumb: { position: "absolute", width: 12, height: 12, borderRadius: 8, backgroundColor: "#fff", top: -2, transform: [{ translateX: -6 }] },
  textInput: { padding: 6, borderRadius: 6, borderWidth: 1, borderColor: "#1f1f29", color: "#c9cdd8", minWidth: 140, fontFamily: FACES?.REGULAR },
  textInputSmall: { padding: 6, borderRadius: 6, borderWidth: 1, borderColor: "#1f1f29", color: "#c9cdd8", minWidth: 40, textAlign: "center", fontFamily: FACES?.REGULAR },
})
