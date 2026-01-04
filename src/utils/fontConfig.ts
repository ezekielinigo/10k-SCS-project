import React, { useEffect } from "react"
import { Text, TextInput } from "react-native"
import { useFonts } from "expo-font"
import { RobotoMono_400Regular, RobotoMono_700Bold } from "@expo-google-fonts/roboto-mono"

type FontKey = "pixel" | "pt-mono" | "roboto-mono" | "system"

// Change this to switch the app-wide font set.
export const CURRENT_FONT: FontKey = "system"

const FACES: Record<FontKey, { REGULAR: string; BOLD: string; EXTRABOLD: string }> = {
  pixel: { REGULAR: "PixelCode-Regular", BOLD: "PixelCode-Bold", EXTRABOLD: "PixelCode-ExtraBold" },
  "pt-mono": { REGULAR: "PTMono-Regular", BOLD: "PTMono-Bold", EXTRABOLD: "PTMono-Bold" },
  "roboto-mono": { REGULAR: "RobotoMono-Regular", BOLD: "RobotoMono-Bold", EXTRABOLD: "RobotoMono-Bold" },
  system: { REGULAR: "", BOLD: "", EXTRABOLD: "" },
}

export function fontFaceNames(fontKey: FontKey = CURRENT_FONT) {
  return FACES[fontKey]
}

export function fontAssetsFor(fontKey: FontKey = CURRENT_FONT) {
  if (fontKey === "system") return {}
  if (fontKey === "pt-mono") {
    return {
      [FACES["pt-mono"].REGULAR]: require("../assets/fonts/PTMono-Regular.ttf"),
      [FACES["pt-mono"].BOLD]: require("../assets/fonts/PTMono-Bold.ttf"),
    }
  }

  if (fontKey === "roboto-mono") {
    return {
      [FACES["roboto-mono"].REGULAR]: RobotoMono_400Regular,
      [FACES["roboto-mono"].BOLD]: RobotoMono_700Bold,
    }
  }

  return {
    [FACES.pixel.REGULAR]: require("../assets/fonts/PixelCode.ttf"),
    [FACES.pixel.BOLD]: require("../assets/fonts/PixelCode-Bold.ttf"),
    [FACES.pixel.EXTRABOLD]: require("../assets/fonts/PixelCode-ExtraBold.ttf"),
  }
}

// Apply a global default Text / TextInput style so components inherit the base font.
export function applyGlobalFontDefaults(fontKey: FontKey = CURRENT_FONT) {
  const faces = fontFaceNames(fontKey)
  const base = { fontFamily: faces.REGULAR }
  // If using the system font, clear any previously-applied global defaults and return.
  if (fontKey === "system") {
    if ((Text as any).defaultProps) delete (Text as any).defaultProps.style
    if ((TextInput as any).defaultProps) delete (TextInput as any).defaultProps.style
    return
  }

  if (!(Text as any).defaultProps) (Text as any).defaultProps = {}
  if (!(TextInput as any).defaultProps) (TextInput as any).defaultProps = {}

  const prevText = (Text as any).defaultProps.style
  ;(Text as any).defaultProps.style = Array.isArray(prevText) ? [base, ...prevText] : prevText ? [base, prevText] : base

  const prevInput = (TextInput as any).defaultProps.style
  ;(TextInput as any).defaultProps.style = Array.isArray(prevInput) ? [base, ...prevInput] : prevInput ? [base, prevInput] : base
}

// Hook to load fonts for a given fontKey and apply global defaults when ready.
export function useLoadFonts(fontKey: FontKey = CURRENT_FONT) {
  const assets = fontAssetsFor(fontKey)
  const [loaded, error] = useFonts(assets as any)

  useEffect(() => {
    if (!loaded) return
    applyGlobalFontDefaults(fontKey)
  }, [loaded, fontKey])

  return [loaded, error] as const
}

export default { CURRENT_FONT, fontFaceNames, fontAssetsFor, applyGlobalFontDefaults, useLoadFonts }
