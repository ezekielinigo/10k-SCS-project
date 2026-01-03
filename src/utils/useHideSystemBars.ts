import { useEffect } from "react"
import { Platform, StatusBar as RNStatusBar } from "react-native"
import * as NavigationBar from "expo-navigation-bar"

export default function useHideSystemBars(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    // Hide status bar on all platforms
    try {
      RNStatusBar.setHidden(true)
    } catch (e) {
      // ignore
    }

    if (Platform.OS !== "android") return () => {
      try { RNStatusBar.setHidden(false) } catch (e) {}
    }

    let cancelled = false
    ;(async () => {
      try {
        // Try to set a sticky immersive behavior first (try multiple names as API varies)
        const candidates = ["sticky-immersive", "immersive-sticky", "immersiveSticky", "immersive", "leanback"]
        if ((NavigationBar as any).setBehaviorAsync) {
          for (const name of candidates) {
            try {
              // eslint-disable-next-line no-await-in-loop
              await (NavigationBar as any).setBehaviorAsync(name)
              break
            } catch (_err) {
              // try next
            }
          }
        }

        // Finally hide the navigation bar
        await NavigationBar.setVisibilityAsync("hidden")
      } catch (e) {
        // ignore failures on older devices / missing API
      }
    })()

    return () => {
      try {
        RNStatusBar.setHidden(false)
      } catch (e) {}
      if (!cancelled) {
        ;(NavigationBar as any).setVisibilityAsync?.("visible")?.catch(() => {})
      }
      cancelled = true
    }
  }, [enabled])
}
