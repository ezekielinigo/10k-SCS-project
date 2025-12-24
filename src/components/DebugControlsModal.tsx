import ModalShell from "./ModalShell"
import { useGame } from "../game/GameContext"

export default function DebugControlsModal({ open, onClose, onShowProfile, onChangeJob, onShowAffiliationMap, onShowRelationships, onShowDebugNpcs, onOpenInk }: { open: boolean; onClose: () => void; onShowProfile?: () => void; onChangeJob?: () => void; onShowAffiliationMap?: () => void; onShowRelationships?: () => void; onShowDebugNpcs?: () => void; onOpenInk?: () => void }) {
	const { state, dispatch } = useGame()

	return (
		<ModalShell open={open} onClose={onClose} durationMs={200} style={{ padding: "1rem", minWidth: 320, borderRadius: 8, background: "#0c0c0f", border: "1px solid #333" }}>
		{({ requestClose }) => (
			<>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
				<strong>Debug Controls</strong>
				<button onClick={requestClose} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>✕</button>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
				<button onClick={async () => {
				const res = await awaitBuildContentContext(state)
				dispatch({ type: "ADD_LOG", text: res.text })
				}}>DEBUG: Tags</button>
				<button onClick={() => { if (onOpenInk) onOpenInk() }}>DEBUG: ink</button>
				<button onClick={() => { if (onShowProfile) onShowProfile() }}>DEBUG: Profile</button>
				<button onClick={() => { if (onChangeJob) onChangeJob() }}>DEBUG: Change Job</button>
				<button onClick={() => { if (onShowAffiliationMap) onShowAffiliationMap() }}>DEBUG: Affiliation Map</button>
				<button onClick={() => { if (onShowRelationships) onShowRelationships() }}>DEBUG: Relationships</button>
				<button onClick={() => { if (onShowDebugNpcs) onShowDebugNpcs() }}>DEBUG: Generate NPCs</button>
			</div>
			</>
		)}
		</ModalShell>
	)
}

// small helper to avoid importing buildContentContext here (keeps modal simple)
async function awaitBuildContentContext(state: any) {
  try {
    const mod = await import("../game/content/tagEngine")
    const ctx = mod.buildContentContext(state)
    const parts = [
      `jobTags: ${ctx.jobTags.join(", ") || "-"}`,
      `districtTags: ${ctx.districtTags.join(", ") || "-"}`,
      `npcTags: ${ctx.npcTags.join(", ") || "-"}`,
      `statTags: ${ctx.statTags.join(", ") || "-"}`,
      `playerTags: ${ctx.playerTags.join(", ") || "-"}`,
      `worldTags: ${ctx.worldTags.join(", ") || "-"}`,
    ]
    return { text: `TAGS — ${parts.join(" | ")}` }
  } catch (e) {
    return { text: `TAGS — error: ${String(e)}` }
  }
}
