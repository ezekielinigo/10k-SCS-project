import { useMemo } from "react"
import { useGame } from "../game/GameContext"
import ModalShell from "./ModalShell"
import DISTRICTS, { getDistrictById } from "../game/content/districts"
import { LuCar } from "react-icons/lu"

export default function ChangeDistrictModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useGame()

  const districts = useMemo(() => Object.values(DISTRICTS), [])

  const currentId = state.player?.currentDistrict ?? null

  const handleChange = (id: string) => {
    if (!id) return
    dispatch({ type: "SET_PLAYER_DISTRICT", districtId: id })
    onClose()
  }

  return (
    <ModalShell open={open} onClose={onClose} durationMs={200} style={{ padding: "1rem", width: 640, borderRadius: 8 }}>
      {() => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Change District</h3>
          </div>

          <div>
            <strong>Current:</strong> {getDistrictById(currentId ?? "")?.name ?? (currentId ?? "-")}
          </div>

          <div style={{ border: "1px solid #444", borderRadius: 6, padding: "0.5rem" }}>
            {districts.map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{d.name}</div>
                  <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>{d.description ?? (d.tags ? d.tags.join(', ') : '')}</div>
                </div>
                <div>
                  <button onClick={() => handleChange(d.id)} style={{ marginRight: 8 }}>
                    <LuCar size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  )
}
