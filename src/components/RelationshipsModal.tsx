import { useMemo } from "react"
import { useGame } from "../game/GameContext"
import { useModalDismiss } from "../utils/ui"

export default function RelationshipsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useGame()

  const containerRef = useModalDismiss(onClose)

  const rows = useMemo(() => {
    const relationships = Object.values(state.relationships ?? {}) as any[]
    const playerId = state.player.id
    const nameFor = (id: string) => (id === playerId ? state.player.name : state.npcs?.[id]?.name ?? id)

    return relationships
      .map(r => {
        const involvesPlayer = r.aId === playerId || r.bId === playerId
        return {
          id: r.id,
          aId: r.aId,
          bId: r.bId,
          strength: r.strength,
          tags: r.tags ?? [],
          aName: nameFor(r.aId),
          bName: nameFor(r.bId),
          involvesPlayer,
        }
      })
      .sort((a, b) => {
        if (a.involvesPlayer !== b.involvesPlayer) return a.involvesPlayer ? -1 : 1
        return (b.strength ?? 0) - (a.strength ?? 0)
      })
  }, [state.relationships, state.npcs, state.player])

  if (!open) return null

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div ref={containerRef as any} style={{ background: "#111", color: "#fff", padding: "1rem", width: 680, maxHeight: "80vh", overflowY: "auto", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Relationships</h3>
          <span style={{ opacity: 0.7, fontSize: "0.9rem" }}>{rows.length} link{rows.length === 1 ? "" : "s"}</span>
        </div>

        {rows.length === 0 && <div>No relationships recorded yet.</div>}

        {rows.map(r => (
          <div key={r.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #222" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{r.aName}</div>
              <div style={{ opacity: 0.7 }}>↔</div>
              <div style={{ fontWeight: 700 }}>{r.bName}</div>
              <div style={{ color: r.involvesPlayer ? "#ffd21e" : "#ccc", minWidth: 80, textAlign: "right" }}>Strength {r.strength ?? 0}</div>
            </div>
            {r.tags?.length ? (
              <div style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 4 }}>{r.tags.join(", ")}</div>
            ) : null}
          </div>
        ))}

      </div>
    </div>
  )
}
