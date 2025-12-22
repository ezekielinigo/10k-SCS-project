import { useMemo } from "react"
import { useGame } from "../game/GameContext"
import { listAffiliations, getAffiliationById } from "../game/content/affiliations"
import { getCareerForJobId, getJobById } from "../game/content/careers"
import { useModalDismiss } from "../utils/ui"

export default function AffiliationMapModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useGame()

  const containerRef = useModalDismiss(onClose)

  const groups = useMemo(() => {
    const memberships = Object.values(state.memberships ?? {}) as any[]
    const memberLookup: Record<string, any> = { [state.player.id]: state.player, ...(state.npcs ?? {}) }
    const assignments = Object.values(state.jobAssignments ?? {})
    const jobInstances = state.jobInstances ?? {}

    // Map member -> affiliation -> job titles for that affiliation
    const jobTitlesByMemberAff: Record<string, Record<string, string[]>> = {}

    const resolveAffs = (jobId: string, memberId: string): string[] => {
      const posting = Object.values(jobInstances).find(p => p.templateId === jobId && p.filledBy === memberId && p.affiliationId)
      if (posting?.affiliationId) return [posting.affiliationId]
      const careerAffs = getCareerForJobId(jobId)?.affiliationId ?? []
      return careerAffs.length ? [careerAffs[0]] : []
    }

    for (const a of assignments) {
      const job = getJobById(a.jobId)
      if (!job) continue
      for (const affId of resolveAffs(a.jobId, a.memberId)) {
        if (!jobTitlesByMemberAff[a.memberId]) jobTitlesByMemberAff[a.memberId] = {}
        if (!jobTitlesByMemberAff[a.memberId][affId]) jobTitlesByMemberAff[a.memberId][affId] = []
        jobTitlesByMemberAff[a.memberId][affId].push(job.title)
      }
    }

    // Include procedurally attached jobs stored on NPCs (generated but saved)
    for (const [npcId, npc] of Object.entries(state.npcs ?? {})) {
      const npcJobs = (npc as any).jobs ?? []
      for (const j of npcJobs) {
        const job = getJobById(j.jobId)
        const affId = j.affiliationId ?? null
        if (!job) continue
        if (!jobTitlesByMemberAff[npcId]) jobTitlesByMemberAff[npcId] = {}
        const key = affId ?? "no_affiliation"
        if (!jobTitlesByMemberAff[npcId][key]) jobTitlesByMemberAff[npcId][key] = []
        jobTitlesByMemberAff[npcId][key].push(job.title)
      }
    }

    const knownAffIds = new Set<string>()
    memberships.forEach(m => knownAffIds.add(m.affiliationId))
    listAffiliations().forEach(a => knownAffIds.add(a.id))

    return Array.from(knownAffIds)
      .map(id => {
        const affMemberships = memberships.filter(m => m.affiliationId === id)
        const members = affMemberships.map(m => ({
          memberId: m.memberId,
          name: memberLookup[m.memberId]?.name ?? m.memberId,
          jobs: jobTitlesByMemberAff[m.memberId]?.[id] ?? [],
          reputation: m.reputation,
        }))
        const affiliation = getAffiliationById(id)
        return { id, affiliation, members }
      })
      .sort((a, b) => (a.affiliation?.name ?? a.id).localeCompare(b.affiliation?.name ?? b.id))
  }, [state.memberships, state.npcs, state.player, state.jobAssignments])

  if (!open) return null

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div ref={containerRef as any} style={{ background: "#111", color: "#fff", padding: "1rem", width: 720, maxHeight: "80vh", overflowY: "auto", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Affiliation Map</h3>
          <span style={{ opacity: 0.7, fontSize: "0.9rem" }}>{groups.length} orgs</span>
        </div>

        {groups.length === 0 && <div>No affiliations yet.</div>}

        {groups.map(group => (
          <div key={group.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #222" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{group.affiliation?.name ?? group.id}</div>
                {group.affiliation?.description && (
                  <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>{group.affiliation.description}</div>
                )}
                {group.affiliation?.tags?.length ? (
                  <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: 4 }}>{group.affiliation.tags.join(", ")}</div>
                ) : null}
              </div>
              <div style={{ color: "#aaa", minWidth: 80, textAlign: "right" }}>{group.members.length} member{group.members.length === 1 ? "" : "s"}</div>
            </div>

            <div style={{ marginTop: 6, paddingLeft: 4 }}>
              {group.members.length === 0 && <div style={{ opacity: 0.7 }}>No known members.</div>}
              {group.members.map(m => (
                <div key={m.memberId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>{m.jobs.join(", ") || "No job recorded"}</div>
                  <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>Rep {m.reputation ?? 0}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
