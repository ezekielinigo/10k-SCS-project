import { useEffect, useRef } from "react"

export const chooseIndefiniteArticle = (title?: string | null): string => {
  const jobTitle = (title ?? "").toLowerCase().trim()
  if (!jobTitle) return "a"
  if (/^(honest|hour|honour|heir)/i.test(jobTitle)) return "an"
  if (/^(uni|use|user|one|once|eu|euro)/i.test(jobTitle)) return "a"
  return /^[aeiou]/i.test(jobTitle) ? "an" : "a"
}

// Hook: returns a ref to attach to modal container. Calls onClose when
// click occurs outside the element or Escape is pressed.
export function useModalDismiss(onClose: () => void) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      const el = ref.current
      if (!el) return
      const target = e.target as Node | null
      if (target && !el.contains(target)) onClose()
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") onClose()
    }

    document.addEventListener("mousedown", handleDown)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleDown)
      document.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  return ref
}

export default { chooseIndefiniteArticle, useModalDismiss }
