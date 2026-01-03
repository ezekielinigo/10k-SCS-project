import React, { useEffect, useMemo, useState } from "react"
import { GLView } from "expo-gl"
import { Asset } from "expo-asset"
import { Image, ImageSourcePropType, StyleSheet } from "react-native"
import type { Tone } from "@shared/utils/palettes"
import { hexToRgb } from "@shared/utils/palettes"

type GLPaletteSwapProps = {
  source: ImageSourcePropType
  baseTone?: Tone
  targetTone?: Tone
  tolerance?: number // 0-255 scale
  size?: number
  bypass?: boolean
}

const VERT = `
attribute vec2 position;
varying vec2 uv;
void main() {
  // flip Y here to avoid calling gl.pixelStorei UNPACK_FLIP_Y_WEBGL on EXGL
  uv = vec2((position.x + 1.0) * 0.5, 1.0 - ((position.y + 1.0) * 0.5));
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;
varying vec2 uv;
uniform sampler2D inputImage;
uniform int anchorCount;
uniform vec3 baseAnchors[12];
uniform vec3 targetAnchors[12];
uniform float tolerance;

float distanceRgb(vec3 a, vec3 b) {
  vec3 d = a - b;
  return sqrt(dot(d, d));
}

void main() {
  vec4 c = texture2D(inputImage, uv);
  if (c.a == 0.0) {
    gl_FragColor = c;
    return;
  }
  float best = 1e9;
  int bestIdx = -1;
  for (int i = 0; i < 12; i++) {
    if (i >= anchorCount) { break; }
    float d = distanceRgb(c.rgb, baseAnchors[i]);
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  }
  if (bestIdx >= 0 && best <= tolerance) {
    vec3 target = targetAnchors[bestIdx];
    gl_FragColor = vec4(target, c.a);
  } else {
    gl_FragColor = c;
  }
}
`
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

/**
 * GPU palette swapper using Expo GLView; avoids legacy context (gl-react) and works with React 19.
 */
export function GLPaletteSwap({ source, baseTone, targetTone, tolerance = 18, size = 96, bypass }: GLPaletteSwapProps) {
  const [asset, setAsset] = useState<Asset | null>(null)
  const { baseAnchors, targetAnchors } = useMemo(() => anchorsAligned(baseTone, targetTone), [baseTone, targetTone])
  const anchorCount = baseAnchors.length
  const tol = tolerance / 255
  const srcKey = useMemo(() => {
    try {
      if (typeof source === "number") return `mod:${source}`
      if (typeof source === "string") return `str:${source}`
      // Image source objects may have a uri
      // @ts-ignore
      if (source && source.uri) return `uri:${source.uri}`
      return String(source)
    } catch (e) {
      return String(source)
    }
  }, [source])

  const viewKey = useMemo(() => `${serializeTone(baseTone)}|${serializeTone(targetTone)}|${tolerance}|${size}|${srcKey}`, [baseTone, targetTone, tolerance, size, srcKey])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const a = Asset.fromModule(source as any)
      await a.downloadAsync()
      if (mounted) setAsset(a)
    }
    load()
    return () => {
      mounted = false
    }
  }, [source])

  if (!asset) {
    return <Image source={source} style={[styles.image, { width: size, height: size }]} resizeMode="contain" />
  }

  return (
    <GLView
      key={viewKey}
      style={{ width: size, height: size }}
      onContextCreate={(gl) => {
        const vertex = gl.createShader(gl.VERTEX_SHADER)!
        gl.shaderSource(vertex, VERT)
        gl.compileShader(vertex)

        const fragment = gl.createShader(gl.FRAGMENT_SHADER)!
        gl.shaderSource(fragment, FRAG)
        gl.compileShader(fragment)

        const program = gl.createProgram()!
        gl.attachShader(program, vertex)
        gl.attachShader(program, fragment)
        gl.linkProgram(program)
        gl.useProgram(program)

        const positionLoc = gl.getAttribLocation(program, "position")
        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
          ]),
          gl.STATIC_DRAW
        )
        gl.enableVertexAttribArray(positionLoc)
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

        // Avoid calling pixelStorei on EXGL backends (they log unsupported params)
        // Flip Y in the vertex shader instead so texture orientation is correct.

        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        // enable alpha blending so transparent pixels composite correctly
        try {
          gl.enable(gl.BLEND)
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        } catch (e) {
          // ignore if unsupported
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, asset as any)

        const anchorCountLoc = gl.getUniformLocation(program, "anchorCount")
        const toleranceLoc = gl.getUniformLocation(program, "tolerance")
        const baseLoc = gl.getUniformLocation(program, "baseAnchors")
        const targetLoc = gl.getUniformLocation(program, "targetAnchors")
        gl.uniform1i(anchorCountLoc, anchorCount)
        gl.uniform1f(toleranceLoc, tol)

        const baseArray = new Float32Array(12 * 3)
        const targetArray = new Float32Array(12 * 3)
        baseAnchors.forEach((a, i) => {
          if (i >= 12) return
          baseArray[i * 3] = a[0]
          baseArray[i * 3 + 1] = a[1]
          baseArray[i * 3 + 2] = a[2]
        })
        targetAnchors.forEach((a, i) => {
          if (i >= 12) return
          targetArray[i * 3] = a[0]
          targetArray[i * 3 + 1] = a[1]
          targetArray[i * 3 + 2] = a[2]
        })
        gl.uniform3fv(baseLoc, baseArray)
        gl.uniform3fv(targetLoc, targetArray)

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        gl.flush()
        gl.endFrameEXP()
      }}
    />
  )
}

const styles = StyleSheet.create({
  image: { width: "100%", height: "100%" },
})

export default GLPaletteSwap
