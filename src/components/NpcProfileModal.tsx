import { useMemo } from "react"
import { useGame } from "../game/GameContext"
import { useModalDismiss } from "../utils/ui"
import { getAffiliationById } from "../game/content/affiliations"
import { getJobById } from "../game/content/careers"
import NpcAvatar from "./NpcAvatar"

function Progress({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div style={{ background: "#222", borderRadius: 6, height: 10, width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: "#4caf50", borderRadius: 6 }} />
    </div>
  )
}

function SmallProgress({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div style={{ background: "#222", borderRadius: 4, height: 6, width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: "#1d6d1fff", borderRadius: 4 }} />
    </div>
  )
}

export default function NpcProfileModal({ open, onClose, npcId, npc }: { open: boolean; onClose: () => void; npcId?: string; npc?: any }) {
  const { state } = useGame()
  if (!open) return null

  const containerRef = useModalDismiss(onClose)

  const resolvedNpc = useMemo(() => {
    if (npc) return npc
    if (npcId) return state.npcs?.[npcId]
    return undefined
  }, [npc, npcId, state.npcs])

  if (!resolvedNpc) return null

  const members = Object.values(state.memberships ?? {}).filter((m: any) => m.memberId === resolvedNpc.id)
  const affNames = members.map((m: any) => getAffiliationById(m.affiliationId)?.name ?? m.affiliationId)

  const subSkillsMap = resolvedNpc.skills?.subSkills ?? {}
  const gender = resolvedNpc.gender ?? "male"
  const jobs = resolvedNpc.jobs ?? []
  const SUBSKILL_GROUPS: Record<string, string[]> = {
    STR: ["athletics", "closeCombat", "heavyHandling"],
    INT: ["hacking", "medical", "engineering"],
    REF: ["marksmanship", "stealth", "mobility"],
    CHR: ["persuasion", "deception", "streetwise"],
  }

  const pretty = (s: string) => s.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: "12px" }}>
      <div ref={containerRef as any} className="modal-card" style={{ background: "#111", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0 }}>{resolvedNpc.name}</h3>
            <div style={{ color: "#aaa", display: "flex", alignItems: "center", gap: 8 }}>
              <span>{gender}</span>
              <span>·</span>
              <span>Age {resolvedNpc.age}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <strong>District</strong>
            <div style={{ marginTop: 6 }}>{resolvedNpc.currentDistrict ?? "-"}</div>
          </div>
          <div>
            <strong>Tags</strong>
            <div style={{ marginTop: 6 }}>{(resolvedNpc.tags ?? []).join(", ") || "-"}</div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <strong>Affiliations</strong>
            <div style={{ marginTop: 6 }}>{affNames.length ? affNames.join(", ") : "None"}</div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <strong>Vitals</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Health</span><span>{resolvedNpc.vitals.health}</span></div>
                <Progress value={resolvedNpc.vitals.health} max={100} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Humanity</span><span>{resolvedNpc.vitals.humanity}</span></div>
                <Progress value={resolvedNpc.vitals.humanity} max={100} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Stress</span><span>{resolvedNpc.vitals.stress}</span></div>
                <Progress value={resolvedNpc.vitals.stress} max={100} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Looks</span><span>{resolvedNpc.vitals.looks}</span></div>
                <Progress value={resolvedNpc.vitals.looks} max={100} />
              </div>
            </div>
            <div style={{ marginTop: 8 }}><strong>Money</strong> <div>♦︎ {resolvedNpc.vitals.money}</div></div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <strong>Skills</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {/* STR */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>STR</span><span>{resolvedNpc.skills.str}</span></div>
                <Progress value={resolvedNpc.skills.str} max={10} />
                <div style={{ marginTop: 8 }}>
                  {SUBSKILL_GROUPS.STR.map(k => (
                    <div key={k} style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{(subSkillsMap as any)[k] ?? 0}</span></div>
                      <SmallProgress value={(subSkillsMap as any)[k] ?? 0} max={100} />
                    </div>
                  ))}
                </div>
              </div>

              {/* INT */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>INT</span><span>{resolvedNpc.skills.int}</span></div>
                <Progress value={resolvedNpc.skills.int} max={10} />
                <div style={{ marginTop: 8 }}>
                  {SUBSKILL_GROUPS.INT.map(k => (
                    <div key={k} style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{(subSkillsMap as any)[k] ?? 0}</span></div>
                      <SmallProgress value={(subSkillsMap as any)[k] ?? 0} max={100} />
                    </div>
                  ))}
                </div>
              </div>

              {/* REF */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>REF</span><span>{resolvedNpc.skills.ref}</span></div>
                <Progress value={resolvedNpc.skills.ref} max={10} />
                <div style={{ marginTop: 8 }}>
                  {SUBSKILL_GROUPS.REF.map(k => (
                    <div key={k} style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{(subSkillsMap as any)[k] ?? 0}</span></div>
                      <SmallProgress value={(subSkillsMap as any)[k] ?? 0} max={100} />
                    </div>
                  ))}
                </div>
              </div>

              {/* CHR */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>CHR</span><span>{resolvedNpc.skills.chr}</span></div>
                <Progress value={resolvedNpc.skills.chr} max={10} />
                <div style={{ marginTop: 8 }}>
                  {SUBSKILL_GROUPS.CHR.map(k => (
                    <div key={k} style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{(subSkillsMap as any)[k] ?? 0}</span></div>
                      <SmallProgress value={(subSkillsMap as any)[k] ?? 0} max={100} />
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
              {jobs.map((j, idx) => {
                const job = getJobById(j.jobId)
                const title = job?.title ?? j.jobId
                const affName = getAffiliationById(j.affiliationId ?? undefined)?.name ?? (j.affiliationId ?? "no_affiliation")
                return (
                  <div key={`${j.jobId}__${idx}`} style={{ padding: "0.5rem 0", borderBottom: "1px solid #222" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 700 }}>{title}</div>
                      <div style={{ color: "#aaa" }}>{affName}</div>
                    </div>
                    <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>{Array.isArray(job?.description) ? job?.description[0] : job?.description}</div>
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
