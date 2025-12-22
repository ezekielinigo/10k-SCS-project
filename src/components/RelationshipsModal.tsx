import { useMemo, useState } from "react"
import { useGame } from "../game/GameContext"
import { useModalDismiss } from "../utils/ui"
import NpcAvatar from "./NpcAvatar"
import NpcProfileModal from "./NpcProfileModal"

export default function RelationshipsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useGame()

  const containerRef = useModalDismiss(onClose)

  const rows = useMemo(() => {
    const relationships = Object.values(state.relationships ?? {}) as any[]
    const playerId = state.player.id
    const nameFor = (id: string) => (id === playerId ? state.player.name : state.npcs?.[id]?.name ?? id)
    const avatarFor = (id: string) => (id === playerId ? state.player.avatarId : state.npcs?.[id]?.avatarId)

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
          aAvatarId: avatarFor(r.aId),
          bAvatarId: avatarFor(r.bId),
          involvesPlayer,
        }
      })
      .sort((a, b) => {
        if (a.involvesPlayer !== b.involvesPlayer) return a.involvesPlayer ? -1 : 1
        return (b.strength ?? 0) - (a.strength ?? 0)
      })
  }, [state.relationships, state.npcs, state.player])

  const [openNpcId, setOpenNpcId] = useState<string | null>(null)

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
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <NpcAvatar avatarId={r.aAvatarId} alt={`${r.aName} avatar`} size={40} />
                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.aName}</div>
              </div>
              <div style={{ opacity: 0.7 }}>↔</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <NpcAvatar avatarId={r.bAvatarId} alt={`${r.bName} avatar`} size={40} />
                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.bName}</div>
              </div>
              <div style={{ color: r.involvesPlayer ? "#ffd21e" : "#ccc", minWidth: 90, textAlign: "right" }}>Strength {r.strength ?? 0}</div>
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
              {r.aId !== state.player.id && state.npcs?.[r.aId] ? <button onClick={() => setOpenNpcId(r.aId)}>Profile</button> : null}
              {r.bId !== state.player.id && state.npcs?.[r.bId] ? <button onClick={() => setOpenNpcId(r.bId)}>Profile</button> : null}
            </div>
            {r.tags?.length ? (
              <div style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 4 }}>{r.tags.join(", ")}</div>
            ) : null}
          </div>
        ))}

        <NpcProfileModal open={!!openNpcId} onClose={() => setOpenNpcId(null)} npcId={openNpcId ?? undefined} />

      </div>
    </div>
  )
}
