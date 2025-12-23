import { useMemo, useState } from "react"
import { useGame } from "../game/GameContext"
import { generateNpcBatch } from "../game/generators/npcGenerator"
import { getAffiliationById } from "../game/content/affiliations"
import ModalShell from "./ModalShell"
import NpcAvatar from "./NpcAvatar"
import NpcProfileModal from "./NpcProfileModal"
import { FiBookmark, FiUser} from "react-icons/fi"

export default function DebugNpcModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useGame()
  // useMemo / useState hooks run before rendering ModalShell to keep hook order stable

  const npcs = useMemo(() => {
    if (!open) return []
    // seed with month so list changes each month, plus log length for slight variance
    const seed = `debug-npcs-${state.month}-${state.log.length}`
    return generateNpcBatch(5, { seed, allowUnique: false })
  }, [open, state.month, state.log.length])

  const handleConnect = (idx: number) => {
    const npc = npcs[idx]
    if (!npc) return
    // randomized placeholder relationship strength for debug connections
    const strength = Math.floor(Math.random() * 101) // 0-100
    dispatch({ type: "CONNECT_NPC", npc, affiliations: npc.affiliationIds, relationshipStrength: strength })
  }

  const [openNpc, setOpenNpc] = useState<any | null>(null)

  return (
    <ModalShell open={open} onClose={onClose} durationMs={200} style={{ padding: "1rem", width: 760, maxHeight: "80vh", overflowY: "auto", borderRadius: 8 }}>
      {({ containerRef, closing, requestClose, durationMs }) => (
        <>
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
                    <button onClick={() => handleConnect(i)}>
                      < FiBookmark size={20} />
                    </button>
                    <button onClick={() => setOpenNpc(npc)}>
                      < FiUser size={20} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          <NpcProfileModal open={!!openNpc} onClose={() => setOpenNpc(null)} npc={openNpc ?? undefined} />
        </>
      )}
    </ModalShell>
  )
}
