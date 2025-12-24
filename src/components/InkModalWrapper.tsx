import { lazy, Suspense } from "react"
import type { InkFrame } from "../game/ink"

const InkModal = lazy(() => import("./InkModal"))

type InkModalWrapperProps = {
  open: boolean
  onClose: () => void
  frames: InkFrame[]
  onChoose: (choiceIndex: number) => void
  statsVars?: any
}

export default function InkModalWrapper({ open, onClose, frames, onChoose, statsVars }: InkModalWrapperProps) {
  return (
    <Suspense fallback={<div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <InkModal open={open} onClose={onClose} frames={frames} onChoose={onChoose} statsVars={statsVars} />
    </Suspense>
  )
}
