import { useState } from "react"
import ModalShell from "./ModalShell"
import { performStatCheck, makeRng } from "../game/statCheck"
import { useGame } from "../game/GameContext"
import type { MainStatKey, SubSkillKey } from "../game/statCheck"
import type { StatCheckResult } from "../game/statCheck"


export default function DebugControlsModal({ open, onClose, onShowProfile, onChangeJob, onShowAffiliationMap, onShowRelationships, onShowDebugNpcs, onOpenInk, onOpenDistrict, onOpenStatCheck }: { open: boolean; onClose: () => void; onShowProfile?: () => void; onChangeJob?: () => void; onShowAffiliationMap?: () => void; onShowRelationships?: () => void; onShowDebugNpcs?: () => void; onOpenInk?: () => void; onOpenDistrict?: () => void; onOpenStatCheck?: (config: { dc: number; mainStatKey: MainStatKey; subSkillKey: SubSkillKey }, result: StatCheckResult) => void }) {
	const { state, dispatch } = useGame()

	const launchRandomCheck = () => {
		const mainStatKey = pick(MAIN_KEYS)
		const subSkillKey = pick(SUB_SKILL_KEYS)
		const mainVal = state.player?.skills?.[mainStatKey] ?? 0
		const subVal = state.player?.skills?.subSkills?.[subSkillKey] ?? 0
		const dc = randInt(8, 22)
		const res = performStatCheck({ dc, mainStat: mainVal, subSkill: subVal, rng: makeRng() })
		const text = [
			"STAT CHECK",
			`${mainStatKey.toUpperCase()}/${subSkillKey.toUpperCase()}`,
			`d20=${res.d20}`,
			`main=+${res.mainStat}`,
			`sub=+${res.subSkillBonus}`,
			`total=${res.total}`,
			`vs DC ${res.dc}`,
			res.success ? "SUCCESS" : "FAIL",
			res.critical ? `(${res.critical})` : "",
		].filter(Boolean).join(" ")
		// notify parent to open stat-check modal with config and result
		if (onOpenStatCheck) onOpenStatCheck({ dc, mainStatKey, subSkillKey }, res)
		dispatch({ type: "ADD_LOG", text })
	}

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
					requestClose()
				}}>DEBUG: Tags</button>
				<button onClick={() => { if (onOpenInk) onOpenInk(); requestClose() }}>DEBUG: ink</button>
				<button onClick={() => { if (onShowProfile) onShowProfile(); requestClose() }}>DEBUG: Profile</button>
				<button onClick={() => { if (onChangeJob) onChangeJob(); requestClose() }}>DEBUG: Change Job</button>
				<button onClick={() => { if (onOpenDistrict) onOpenDistrict(); requestClose() }}>DEBUG: Change District</button>
				<button onClick={() => { if (onShowAffiliationMap) onShowAffiliationMap(); requestClose() }}>DEBUG: Affiliation Map</button>
				<button onClick={() => { if (onShowRelationships) onShowRelationships(); requestClose() }}>DEBUG: Relationships</button>
				<button onClick={() => { if (onShowDebugNpcs) onShowDebugNpcs(); requestClose() }}>DEBUG: Generate NPCs</button>
				<button onClick={() => { launchRandomCheck(); requestClose() }}>DEBUG: Random Stat Check</button>
			</div>

			{/* stat-check and district modals are lifted to parent App.tsx */}
			</>
		)}
		</ModalShell>
	)
}

const MAIN_KEYS: MainStatKey[] = ["str", "int", "ref", "chr"]
const SUB_SKILL_KEYS: SubSkillKey[] = [
	"athletics",
	"closeCombat",
	"heavyHandling",
	"hacking",
	"medical",
	"engineering",
	"marksmanship",
	"stealth",
	"mobility",
	"persuasion",
	"deception",
	"streetwise",
]

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min
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
