import { useEffect, useRef } from "react"
import { useGame } from "../game/GameContext"
import { VITAL_DEFINITIONS, type VitalKey } from "../utils/ui"

export default function LogPanel() {
  const { state } = useGame()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const renderDeltaPills = (deltas?: Record<string, number>) => {
    if (!deltas) return null
    const entries = Object.entries(deltas).filter(([, v]) => Number(v) !== 0)
    if (entries.length === 0) return null

    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        {entries.map(([key, rawValue]) => {
          const def = VITAL_DEFINITIONS[key as VitalKey]
          if (!def) return null

          const value = Number(rawValue) || 0
          const Icon = def.Icon
          const signed = value > 0 ? `+${value}` : `${value}`
          const positive = value > 0
          const isStress = key === "stress"
          // For stress, positive (increase) should be red, decrease green.
          let fg = positive ? "#34d399" : "#f87171"
          let bg = positive ? "#34d3991a" : "#f871711a"
          let border = positive ? "#34d39940" : "#f8717140"
          if (isStress) {
            // invert colors for stress: positive => red, negative => green
            fg = positive ? "#f87171" : "#34d399"
            bg = positive ? "#f871711a" : "#34d3991a"
            border = positive ? "#f8717140" : "#34d39940"
          }
          return (
            <span
              key={`${key}-${signed}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 8px",
                borderRadius: 999,
                background: bg,
                color: fg,
                border: `1px solid ${border}`,
                fontSize: "0.8rem",
                lineHeight: 1.2,
              }}
            >
              <Icon size={12} />
              <span>{signed}</span>
            </span>
          )
        })}
      </div>
    )
  }

  const groups: Record<number, any[]> = {}
  for (const entry of state.log) {
    const m = Number(entry.month ?? 0)
    if (!groups[m]) groups[m] = []
    groups[m].push(entry)
  }
  const months = Object.keys(groups).map(k => Number(k)).sort((a, b) => a - b)

  useEffect(() => {
    if (!scrollRef.current) return
    requestAnimationFrame(() => {
      try {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight
      } catch (e) {
        // ignore
      }
    })
  }, [state.log.length])

  return (
    <div className="log-panel" style={{ padding: "0.75rem", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <h2>Log</h2>
      <div ref={scrollRef} className="hide-scrollbar" style={{ overflowY: "auto", fontSize: "0.85rem", flex: 1, minHeight: 0 }}>
        {
          (() => {
            const monthNames = [
              'January','February','March','April','May','June','July','August','September','October','November','December'
            ]
            const formatMonthYear = (m: number) => {
              const year = 2077 + Math.floor(m / 12)
              const mon = monthNames[((m % 12) + 12) % 12]
              return `${mon} ${year}`
            }

            return months.map(month => (
              <div key={`month-${month}`} style={{ marginBottom: "0.75rem" }}>
                <div style={{ opacity: 0.6, marginBottom: "0.25rem" }}>{formatMonthYear(month)}</div>
                {groups[month].map(entry => (
                  <div key={entry.id} style={{ marginBottom: "0.5rem" }}>
                    <div>{entry.text}</div>
                    {renderDeltaPills(entry.deltas)}
                  </div>
                ))}
              </div>
            ))
          })()
        }
      </div>
    </div>
  )
}
