import { useMemo, useState } from "react"
import { useGame } from "../game/GameContext"
import ModalShell from "./ModalShell"
import NpcAvatar from "./NpcAvatar"
import NpcProfileModal from "./NpcProfileModal"

function SmallStrengthBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div style={{ background: "#222", borderRadius: 4, height: 6, width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: "#4f82ff", borderRadius: 4 }} />
    </div>
  )
}

export default function RelationshipsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useGame()
  const [openNpcId, setOpenNpcId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const relationships = Object.values(state.relationships ?? {}) as any[]
    const playerId = state.player.id
    const targetIds = relationships
      .map(r => {
        if (r.aId === playerId && r.bId) return { id: r.bId, strength: r.strength }
        if (r.bId === playerId && r.aId) return { id: r.aId, strength: r.strength }
        return null
      })
      .filter(Boolean) as { id: string; strength?: number }[]

    return targetIds
      .map(entry => {
        const npc = state.npcs?.[entry.id]
        return {
          id: entry.id,
          name: npc?.name ?? entry.id,
          avatarId: npc?.avatarId,
          strength: entry.strength ?? 0,
        }
      })
      .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
  }, [state.relationships, state.npcs, state.player])
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      durationMs={200}
      style={{ padding: "1rem", width: 680, maxHeight: "80vh", overflowY: "auto", borderRadius: 8 }}
    >
      {({ containerRef, closing, requestClose, durationMs }) => (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Relationships</h3>
          </div>

          {rows.length === 0 && <div>No relationships recorded yet.</div>}

          {rows.map(r => (
            <div key={r.id} style={{ padding: "0.75rem", borderBottom: "1px solid #222", display: "flex", alignItems: "center", gap: 12 }}>
              <NpcAvatar avatarId={r.avatarId} alt={`${r.name} avatar`} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ marginTop: 6 }}>
                  <SmallStrengthBar value={r.strength ?? 0} />
                </div>
              </div>
              <button onClick={() => setOpenNpcId(r.id)} style={{ width: 40, height: 40, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>P</button>
              <button style={{ width: 40, height: 40, borderRadius: 6, background: "#1c1f2a", border: "1px solid #333", color: "#fff" }}>★</button>
            </div>
          ))}

          <NpcProfileModal open={!!openNpcId} onClose={() => setOpenNpcId(null)} npcId={openNpcId ?? undefined} />
        </>
      )}
    </ModalShell>
  )
}
