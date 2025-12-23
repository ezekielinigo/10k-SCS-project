import { useEffect, useRef, useState } from "react"

export const chooseIndefiniteArticle = (title?: string | null): string => {
  const jobTitle = (title ?? "").toLowerCase().trim()
  if (!jobTitle) return "a"
  if (/^(honest|hour|honour|heir)/i.test(jobTitle)) return "an"
  if (/^(uni|use|user|one|once|eu|euro)/i.test(jobTitle)) return "a"
  return /^[aeiou]/i.test(jobTitle) ? "an" : "a"
}

// Hook: returns a ref to attach to modal container. Calls onClose when
// click occurs outside the element or Escape is pressed.
// internal stack of modal refs (top = last)
let modalStack: Array<React.RefObject<HTMLElement | null>> = []

// Utility: return whether the given ref is the topmost modal
export function isTopModal(ref?: React.RefObject<HTMLElement | null>) {
  if (!ref) return false
  return modalStack[modalStack.length - 1] === ref
}

// Utility: whether any modal is currently registered (open)
export function anyModalOpen() {
  return modalStack.length > 0
}

// Hook: returns a ref to attach to modal container. Calls onClose when
// click occurs outside the element or Escape is pressed, but only when
// this modal is the topmost modal.
export function useModalDismiss(onClose: () => void) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // register in stack
    modalStack.push(ref)
    return () => {
      modalStack = modalStack.filter(r => r !== ref)
    }
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const top = modalStack[modalStack.length - 1]
      if (top !== ref) return
      if (e.key === "Escape" || e.key === "Esc") onClose()
    }

    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  return ref
}

// Hook: listen for an upward swipe starting in the bottom portion of the screen
// and call `onClose`. Useful for modals that want swipe-to-dismiss behavior.
export function useSwipeDismiss(onClose: () => void, opts?: { startRatio?: number; thresholdRatio?: number }, containerRef?: React.RefObject<HTMLElement | null>) {
  const startRatio = opts?.startRatio ?? 2 / 3
  const thresholdRatio = opts?.thresholdRatio ?? 0.08

  useEffect(() => {
    let startY: number | null = null
    let lastY = 0

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches?.[0]
      if (!t) return
      const h = window.innerHeight
      const sy = t.clientY
      // only start if touch begins in bottom portion
      if (sy < h * startRatio) return
      // if a containerRef is provided, only allow swipe for topmost modal
      if (containerRef) {
        const top = modalStack[modalStack.length - 1]
        if (top !== containerRef) return
      }
      startY = sy
      lastY = sy
    }

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches?.[0]
      if (!t) return
      lastY = t.clientY
    }

    const onTouchEnd = () => {
      if (startY == null) return
      const delta = lastY - startY
      const threshold = Math.max(40, window.innerHeight * thresholdRatio)
      if (delta < -threshold) onClose()
      startY = null
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchmove", onTouchMove, { passive: true })
    document.addEventListener("touchend", onTouchEnd)

    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
    }
  }, [onClose, startRatio, thresholdRatio])
}

// Hook: Handles modal open/close transitions with animation support
export function useModalTransition(open: boolean, onClose: () => void, durationMs: number = 200) {
  const [shouldRender, setShouldRender] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      setClosing(false)
    } else if (shouldRender) {
      setClosing(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
        setClosing(false)
      }, durationMs)
      return () => clearTimeout(timer)
    }
  }, [open, durationMs, shouldRender])

  const requestClose = () => {
    if (!closing) {
      setClosing(true)
      setTimeout(onClose, durationMs)
    }
  }

  return { shouldRender, closing, requestClose, durationMs }
}

export default { chooseIndefiniteArticle, useModalDismiss, useModalTransition }
