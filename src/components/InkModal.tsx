// React import not required with new JSX runtime
import ModalShell from "./ModalShell"
import StatCheckModal from "./StatCheckModal"
import type { InkStatCheckEvent } from "../game/ink"

type InkFrame = { text: string; choices: any[] }

export default function InkModal({ open, onClose, frames, onChoose, statsVars, inkStatCheck, title }: { open: boolean; onClose: () => void; frames: InkFrame[]; onChoose: (choiceIndex: number) => void; statsVars?: any; inkStatCheck?: InkStatCheckEvent | null; title?: string | null }) {
  return (
    <>
      {frames.map((frame, idx) => {
        const isTop = idx === frames.length - 1
        if (isTop) {
          const noChoices = (frame.choices?.length ?? 0) === 0
          if (noChoices) {
            const vars = statsVars ?? {}
            const deltas: Record<string, number> = {}
            const dm = Number(vars.delta_money ?? 0)
            const ds = Number(vars.delta_stress ?? 0)
            const dh = Number(vars.delta_health ?? 0)
            const dhu = Number(vars.delta_humanity ?? 0)
            if (dm !== 0) deltas["Money"] = dm
            if (ds !== 0) deltas["Stress"] = ds
            if (dh !== 0) deltas["Health"] = dh
            if (dhu !== 0) deltas["Humanity"] = dhu

            // include skill/subskill deltas if present
            Object.keys(vars).forEach(k => {
              if (!k.startsWith("delta_")) return
              const val = Number(vars[k] ?? 0)
              if (!val || ["delta_money", "delta_stress", "delta_health", "delta_humanity"].includes(k)) return
              const name = k.slice(6)
              deltas[name.charAt(0).toUpperCase() + name.slice(1)] = val
            })
            // If an ink-provided stat-check event exists, show the full StatCheckModal
            if (inkStatCheck) {
              return (
                <StatCheckModal
                  key={idx}
                  open={open}
                  onClose={onClose}
                  title={title ?? "Task Result"}
                  dc={inkStatCheck?.dc ?? 0}
                  mainStatKey={inkStatCheck?.mainStatKey}
                  mainStatValue={inkStatCheck?.result?.mainStat}
                  subSkillKey={inkStatCheck?.subSkillKey}
                  subSkillValue={inkStatCheck?.result?.subSkillBonus}
                  initialResult={inkStatCheck?.result}
                  autoRun={false}
                  bodyText={frame.text}
                  deltas={deltas}
                />
              )
            }

            // Otherwise reuse StatCheckModal in minimal mode to show only text + deltas
            return (
              <StatCheckModal
                key={idx}
                open={open}
                onClose={onClose}
                title={title ?? "Task Result"}
                dc={0}
                bodyText={frame.text}
                deltas={deltas}
                minimal={true}
              />
            )
          }
          return (
            <ModalShell key={idx} open={open} onClose={onClose} preventClose={true} durationMs={200} style={{ padding: "1.25rem", width: "520px", borderRadius: 8, background: "#111", color: "#fff" }}>
                  {() => (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ marginTop: 0, letterSpacing: 0.5 }}></h3>
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", marginBottom: "1rem" }}>{frame.text}</div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {frame.choices.map((c, cidx) => (
                          <button
                            key={cidx}
                            style={{ textAlign: "center", padding: "0.5rem", borderRadius: 6 }}
                            onClick={() => onChoose(c.index ?? cidx)}
                            disabled={!isTop}
                          >
                            {c.text}
                          </button>
                        ))}

                        {/* Choices with navigation remain unchanged; terminal screens are handled above by StatCheckModal */}
                      </div>
                    </>
                  )}
                </ModalShell>
          )
        }

        return (
          <div
            key={idx}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 60 + idx,
            }}
          >
            <div
              style={{
                background: "#111",
                color: "#fff",
                padding: "1.25rem",
                width: "520px",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ marginTop: 0, letterSpacing: 0.5 }}></h3>
              </div>
              <div style={{ whiteSpace: "pre-wrap", marginBottom: "1rem" }}>{frame.text}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {frame.choices.map((c, cidx) => (
                  <button key={cidx} style={{ textAlign: "center", padding: "0.5rem", borderRadius: 6 }} onClick={() => onChoose(c.index ?? cidx)}>
                    {c.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
