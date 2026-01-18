import React, { useMemo } from "react"
import { Image, ImageSourcePropType, StyleSheet } from "react-native"
import {
  Canvas,
  FilterMode,
  Image as SkiaImage,
  MipmapMode,
  Skia,
  TileMode,
  useImage,
} from "@shopify/react-native-skia"
import type { Tone } from "@shared/utils/avatarPaletteConfig"
import { hexToRgb } from "@shared/utils/avatarPaletteConfig"

type GLPaletteSwapProps = {
  source: ImageSourcePropType
  baseTone?: Tone
  targetTone?: Tone
  tolerance?: number // 0-255 scale
  size?: number
  bypass?: boolean
}

const PALETTE_EFFECT = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform int anchorCount;
uniform float3 baseAnchors[12];
uniform float3 targetAnchors[12];
uniform float tolerance;

half4 main(float2 xy) {
  half4 c = image.eval(xy);
  if (c.a == 0.0) { return c; }
  float best = 1e9;
  float3 bestTarget = float3(0.0, 0.0, 0.0);
  for (int i = 0; i < 12; ++i) {
    if (i >= anchorCount) { break; }
    float3 d = c.rgb - baseAnchors[i];
    float dist = sqrt(dot(d, d));
    if (dist < best) { best = dist; bestTarget = targetAnchors[i]; }
  }
  if (best <= tolerance) {
    return half4(bestTarget, c.a);
  }
  return c;
}
`)

const KEY_ORDER = [
  "deep",
  "dark",
  "mid",
  "light",
  "misc_deep",
  "misc_dark",
  "misc_mid",
  "misc_light",
] as const

type AnchorKey = (typeof KEY_ORDER)[number]

const pickChannel = (tone: Tone | undefined, key: AnchorKey): string | undefined => {
  if (!tone) return undefined
  const direct = (tone as any)[key] as string | undefined
  if (direct) return direct
  if (key.startsWith("misc_")) {
    return (tone as any).dark || (tone as any).mid || (tone as any).light || (tone as any).deep
  }
  if (key === "deep") return (tone as any).dark || (tone as any).mid || (tone as any).light
  if (key === "light") return (tone as any).mid || (tone as any).dark || (tone as any).deep
  return (tone as any).dark || (tone as any).mid || (tone as any).light || (tone as any).deep
}

const anchorsAligned = (baseTone?: Tone, targetTone?: Tone) => {
  const baseAnchors: Array<[number, number, number]> = []
  const targetAnchors: Array<[number, number, number]> = []
  if (!baseTone) return { baseAnchors, targetAnchors }
  for (const key of KEY_ORDER) {
    const baseHex = (baseTone as any)[key] as string | undefined
    if (!baseHex) continue
    const targetHex = pickChannel(targetTone, key) || baseHex
    baseAnchors.push(rgbNorm(baseHex))
    targetAnchors.push(rgbNorm(targetHex))
  }
  return { baseAnchors, targetAnchors }
}

function rgbNorm(hex: string): [number, number, number] {
  const c = hexToRgb(hex)
  return [c.r / 255, c.g / 255, c.b / 255]
}

const serializeTone = (tone?: Tone | null) => {
  if (!tone) return "none"
  return KEY_ORDER.map((k) => (tone as any)[k]).filter(Boolean).join("-")
}

const nearestPaint = (() => {
  const p = Skia.Paint()
  const anyPaint = p as any
  if (typeof anyPaint.setFilterMode === "function") anyPaint.setFilterMode(FilterMode.Nearest)
  if (typeof anyPaint.setMipmapMode === "function") anyPaint.setMipmapMode(MipmapMode.None)
  return p
})()

const toVec3Array = (arr: Array<[number, number, number]>): number[] => {
  const out = new Array(12 * 3).fill(0)
  arr.slice(0, 12).forEach((v, i) => {
    out[i * 3] = v[0]
    out[i * 3 + 1] = v[1]
    out[i * 3 + 2] = v[2]
  })
  return out
}

export function SkiaPaletteSwap({ source, baseTone, targetTone, tolerance = 18, size = 96, bypass }: GLPaletteSwapProps) {
  const image = useImage(source as any)
  const { baseAnchors, targetAnchors } = useMemo(() => anchorsAligned(baseTone, targetTone), [baseTone, targetTone])
  const anchorCount = baseAnchors.length
  const tol = tolerance / 255

  const viewKey = useMemo(
    () => `${serializeTone(baseTone)}|${serializeTone(targetTone)}|${tolerance}|${size}|${String(source)}`,
    [baseTone, targetTone, tolerance, size, source]
  )

  const shaderPaint = useMemo(() => {
    try {
      if (!image) return null
      if (!PALETTE_EFFECT) return null
      if (!baseAnchors.length) return null

      const mkOpts = (image as any).makeShaderOptions
      const mk = (image as any).makeShader
      let imageShader: any = null
      if (typeof mkOpts === "function") {
        imageShader = mkOpts.call(image, TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None, undefined)
      } else if (typeof mk === "function") {
        // Fallback for Skia builds without makeShaderOptions
        imageShader = mk.call(image, TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None, undefined)
      }
      if (!imageShader) return null

      const shader = PALETTE_EFFECT.makeShader(
        {
          anchorCount,
          tolerance: tol,
          baseAnchors: toVec3Array(baseAnchors),
          targetAnchors: toVec3Array(targetAnchors),
        },
        [imageShader]
      )
      if (!shader) return null
      const p = Skia.Paint()
      p.setShader(shader)
      return p
    } catch (e) {
      return null
    }
  }, [anchorCount, baseAnchors, image, targetAnchors, tol])

  if (bypass) {
    return <Image source={source} style={[styles.image, { width: size, height: size }]} resizeMode="contain" />
  }

  if (!image) {
    return <Image source={source} style={[styles.image, { width: size, height: size }]} resizeMode="contain" />
  }

  return (
    <Canvas key={viewKey} style={{ width: size, height: size }}>
      <SkiaImage
        key={viewKey}
        image={image}
        x={0}
        y={0}
        width={size}
        height={size}
        fit="contain"
        paint={shaderPaint ?? nearestPaint}
        sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
      />
    </Canvas>
  )
}

const styles = StyleSheet.create({
  image: { width: "100%", height: "100%" },
})

export { SkiaPaletteSwap as GLPaletteSwap }
export default SkiaPaletteSwap
