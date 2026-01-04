import React from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import fontConfig from "@shared/utils/fontConfig"
const FACES = fontConfig.fontFaceNames()
import { useGame } from "@shared/game/GameContext"
import { listCareers, getJobById, getCareerForJobId } from "@shared/game/content/careers"
import { getAffiliationById } from "@shared/game/content/affiliations"
import ModalCard from "./ModalCard"

export default function ChangeJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useGame()

  const careers = listCareers()
  const jobInstances = Object.values(state.jobInstances ?? {}).filter(p => !p.filledBy)
  const currentAssignments = Object.values(state.jobAssignments ?? {}).filter(a => a.memberId === state.player.id)

  const handleTakeInstance = (instanceId: string) => {
    const instance = (state.jobInstances ?? {})[instanceId]
    const newJob = instance ? getJobById(instance.templateId) : undefined
    const newCareerId = newJob ? getCareerForJobId(newJob.id)?.id ?? null : null

    const existingAssignments = Object.values(state.jobAssignments ?? {}).filter(a => a.memberId === state.player.id)
    const hasSameCareer = existingAssignments.some(a => {
      const cj = getJobById(a.jobId)
      const cc = cj ? getCareerForJobId(cj.id)?.id ?? null : null
      return cc && newCareerId && cc === newCareerId
    })

    if (hasSameCareer) {
      dispatch({ type: "TAKE_JOB_INSTANCE", instanceId, replaceCareer: true })
    } else {
      dispatch({ type: "TAKE_JOB_INSTANCE", instanceId, replaceCareer: false })
    }
    onClose()
  }

  return (
    <ModalCard open={open} onClose={onClose} title="Change Job">
      <Text style={styles.muted}>Current: {currentAssignments.length === 0 ? "Unemployed" : currentAssignments.map(a => a.jobId).join(", ")}</Text>

      {jobInstances.length > 0 ? (
        <View style={styles.listBox}>
          {jobInstances.map(inst => {
            const job = getJobById(inst.templateId)
            const career = job ? careers.find(c => c.levels.some(l => l.id === job.id)) : undefined
            const affId = inst.affiliationId ?? (career?.affiliationId?.[0] ?? null)
            const employerName = getAffiliationById(affId ?? undefined)?.name ?? affId ?? "-"
            const salaryText = inst.salary != null ? `♦︎ ${inst.salary}` : job?.salary != null ? `♦︎ ${job.salary}` : ""
            const desc = inst.description ?? (Array.isArray(job?.description) ? job?.description[0] : job?.description)
            return (
              <View key={inst.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{job?.title ?? inst.templateId}</Text>
                  {desc ? <Text style={styles.muted}>{desc}</Text> : null}
                  <Text style={styles.meta}>{employerName}{salaryText ? ` • ${salaryText}` : ""}</Text>
                </View>
                <Pressable style={styles.action} onPress={() => handleTakeInstance(inst.id)}>
                  <Text style={styles.actionText}>Take</Text>
                </Pressable>
              </View>
            )
          })}
        </View>
      ) : (
        <Text style={styles.muted}>No job instances available.</Text>
      )}
    </ModalCard>
  )
}

const styles = StyleSheet.create({
  muted: { color: "#9fa3b5", marginBottom: 6 },
  listBox: { borderWidth: 1, borderColor: "#1f1f29", borderRadius: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderBottomWidth: 1, borderColor: "#1f1f29" },
  title: { color: "#fff", fontFamily: FACES.BOLD },
  meta: { color: "#9fa3b5", fontSize: 12, marginTop: 2 },
  action: { backgroundColor: "#1b5cff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: "#fff", fontFamily: FACES.BOLD },
})
