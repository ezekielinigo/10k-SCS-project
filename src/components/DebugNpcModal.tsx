import { useMemo, useState } from "react"
import { useGame } from "../game/GameContext"
import { generateNpcBatch } from "../game/generators/npcGenerator"
import { getAffiliationById } from "../game/content/affiliations"
import { useModalDismiss } from "../utils/ui"
import NpcAvatar from "./NpcAvatar"
import NpcProfileModal from "./NpcProfileModal"

export default function DebugNpcModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useGame()
  const containerRef = useModalDismiss(onClose)

  const npcs = useMemo(() => {
    if (!open) return []
    // seed with month so list changes each month, plus log length for slight variance
    const seed = `debug-npcs-${state.month}-${state.log.length}`
    return generateNpcBatch(5, { seed, allowUnique: false })
  }, [open, state.month, state.log.length])

  const handleConnect = (idx: number) => {
    const npc = npcs[idx]
    if (!npc) return
    dispatch({ type: "CONNECT_NPC", npc, affiliations: npc.affiliationIds })
  }

  const [openNpc, setOpenNpc] = useState<any | null>(null)

  if (!open) return null

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90 }}>
      <div ref={containerRef as any} style={{ background: "#111", color: "#fff", padding: "1rem", width: 760, maxHeight: "80vh", overflowY: "auto", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>DEBUG: Generate NPCs</h3>
          <span style={{ opacity: 0.7, fontSize: "0.9rem" }}>5 candidates (resets each month)</span>
        </div>

        {npcs.length === 0 && <div>No candidates.</div>}

        {npcs.map((npc, i) => {
          const affiliations = npc.affiliationIds ?? []
          const affNames = affiliations
            .map(a => getAffiliationById(a)?.name ?? a)
            .filter(Boolean)
            .join(", ") || "None"

          return (
            <div key={npc.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #222" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "row" }}>
                  <NpcAvatar avatarId={npc.avatarId} alt={`${npc.name} avatar`} size={80} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{npc.name}</div>
                    <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>Age {npc.age} · District {npc.currentDistrict}</div>
                    <div style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 2 }}>{npc.tags.join(", ") || "No tags"}</div>
                    <div style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 2 }}>Affiliations: {affNames}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => handleConnect(i)}>Connect</button>
                  <button onClick={() => setOpenNpc(npc)}>Profile</button>
                </div>
              </div>
            </div>
          )
        })}
        <NpcProfileModal open={!!openNpc} onClose={() => setOpenNpc(null)} npc={openNpc ?? undefined} />
      </div>
    </div>
  )
}
