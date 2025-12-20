// React import not required with new JSX runtime
import iconMoney from "../assets/icon_money.png"
import iconStress from "../assets/icon_stress.png"
import iconHealth from "../assets/icon_health.png"
import iconDefault from "../assets/icon_default.png"

type InkFrame = { text: string; choices: any[] }

export default function InkModal({ open, onClose, frames, onChoose, statsVars }: { open: boolean; onClose: () => void; frames: InkFrame[]; onChoose: (choiceIndex: number) => void; statsVars?: any }) {
  if (!open) return null

  return (
    <>
      {frames.map((frame, idx) => {
        const isTop = idx === frames.length - 1
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
            <div style={{
              background: ((): string => {
                const outcome = (statsVars as any)?.outcome ?? null
                if (outcome === "great_failure") return "#8b0000"
                if (outcome === "failure") return "#ce5408ff"
                if (outcome === "success") return "#0054a9ff"
                if (outcome === "great_success") return "#ffd21eff"
                return "#111"
              })(),
              color: ((): string => {
                const outcome = (statsVars as any)?.outcome ?? null
                if (outcome === "great_success") return "#000"
                return "#fff"
              })(),
              padding: "1.25rem",
              width: "520px",
              borderRadius: 8
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ marginTop: 0, letterSpacing: 0.5 }}></h3>
              </div>
              <div style={{ whiteSpace: "pre-wrap", marginBottom: "1rem"}}>{frame.text}</div>

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

                {isTop && (frame.choices?.length ?? 0) === 0 && (
                  <>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      {(() => {
                        const vars = statsVars ?? {}
                        const items: { icon: string; value: number; key: string }[] = []
                        const dm = Number(vars.delta_money ?? 0)
                        const ds = Number(vars.delta_stress ?? 0)
                        const dh = Number(vars.delta_health ?? 0)
                        const dhu = Number(vars.delta_humanity ?? 0)
                        if (dm !== 0) items.push({ icon: iconMoney, value: dm, key: "money" })
                        if (ds !== 0) items.push({ icon: iconStress, value: ds, key: "stress" })
                        if (dh !== 0) items.push({ icon: iconHealth, value: dh, key: "health" })
                        if (dhu !== 0) items.push({ icon: iconDefault, value: dhu, key: "humanity" })

                        if (items.length === 0) return null

                        return (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "0.25rem" }}>
                              {items.map(it => (
                                <div key={it.key} style={{ flexDirection: "column", width: 90, height: 110, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", borderRadius: 6, padding: 4, background: "#000" }}>
                                  <img src={it.icon} alt={it.key} style={{ minWidth: 70, minHeight: 70, imageRendering: 'pixelated' as any }} />
                                  <div style={{ color: "#fff", fontWeight: 600, marginTop: "0.5rem" , fontSize: "0.70rem" }}>
                                    {it.key === "money" ? `${it.value > 0 ? '+ ' : '- '}♦︎ ${Math.abs(it.value)}` : `${it.value > 0 ? '+ ' : '- '}${Math.abs(it.value)} ${it.key}`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    <button style={{ textAlign: "center", padding: "0.5rem", borderRadius: 6 }} onClick={onClose}>
                      OK
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
