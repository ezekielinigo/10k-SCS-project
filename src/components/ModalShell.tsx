import React, { useEffect } from "react"
import { createPortal } from "react-dom"
import { useModalDismiss, useModalTransition, useSwipeDismiss, isTopModal, anyModalOpen } from "../utils/ui"

type ModalShellProps = {
  open: boolean
  onClose: () => void
  preventClose?: boolean
  durationMs?: number
  className?: string
  style?: React.CSSProperties
  zIndex?: number
  children: (props: {
    containerRef: React.RefObject<HTMLElement>
    closing: boolean
    requestClose: () => void
    durationMs: number
  }) => React.ReactNode
}

export default function ModalShell({ open, onClose, preventClose = false, durationMs = 200, className, style, zIndex = 80, children }: ModalShellProps) {
  const { shouldRender, closing, requestClose } = useModalTransition(open, onClose, durationMs)

  // If preventClose is true, we don't wire outside clicks / escape / swipe to close.
  const containerRef = useModalDismiss(preventClose ? (() => {}) : requestClose)
  useSwipeDismiss(preventClose ? (() => {}) : requestClose, undefined, containerRef)

  useEffect(() => {
    // prevent body scroll while modal open
    if (!shouldRender) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [shouldRender])

  if (!shouldRender) return null

  const node = typeof document === "undefined" ? null : document.body

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex,
        padding: 12,
        opacity: closing ? 0 : 1,
        transition: `opacity ${durationMs}ms ease`,
      }}
      onMouseDown={(e) => {
        if (preventClose) return
        // only close when clicking directly on the backdrop (not inside the card)
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        ref={containerRef as any}
        className={className ?? "modal-card"}
        style={{
          background: "#111",
          color: "#fff",
          transform: closing ? "translateY(-12px)" : "translateY(0)",
          opacity: closing ? 0 : 1,
          transition: `transform ${durationMs}ms ease, opacity ${durationMs}ms ease`,
          width: "auto",
          maxWidth: "100%",
          boxSizing: "border-box",
          ...style,
        }}
      >
        {children({ containerRef, closing, requestClose, durationMs })}
      </div>
    </div>
  )

  return node ? createPortal(modal, node) : modal
}
