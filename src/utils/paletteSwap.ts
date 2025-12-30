import { BASE_PALETTE, hexToRgb } from "./palettes"
import type { Tone, PaletteCategory, Hex } from "./palettes"

const cache = new Map<string, string>()

function serializeTone(t: Tone): string {
  const parts: string[] = []
  if (t.deep) parts.push(t.deep)
  parts.push(t.dark, t.mid)
  if (t.light) parts.push(t.light)
  return parts.join("-")
}

function key(src: string, base: Tone, target: Tone, tolerance: number) {
  return `${src}|base:${serializeTone(base)}|tgt:${serializeTone(target)}|tol:${tolerance}`
}

function distance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

export async function paletteSwapImage(srcUrl: string, base: Tone, target: Tone, tolerance = 18): Promise<string> {
  const k = key(srcUrl, base, target, tolerance)
  const hit = cache.get(k)
  if (hit) return hit

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = "anonymous"
    i.onload = () => resolve(i)
    i.onerror = (e) => reject(e)
    i.src = srcUrl
  })

  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imgData.data

  const baseAnchors = (() => {
    const arr: Array<{ r: number; g: number; b: number }> = []
    if (base.deep) arr.push(hexToRgb(base.deep))
    arr.push(hexToRgb(base.dark))
    arr.push(hexToRgb(base.mid))
    if (base.light) arr.push(hexToRgb(base.light))
    return arr
  })()

  const targetAnchors = (() => {
    const arr: Array<{ r: number; g: number; b: number }> = []
    if (target.deep) arr.push(hexToRgb(target.deep))
    arr.push(hexToRgb(target.dark))
    arr.push(hexToRgb(target.mid))
    if (target.light) arr.push(hexToRgb(target.light))
    return arr
  })()

  for (let p = 0; p < data.length; p += 4) {
    const r = data[p]
    const g = data[p + 1]
    const b = data[p + 2]
    const a = data[p + 3]
    if (a === 0) continue

    const rgb = { r, g, b }
    let minIdx = -1
    let minDist = Number.POSITIVE_INFINITY
    for (let i = 0; i < baseAnchors.length; i++) {
      const d = distance(rgb, baseAnchors[i])
      if (d < minDist) {
        minDist = d
        minIdx = i
      }
    }
    if (minDist <= tolerance && minIdx >= 0) {
      const tgt = targetAnchors[Math.min(minIdx, targetAnchors.length - 1)]
      data[p] = tgt.r
      data[p + 1] = tgt.g
      data[p + 2] = tgt.b
    }
  }

  ctx.putImageData(imgData, 0, 0)
  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"))
  const url = URL.createObjectURL(blob)
  cache.set(k, url)
  return url
}

export async function paletteSwapCategoryImage(srcUrl: string, category: PaletteCategory, target: Tone, tolerance = 18): Promise<string> {
  return paletteSwapImage(srcUrl, BASE_PALETTE[category], target, tolerance)
}

export async function paletteSwapSkinImage(srcUrl: string, target: Tone, tolerance = 18): Promise<string> {
  return paletteSwapCategoryImage(srcUrl, "skin", target, tolerance)
}

export async function paletteSwapHairImage(srcUrl: string, target: Tone, tolerance = 18): Promise<string> {
  return paletteSwapCategoryImage(srcUrl, "hair", target, tolerance)
}

export async function paletteSwapCustomPairs(srcUrl: string, fromColors: Hex[], toColors: Hex[], tolerance = 18): Promise<string> {
  if (fromColors.length === 0) return srcUrl
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = "anonymous"
    i.onload = () => resolve(i)
    i.onerror = (e) => reject(e)
    i.src = srcUrl
  })

  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imgData.data

  const fromRGB = fromColors.map(hexToRgb)
  const toRGB = toColors.map(hexToRgb)

  for (let p = 0; p < data.length; p += 4) {
    const r = data[p]
    const g = data[p + 1]
    const b = data[p + 2]
    const a = data[p + 3]
    if (a === 0) continue
    const rgb = { r, g, b }
    let minIdx = -1
    let minDist = Number.POSITIVE_INFINITY
    for (let i = 0; i < fromRGB.length; i++) {
      const d = distance(rgb, fromRGB[i])
      if (d < minDist) {
        minDist = d
        minIdx = i
      }
    }
    if (minDist <= tolerance && minIdx >= 0) {
      const t = toRGB[Math.min(minIdx, toRGB.length - 1)]
      data[p] = t.r
      data[p + 1] = t.g
      data[p + 2] = t.b
    }
  }

  ctx.putImageData(imgData, 0, 0)
  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"))
  return URL.createObjectURL(blob)
}

export async function maskMapColorFromOriginal(originalSrc: string, workingSrc: string, fromHex: Hex, toHex: Hex, tolerance = 18): Promise<string> {
  const [origImg, workImg] = await Promise.all([
    new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = "anonymous"
      i.onload = () => resolve(i)
      i.onerror = (e) => reject(e)
      i.src = originalSrc
    }),
    new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = "anonymous"
      i.onload = () => resolve(i)
      i.onerror = (e) => reject(e)
      i.src = workingSrc
    }),
  ])

  const width = workImg.naturalWidth
  const height = workImg.naturalHeight
  const canvasWork = document.createElement("canvas")
  canvasWork.width = width
  canvasWork.height = height
  const ctxWork = canvasWork.getContext("2d", { willReadFrequently: true })!
  ctxWork.drawImage(workImg, 0, 0)

  const canvasOrig = document.createElement("canvas")
  canvasOrig.width = width
  canvasOrig.height = height
  const ctxOrig = canvasOrig.getContext("2d", { willReadFrequently: true })!
  // Draw original scaled to match; assumes same intrinsic resolution for layers
  ctxOrig.drawImage(origImg, 0, 0, width, height)

  const dataWork = ctxWork.getImageData(0, 0, width, height)
  const dataOrig = ctxOrig.getImageData(0, 0, width, height)

  const fromRGB = hexToRgb(fromHex)
  const toRGB = hexToRgb(toHex)

  for (let p = 0; p < dataWork.data.length; p += 4) {
    const aOrig = dataOrig.data[p + 3]
    if (aOrig === 0) continue
    const rO = dataOrig.data[p]
    const gO = dataOrig.data[p + 1]
    const bO = dataOrig.data[p + 2]
    const d = distance({ r: rO, g: gO, b: bO }, fromRGB)
    if (d <= tolerance) {
      dataWork.data[p] = toRGB.r
      dataWork.data[p + 1] = toRGB.g
      dataWork.data[p + 2] = toRGB.b
    }
  }

  ctxWork.putImageData(dataWork, 0, 0)
  const blob: Blob = await new Promise((resolve) => canvasWork.toBlob((b) => resolve(b!), "image/png"))
  return URL.createObjectURL(blob)
}
