import { FiX, FiPlusSquare, FiZap, FiInstagram, FiSmile, FiDollarSign, FiEye } from "react-icons/fi"
import ModalShell from "./ModalShell"

const SKILL_COLORS: Record<string, string> = {
  DEF_: "#888888",
  STR: "#ff1053",
  INT: "#47A8BD",
  REF: "#2C6E49",
  CHR: "#F5E663",
}

export type ProfileOccupation = {
  id: string
  jobId?: string
  title: string
  affiliation: string
  description?: string
  removable?: boolean
}

export type ProfileData = {
  name: string
  ageLabel: string
  gender: string
  districtLabel: string
  tags: string[]
  affiliations: string[]
  vitals: { health: number; humanity: number; stress: number; looks: number; money: number; bounty: number; popularity: number }
  skills: { str: number; int: number; ref: number; chr: number; subSkills?: Record<string, number> }
  occupations: ProfileOccupation[]
  showAffiliations?: boolean
  canEditAssignments?: boolean
}

function Progress({ value, max = 100, color = SKILL_COLORS.DEF_ }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div style={{ background: "#222", borderRadius: 6, height: 10, width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6 }} />
    </div>
  )
}

function SmallProgress({ value, max = 100, height = 10, color = SKILL_COLORS.DEF_, bg = "#222" }: { value: number; max?: number; height?: number; color?: string; bg?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  const radius = Math.max(2, Math.round(height / 2))
  return (
    <div style={{ background: bg, borderRadius: radius, height: 5, width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: radius }} />
    </div>
  )
}

function SegmentedBar({ value, max = 10, segments = 10, height = 48, width = 40, color = SKILL_COLORS.DEF_ }: { value: number; max?: number; segments?: number; height?: number; width?: number; color?: string }) {
  const segs = Math.max(1, Math.floor(segments))
  const clampedValue = Math.max(0, Math.min(max, Number(value) || 0))
  const filledCount = Math.round((clampedValue / max) * segs)
  const gap = 2
  const totalGap = gap * Math.max(0, segs - 1)
  const segmentHeight = Math.max(4, Math.floor((height - totalGap) / segs))

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column-reverse", gap: `${gap}px`, height, width }}>
        {Array.from({ length: segs }).map((_, i) => {
          const filled = i < filledCount
          return (
            <div
              key={i}
              style={{
                height: `${segmentHeight}px`,
                width: "100%",
                background: filled ? color : "#222",
                borderRadius: 4,
                boxSizing: "border-box",
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

const SUBSKILL_GROUPS: Record<string, string[]> = {
  STR: ["athletics", "closeCombat", "heavyHandling"],
  INT: ["hacking", "medical", "engineering"],
  REF: ["marksmanship", "stealth", "mobility"],
  CHR: ["persuasion", "deception", "streetwise"],
}

const pretty = (s: string) => s.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase())

export default function ProfileModal({ open, onClose, profile, onRemoveAssignment }: { open: boolean; onClose: () => void; profile?: ProfileData | null; onRemoveAssignment?: (jobId: string) => void }) {
  if (!profile) return null

  const subSkillsMap = profile.skills.subSkills ?? {}

  return (
    <ModalShell open={open} onClose={onClose} durationMs={200} style={{ padding: "12px", borderRadius: 8, maxWidth: 900 }}>
      {() => (
        <>

            { /************************************* Basic Info Section *******************************************/ }

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0 }}>{profile.name}</h3>
            <div style={{ color: "#aaa", display: "flex", alignItems: "center", gap: 8 }}>
              <span>{profile.gender}</span>
              <span>·</span>
              <span>{profile.ageLabel}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <strong>District</strong>
              <div style={{ marginBottom: 6 }}>{profile.districtLabel || "-"}</div>
            </div>
            <div>
              <strong>Tags</strong>
              <div style={{ marginBottom: 6 }}>{profile.tags.length ? profile.tags.join(", ") : "-"}</div>
            </div>

            {(profile.showAffiliations || (profile.affiliations?.length ?? 0) > 0) && (
              <div style={{ gridColumn: "1 / -1" }}>
                <strong>Affiliations</strong>
                <div style={{ marginBottom: 6 }}>{profile.affiliations.length ? profile.affiliations.join(", ") : "None"}</div>
              </div>
            )}

            { /************************************* Vitals Section *******************************************/ }

            <div style={{ gridColumn: "1 / -1" }}>
              <strong>Vitals</strong>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiPlusSquare /> <span>Health</span></span>
                    <span>{profile.vitals.health}</span>
                  </div>
                  <SmallProgress value={profile.vitals.health} max={100} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiZap /> <span>Stress</span></span>
                    <span>{profile.vitals.stress}</span>
                  </div>
                  <SmallProgress value={profile.vitals.stress} max={100} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiDollarSign /> <span>Bounty</span></span>
                    <span>{profile.vitals.bounty}</span>
                  </div>
                  <SmallProgress value={profile.vitals.bounty} max={2000} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiSmile /> <span>Humanity</span></span>
                    <span>{profile.vitals.humanity}</span>
                  </div>
                  <SmallProgress value={profile.vitals.humanity} max={100} />
                </div>
                
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiEye /> <span>Looks</span></span>
                    <span>{profile.vitals.looks}</span>
                  </div>
                  <SmallProgress value={profile.vitals.looks} max={100} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiInstagram /> <span>Popularity</span></span>
                    <span>{profile.vitals.popularity}</span>
                  </div>
                  <SmallProgress value={profile.vitals.popularity} max={100} />
                </div>
              </div>
            </div>

            { /************************************* Skills Section *******************************************/ }

            <div style={{ gridColumn: "1 / -1" }}>
              <strong>Skills</strong>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"}}>
                    <div style={{ marginBottom: 5 }}>STR {profile.skills.str}</div>
                    <SegmentedBar value={profile.skills.str} max={10} segments={10} color={SKILL_COLORS.STR} />
                  </div>
                  <div style={{ flex: 1, marginTop: 12 }}>
                    {SUBSKILL_GROUPS.STR.map(k => (
                      <div key={k} style={{  }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{subSkillsMap?.[k] ?? 0}</span></div>
                        <SmallProgress value={subSkillsMap?.[k] ?? 0} max={100} color={SKILL_COLORS.STR} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ marginBottom: 5 }}>INT {profile.skills.int}</div>
                    <SegmentedBar value={profile.skills.int} max={10} segments={10} color={SKILL_COLORS.INT} />
                  </div>
                  <div style={{ flex: 1, marginTop: 12 }}>
                    {SUBSKILL_GROUPS.INT.map(k => (
                      <div key={k} style={{  }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{subSkillsMap?.[k] ?? 0}</span></div>
                        <SmallProgress value={subSkillsMap?.[k] ?? 0} max={100} color={SKILL_COLORS.INT} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ marginBottom: 5 }}>REF {profile.skills.ref}</div>
                    <SegmentedBar value={profile.skills.ref} max={10} segments={10} color={SKILL_COLORS.REF} />
                  </div>
                  <div style={{ flex: 1, marginTop: 12 }}>
                    {SUBSKILL_GROUPS.REF.map(k => (
                      <div key={k} style={{  }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{subSkillsMap?.[k] ?? 0}</span></div>
                        <SmallProgress value={subSkillsMap?.[k] ?? 0} max={100} color={SKILL_COLORS.REF} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ marginBottom: 5 }}>CHR {profile.skills.chr}</div>
                    <SegmentedBar value={profile.skills.chr} max={10} segments={10} color={SKILL_COLORS.CHR} />
                  </div>
                  <div style={{ flex: 1, marginTop: 12 }}>
                    {SUBSKILL_GROUPS.CHR.map(k => (
                      <div key={k} style={{  }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{pretty(k)}</span><span>{subSkillsMap?.[k] ?? 0}</span></div>
                        <SmallProgress value={subSkillsMap?.[k] ?? 0} max={100} color={SKILL_COLORS.CHR} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            { /************************************* Occupation Section *******************************************/ }

            <div style={{ gridColumn: "1 / -1" }}>
              <strong>Occupations</strong>
              <div style={{ marginBottom: 8 }}>
                {profile.occupations.length === 0 && <div>Unemployed</div>}
                {profile.occupations.map(o => (
                  <div key={o.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 700 }}>{o.title}</div>
                        <div style={{ color: "#aaa" }}>{o.affiliation}</div>
                      </div>
                      <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>{o.description ?? ""}</div>
                    </div>
                    {o.removable && onRemoveAssignment && (
                      <div style={{ marginLeft: 12 }}>
                        <button onClick={() => {
                          const ok = window.confirm(`Remove assignment for ${o.title}?`)
                          if (!ok) return
                          onRemoveAssignment(o.jobId ?? o.id)
                        }}>
                          <FiX size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </ModalShell>
  )
}
