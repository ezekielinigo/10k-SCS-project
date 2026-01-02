import React, { useMemo } from "react"
import { View, Text, StyleSheet } from "react-native"
import { useGame } from "@shared/game/GameContext"
import { listAffiliations, getAffiliationById } from "@shared/game/content/affiliations"
import { getCareerForJobId, getJobById } from "@shared/game/content/careers"
import ModalCard from "./ModalCard.native"

export default function AffiliationMapModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useGame()

  const groups = useMemo(() => {
    const memberships = Object.values(state.memberships ?? {}) as any[]
    const memberLookup: Record<string, any> = { [state.player.id]: state.player, ...(state.npcs ?? {}) }
    const assignments = Object.values(state.jobAssignments ?? {})
    const jobInstances = state.jobInstances ?? {}

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

  return (
    <ModalCard open={open} onClose={onClose} title="Affiliation Map" maxHeight="80%">
      <Text style={styles.muted}>{groups.length} orgs</Text>
      {groups.length === 0 && <Text style={styles.muted}>No affiliations yet.</Text>}

      {groups.map(group => (
        <View key={group.id} style={styles.group}>
          <View style={styles.groupHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupTitle}>{group.affiliation?.name ?? group.id}</Text>
              {group.affiliation?.description ? <Text style={styles.muted}>{group.affiliation.description}</Text> : null}
              {group.affiliation?.tags?.length ? <Text style={styles.meta}>{group.affiliation.tags.join(", ")}</Text> : null}
            </View>
            <Text style={styles.muted}>{group.members.length} member{group.members.length === 1 ? "" : "s"}</Text>
          </View>

          <View style={{ marginTop: 6 }}>
            {group.members.length === 0 && <Text style={styles.muted}>No known members.</Text>}
            {group.members.map(m => (
              <View key={m.memberId} style={styles.memberRow}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.meta}>{m.jobs.join(", ") || "No job recorded"}</Text>
                <Text style={styles.muted}>Rep {m.reputation ?? 0}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ModalCard>
  )
}

const styles = StyleSheet.create({
  muted: { color: "#9fa3b5", marginBottom: 6 },
  meta: { color: "#9fa3b5", fontSize: 12, marginTop: 2 },
  group: { paddingVertical: 8, borderBottomWidth: 1, borderColor: "#1c1c28" },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupTitle: { color: "#fff", fontWeight: "800" },
  memberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  memberName: { color: "#fff", fontWeight: "700" },
})
