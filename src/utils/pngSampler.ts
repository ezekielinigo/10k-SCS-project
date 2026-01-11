import { Image as RNImage } from "react-native"
import UPNG from "upng-js"

const cache: Record<string, { rgba: Uint8Array; width: number; height: number }> = {}

export async function loadPngPixels(moduleRequire: any) {
  try {
    const src = RNImage.resolveAssetSource(moduleRequire)
    const uri = src?.uri
    if (!uri) throw new Error("no-uri")
    if (cache[uri]) return cache[uri]
    const res = await fetch(uri)
    const ab = await res.arrayBuffer()
    const img = UPNG.decode(ab)
    const rgbaArr = UPNG.toRGBA8(img)[0]
    const out = { rgba: new Uint8Array(rgbaArr), width: img.width, height: img.height }
    cache[uri] = out
    return out
  } catch (err) {
    console.log("[pngSampler] load error", err)
    throw err
  }
}

export function samplePixel(pngData: { rgba: Uint8Array; width: number; height: number }, x: number, y: number) {
  const { rgba, width, height } = pngData
  if (!rgba || width <= 0 || height <= 0) return null
  const ix = Math.min(width - 1, Math.max(0, Math.floor(x)))
  const iy = Math.min(height - 1, Math.max(0, Math.floor(y)))
  const idx = (iy * width + ix) * 4
  return { r: rgba[idx], g: rgba[idx + 1], b: rgba[idx + 2], a: rgba[idx + 3] }
}

export default { loadPngPixels, samplePixel }
