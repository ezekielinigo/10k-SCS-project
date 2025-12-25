import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FaDiceD20 } from "react-icons/fa"
import ModalShell from "./ModalShell"
import { makeRng, performStatCheck, type StatCheckMapping, type StatCheckResult } from "../game/statCheck"
import { renderDeltaPills } from "../utils/ui"

export type StatCheckModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  dc: number
  mainStatKey?: string
  mainStatValue?: number
  subSkillKey?: string
  subSkillValue?: number
  mapping?: StatCheckMapping
  rngSeed?: string
  autoRun?: boolean
  onResolve?: (result: StatCheckResult) => void
  initialResult?: StatCheckResult
  bodyText?: string
  deltas?: Record<string, number>
}

export default function StatCheckModal({ open, onClose, title = "Stat Check", dc, mainStatKey, mainStatValue = 0, subSkillKey, subSkillValue = 0, mapping = "quintile", rngSeed, autoRun = false, onResolve, initialResult, bodyText, deltas }: StatCheckModalProps) {
  const [result, setResult] = useState<StatCheckResult | null>(initialResult ?? null)
  const onResolveRef = useRef<StatCheckModalProps["onResolve"]>(onResolve)
  const autoRunRef = useRef(false)

  useEffect(() => { onResolveRef.current = onResolve }, [onResolve])

  const runCheck = useCallback(() => {
    try {
      const rng = makeRng(rngSeed)
      const next = performStatCheck({ dc, mainStat: mainStatValue ?? 0, subSkill: subSkillValue ?? 0, mapping, rng })
      setResult(next)
      onResolveRef.current?.(next)
    } catch (e) {
      console.error("StatCheckModal.runCheck error", e)
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

  const mainLabel = useMemo(() => mainStatKey ? mainStatKey.toUpperCase() : "MAIN", [mainStatKey])
  

  const modifiersLines = useMemo(() => {
    const lines: string[] = []
    const mainStr = `+${mainStatValue ?? 0}${mainStatKey ? ` (${mainLabel})` : ""}`
    lines.push(mainStr)
    if (subSkillKey) {
      const subValue = result ? result.subSkillBonus : subSkillValue ?? 0
      const pretty = (s: string) => s.replace(/([A-Z])/g, " $1").trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
      lines.push(`+${subValue} (${pretty(subSkillKey)})`)
    }
    return lines
  }, [mainLabel, mainStatKey, mainStatValue, result, subSkillKey, subSkillValue])

  const outcomeLabel = useMemo(() => {
    if (!result) return "—"
    if (result.critical === "nat20") return "CRITICAL SUCCESS"
    if (result.critical === "nat1") return "CRITICAL FAIL"
    return result.success ? "SUCCESS" : "FAILURE"
  }, [result])

  return (
    <ModalShell open={open} onClose={onClose} durationMs={180} style={{ padding: "1rem", minWidth: 360, borderRadius: 8, background: "#07070b", border: "1px solid #222" }}>
      {({ requestClose }) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{title}</strong>
            <button onClick={requestClose} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>


            <div style={{ display: "flex", alignItems: "stretch", gap: 12, flexDirection: "column", width: 140, margin: "0 auto" }}>
              <div style={{ width: "100%", textAlign: "center", paddingBottom: 6 }}>
                <div style={{ fontSize: 12, color: "#aaa", letterSpacing: 1 }}>DIFFICULTY CLASS:</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{dc}</div>
              </div>

              <div style={{ width: 140, height: 140, borderRadius: 14, background: "#0e0f14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #333", padding: 8, boxSizing: "border-box" }}>
                <FaDiceD20 style={{ fontSize: 72, color: "#f7d07a" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center", marginTop: 10 }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{result ? result.d20 : "—"}</div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ color: "#bbb", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Modifiers</div>
                    {modifiersLines.map((line, idx) => (
                      <div key={line + idx} style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{line}</div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div style={{ padding: "0.6rem", borderRadius: 8, background: "#0b0c0f", border: "1px solid #2a2a2a", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: result ? (result.success ? "#9cf5a6" : "#f78") : "#ccc" }}>
              {outcomeLabel}
            </div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>
              {result ? `Total: ${result.total} — Margin: ${result.margin >= 0 ? "+" + result.margin : result.margin}` : "No roll yet"}
            </div>
          </div>

          {bodyText ? (
            <div style={{ padding: "0.6rem", borderRadius: 8, background: "#06060a", border: "1px solid #1f1f1f", color: "#ddd", fontSize: 13 }}>
              {bodyText}
            </div>
          ) : null}

          {renderDeltaPills(deltas)}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={runCheck}>Reroll</button>
            <button onClick={requestClose}>Close</button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
