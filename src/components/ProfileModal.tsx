import React from "react"
import { useGame } from "../game/GameContext"
import { getAffiliationById } from "../game/content/affiliations"
import { getCareerForJobId, getJobById } from "../game/content/careers"

export default function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useGame()
  const player = state.player
  const assignments = Object.values(state.jobAssignments ?? {}).filter(a => a.memberId === player.id)
  const jobs = assignments.map(a => getJobById(a.jobId)).filter(Boolean)
  const membership = Object.values(state.memberships ?? {}).find(m => m.memberId === player.id)
  const subSkillEntries = Object.entries(player.skills.subSkills ?? {})
  const tags = (player.tags ?? []).join(", ") || "-"

  if (!open) return null

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div style={{ background: "#111", color: "#fff", padding: "1rem", width: 640, borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{player.name} — Profile</h3>
          <button onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <div>
            <strong>ID</strong>
            <div>{player.id}</div>
          </div>
          <div>
            <strong>Profile</strong>
            <div>{player.profileId}</div>
          </div>

          <div>
            <strong>Age (months)</strong>
            <div>{player.ageMonths}</div>
          </div>
          <div>
            <strong>Current District</strong>
            <div>{player.currentDistrict}</div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <strong>Vitals</strong>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
              <div>Health: {player.vitals.health}</div>
              <div>Humanity: {player.vitals.humanity}</div>
              <div>Stress: {player.vitals.stress}</div>
              <div>Looks: {player.vitals.looks}</div>
              <div>Money: ¤{player.vitals.money}</div>
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <strong>Skills</strong>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
              <div>STR: {player.skills.str}</div>
              <div>INT: {player.skills.int}</div>
              <div>REF: {player.skills.ref}</div>
              <div>CHR: {player.skills.chr}</div>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <em>Subskills:</em>
              <div style={{ marginTop: "0.25rem" }}>{subSkillEntries.map(([k, v]) => (
                <span key={k} style={{ marginRight: 8 }}>{k}: {v}</span>
              ))}</div>
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <strong>Tags</strong>
            <div style={{ marginTop: "0.25rem" }}>{tags}</div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <strong>Occupation</strong>
            <div style={{ marginTop: "0.25rem" }}>
              {(() => {
                if (jobs.length === 0) return "Unemployed"
                const titles = jobs.map(j => j?.title).filter(Boolean) as string[]
                return titles.join(titles.length > 2 ? ", " : " & ")
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
