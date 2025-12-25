import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ModalShell from "./ModalShell"
import { makeRng, performStatCheck, type StatCheckMapping, type StatCheckResult } from "../game/statCheck"

export type DebugStatCheckModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  dc: number
  mainStatKey: string
  mainStatValue: number
  subSkillKey?: string
  subSkillValue?: number
  mapping?: StatCheckMapping
  rngSeed?: string
  autoRun?: boolean
  onResolve?: (result: StatCheckResult) => void
  initialResult?: StatCheckResult
}

export default function DebugStatCheckModal({ open, onClose, title = "Stat Check", dc, mainStatKey, mainStatValue, subSkillKey, subSkillValue, mapping = "quintile", rngSeed, autoRun = false, onResolve, initialResult }: DebugStatCheckModalProps) {
  const [result, setResult] = useState<StatCheckResult | null>(initialResult ?? null)
  const onResolveRef = useRef<DebugStatCheckModalProps["onResolve"]>(onResolve)
  const autoRunRef = useRef(false)

  useEffect(() => {
    onResolveRef.current = onResolve
  }, [onResolve])

  const labels = useMemo(() => ({
    main: mainStatKey.toUpperCase(),
    sub: subSkillKey ? subSkillKey.replace(/([A-Z])/g, " $1").toUpperCase() : null,
  }), [mainStatKey, subSkillKey])

  const runCheck = useCallback(() => {
    try {
      const rng = makeRng(rngSeed)
      const next = performStatCheck({ dc, mainStat: mainStatValue ?? 0, subSkill: subSkillValue ?? 0, mapping, rng })
      setResult(next)
      onResolveRef.current?.(next)
    } catch (e) {
      console.error("DebugStatCheckModal.runCheck error", e)
      setResult(null)
    }
  }, [dc, mainStatValue, subSkillValue, mapping, rngSeed])

  useEffect(() => {
    if (initialResult) {
      setResult(initialResult)
      return
    }
    if (!open) {
      autoRunRef.current = false
      setResult(null)
      return
    }
    setResult(null)
    if (autoRun && !autoRunRef.current) {
      autoRunRef.current = true
      runCheck()
    }
  }, [open, autoRun, runCheck, initialResult])

  return (
    <ModalShell open={open} onClose={onClose} durationMs={160} style={{ padding: "1rem", minWidth: 320, borderRadius: 8, background: "#0c0c0f", border: "1px solid #333" }}>
      {({ requestClose }) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{title}</strong>
            <button onClick={requestClose} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <Field label="DC" value={dc} />
            <Field label={`Main (${labels.main})`} value={mainStatValue ?? 0} />
            {subSkillKey ? <Field label={`Sub (${labels.sub})`} value={subSkillValue ?? 0} /> : null}
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={runCheck}>Reroll</button>
            <button onClick={requestClose}>Close</button>
          </div>

          {result ? (
            <ResultCard result={result} dc={dc} mainLabel={labels.main} subLabel={labels.sub} />
          ) : (
            <div style={{ fontSize: 12, color: "#aaa" }}>No roll yet. Click Reroll.</div>
          )}
        </div>
      )}
    </ModalShell>
  )
}

function Field({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: "#999" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ResultCard({ result, dc, mainLabel, subLabel }: { result: StatCheckResult; dc: number; mainLabel: string; subLabel: string | null }) {
  const outcome = result.critical === "nat1"
    ? "CRITICAL FAIL"
    : result.critical === "nat20"
      ? "CRITICAL SUCCESS"
      : result.success
        ? "SUCCESS"
        : "FAILURE"

  return (
    <div style={{ border: "1px solid #333", borderRadius: 8, padding: "0.75rem", display: "flex", flexDirection: "column", gap: 6, background: "#0f1118" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#aaa", fontSize: 12 }}>Outcome</span>
        <strong style={{ color: result.success ? "#9cf5a6" : "#f39" }}>{outcome}</strong>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, fontSize: 12, color: "#ccc" }}>
        <span>d20: {result.d20}</span>
        <span>DC: {dc}</span>
        <span>{mainLabel}: +{result.mainStat}</span>
        <span>{subLabel ? `${subLabel}: +${result.subSkillBonus}` : "Sub: +0"}</span>
        <span>Total: {result.total}</span>
        <span>Margin: {result.margin}</span>
      </div>
    </div>
  )
}
