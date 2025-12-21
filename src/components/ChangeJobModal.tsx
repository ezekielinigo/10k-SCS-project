// React import not required with new JSX runtime
import { useGame } from "../game/GameContext"
import { useModalDismiss } from "../utils/ui"
import { listCareers, getJobById, getCareerForJobId } from "../game/content/careers"
import { getAffiliationById } from "../game/content/affiliations"

export default function ChangeJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useGame()

  if (!open) return null

  const containerRef = useModalDismiss(onClose)

  const careers = listCareers()

  const jobInstances = Object.values(state.jobInstances ?? {}).filter(p => !p.filledBy)

  const currentAssignments = Object.values(state.jobAssignments ?? {}).filter(a => a.memberId === state.player.id)



  const handleTakeInstance = (instanceId: string) => {
    const instance = (state.jobInstances ?? {})[instanceId]
    const newJob = instance ? getJobById(instance.templateId) : undefined
    const newCareerId = newJob ? getCareerForJobId(newJob.id)?.id ?? null : null

    // detect if player already has a job in this career
    const existingAssignments = Object.values(state.jobAssignments ?? {}).filter(a => a.memberId === state.player.id)
    const hasSameCareer = existingAssignments.some(a => {
      const cj = getJobById(a.jobId)
      const cc = cj ? getCareerForJobId(cj.id)?.id ?? null : null
      return cc && newCareerId && cc === newCareerId
    })

    if (hasSameCareer) {
      const ok = window.confirm("You already have a job in this career. Taking this will replace that job. Continue?")
      if (!ok) return
      dispatch({ type: "TAKE_JOB_INSTANCE", instanceId, replaceCareer: true })
    } else {
      dispatch({ type: "TAKE_JOB_INSTANCE", instanceId, replaceCareer: false })
    }
    onClose()
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div ref={containerRef as any} style={{ background: "#111", color: "#fff", padding: "1rem", width: 640, borderRadius: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Change Job</h3>
          </div>
          <div>
            <strong>Current:</strong> {currentAssignments.length === 0 ? 'Unemployed' : currentAssignments.map(a => a.jobId).join(', ')}
          </div>

          {jobInstances.length > 0 && (
            <div style={{ border: "1px solid #444", borderRadius: 6, padding: "0.5rem" }}>
              {jobInstances.map(inst => {
                const job = getJobById(inst.templateId)
                const career = job ? careers.find(c => c.levels.some(l => l.id === job.id)) : undefined
                const affId = inst.affiliationId ?? (career?.affiliationId?.[0] ?? null)
                const employerName = getAffiliationById(affId ?? undefined)?.name ?? affId ?? "-"
                const salaryText = inst.salary != null ? `♦︎ ${inst.salary}` : job?.salary != null ? `♦︎ ${job.salary}` : ""
                const desc = inst.description ?? (Array.isArray(job?.description) ? job?.description[0] : job?.description)
                return (
                  <div key={inst.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{job?.title ?? inst.templateId}</div>
                      <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>{desc}</div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>{employerName}{salaryText ? ` • ${salaryText}` : ""}</div>
                    </div>
                    <div>
                      <button onClick={() => handleTakeInstance(inst.id)} style={{ marginRight: 8 }}>Take</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {jobInstances.length === 0 && (
            <div style={{ padding: "0.5rem" }}>No job instances available.</div>
          )}

          
        </div>
      </div>
    </div>
  )
}
