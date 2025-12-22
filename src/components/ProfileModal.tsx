import { useGame } from "../game/GameContext"
import { useModalDismiss } from "../utils/ui"
import { getAffiliationById } from "../game/content/affiliations"
import { getCareerForJobId, getJobById } from "../game/content/careers"

function Progress({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div style={{ background: "#222", borderRadius: 6, height: 10, width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: "#4caf50", borderRadius: 6 }} />
    </div>
  )
}

function SmallProgress({ value, max = 100, height = 10, color = "#1d6d1fff", bg = "#222" }: { value: number; max?: number; height?: number; color?: string; bg?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  const radius = Math.max(2, Math.round(height / 2))
  return (
    <div style={{ background: bg, borderRadius: radius, height: 5, width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: radius }} />
    </div>
  )
}
export default function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useGame()
  const player = state.player

  if (!open) return null

  const containerRef = useModalDismiss(onClose)

  const assignments = Object.values(state.jobAssignments ?? {}).filter(a => a.memberId === player.id)
  const jobsRaw = assignments.map(a => getJobById(a.jobId))
  const jobs = jobsRaw.filter((j): j is NonNullable<typeof j> => !!j)
  const memberships = Object.values(state.memberships ?? {}).filter((m: any) => m.memberId === player.id)
  const subSkillsMap = player.skills.subSkills as Record<string, number>
  const tags = (player.tags ?? [])

  const ageYears = Math.floor((player.ageMonths ?? 0) / 12)
  const gender = player.gender ?? "male"

  const jobAffiliationName = (job: any) => {
    // prefer membership matching career's affiliation, otherwise any membership
    const career = getCareerForJobId(job?.id)
    const candidateAffIds: string[] = career?.affiliationId ?? []
    let affId = memberships.find(m => candidateAffIds.includes(m.affiliationId))?.affiliationId
    if (!affId && memberships.length > 0) affId = memberships[0].affiliationId
    return affId ? getAffiliationById(affId)?.name ?? affId : "-"
  }

  const SUBSKILL_GROUPS: Record<string, string[]> = {
    STR: ["athletics", "closeCombat", "heavyHandling"],
    INT: ["hacking", "medical", "engineering"],
    REF: ["marksmanship", "stealth", "mobility"],
    CHR: ["persuasion", "deception", "streetwise"],
  }

  const pretty = (s: string) => s.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: "12px" }}>
      <div ref={containerRef as any} className="modal-card" style={{ background: "#111", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>{player.name}</h3>
          <div style={{ color: "#aaa", display: "flex", alignItems: "center", gap: 8 }}>
            <span>{gender}</span>
            <span>·</span>
            <span>{ageYears} yr{ageYears !== 1 ? "s" : ""}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <strong>Home / Current District</strong>
            <div style={{ marginTop: 6 }}>{player.currentDistrict ?? "-"}</div>
          </div>

          <div>
            <strong>Tags</strong>
            <div style={{ marginTop: 6 }}>{tags.length ? tags.join(", ") : "-"}</div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <strong>Vitals</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Health</span><span>{player.vitals.health}</span></div>
                <Progress value={player.vitals.health} max={100} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Humanity</span><span>{player.vitals.humanity}</span></div>
                <Progress value={player.vitals.humanity} max={100} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Stress</span><span>{player.vitals.stress}</span></div>
                <Progress value={player.vitals.stress} max={100} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Looks</span><span>{player.vitals.looks}</span></div>
                <Progress value={player.vitals.looks} max={100} />
              </div>
            </div>
            <div style={{ marginTop: 8 }}><strong>Money</strong> <div>♦︎ {player.vitals.money}</div></div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <strong>Skills</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>STR</span><span>{player.skills.str}</span></div>
                <Progress value={player.skills.str} max={10} />
                <div style={{ marginTop: 8 }}>
                  {SUBSKILL_GROUPS.STR.map(k => (
                    <div key={k} style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{(subSkillsMap?.[k] ?? 0)}</span></div>
                      <SmallProgress value={subSkillsMap?.[k] ?? 0} max={100} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>INT</span><span>{player.skills.int}</span></div>
                <Progress value={player.skills.int} max={10} />
                <div style={{ marginTop: 8 }}>
                  {SUBSKILL_GROUPS.INT.map(k => (
                    <div key={k} style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{(subSkillsMap?.[k] ?? 0)}</span></div>
                      <SmallProgress value={subSkillsMap?.[k] ?? 0} max={100} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>REF</span><span>{player.skills.ref}</span></div>
                <Progress value={player.skills.ref} max={10} />
                <div style={{ marginTop: 8 }}>
                  {SUBSKILL_GROUPS.REF.map(k => (
                    <div key={k} style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{(subSkillsMap?.[k] ?? 0)}</span></div>
                      <SmallProgress value={subSkillsMap?.[k] ?? 0} max={100} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>CHR</span><span>{player.skills.chr}</span></div>
                <Progress value={player.skills.chr} max={10} />
                <div style={{ marginTop: 8 }}>
                  {SUBSKILL_GROUPS.CHR.map(k => (
                    <div key={k} style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{(subSkillsMap?.[k] ?? 0)}</span></div>
                      <SmallProgress value={subSkillsMap?.[k] ?? 0} max={100} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <strong>Occupations</strong>
            <div style={{ marginTop: 8 }}>
              {jobs.length === 0 && <div>Unemployed</div>}
              {assignments.map(a => {
                const job = getJobById(a.jobId)
                if (!job) return null
                return (
                  <div key={a.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 700 }}>{job.title}</div>
                        <div style={{ color: "#aaa" }}>{jobAffiliationName(job)}</div>
                      </div>
                      <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>{Array.isArray(job.description) ? job.description[0] : job.description}</div>
                    </div>
                    <div style={{ marginLeft: 12 }}>
                      <button onClick={() => {
                        const ok = window.confirm(`Remove assignment for ${job.title}?`)
                        if (!ok) return
                        dispatch({ type: "REMOVE_JOB_ASSIGNMENT", jobId: job.id })
                      }}>Unassign</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
