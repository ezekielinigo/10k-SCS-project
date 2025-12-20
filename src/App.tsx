import { getAffiliationById } from "./game/content/affiliations.ts"
import { getJobById, listCareers } from "./game/content/careers.ts"
import { useGame } from "./game/GameContext.tsx"
import { describeTask } from "./game/taskLookup.ts"
import { buildContentContext } from "./game/content/tagEngine"
import { useState, useEffect, useRef } from "react"
import iconMoney from "./assets/icon_money.png"
import iconStress from "./assets/icon_stress.png"
import iconHealth from "./assets/icon_health.png"
import iconDefault from "./assets/icon_default.png"
import type { GameState, PlayerState } from "./game/types"

type InkFrame = { text: string; choices: any[] }

const getPlayerProfileData = (state: GameState) => {
  const player = state.player
  const assignment = Object.values(state.jobAssignments ?? {}).find(a => a.memberId === player.id)
  const job = assignment ? getJobById(assignment.jobId) : undefined

  return { player, assignment, job }
}

const bindInkExternals = (story: any, player: PlayerState) => {
  const bind = (name: string, handler: (...args: any[]) => any) => {
    if (typeof (story as any).BindExternalFunction === "function") {
      ;(story as any).BindExternalFunction(name, handler)
    } else if (typeof (story as any).bindExternalFunction === "function") {
      ;(story as any).bindExternalFunction(name, handler)
    }
  }

  try {
    bind("hasStat", (statName: any, threshold: any) => {
      try {
        const key = String(statName).replace(/[^a-zA-Z]/g, "").toLowerCase()
        const skills = player.skills as any
        const value =
          skills[key] ??
          skills[key.slice(0, 3)] ??
          skills.subSkills?.[key] ??
          skills.subSkills?.[key.slice(0, 3)] ??
          0
        return Number(value) >= Number(threshold)
      } catch (e) {
        return false
      }
    })

    bind("hasMoney", (amount: any) => {
      try {
        return Number(player.vitals.money) >= Number(amount)
      } catch (e) {
        return false
      }
    })
  } catch (e) {
    console.warn("Failed to bind ink externals:", e)
  }
}

const resolveInkFrames = (story: any): InkFrame[] => {
  let out = ""
  while (story.canContinue) {
    out += story.Continue()
    if (story.canContinue) out += "\n"
  }

  return [{ text: out, choices: story.currentChoices ?? [] }]
}

const createInkStory = async (knot: string | undefined, player: PlayerState, inkSource?: string) => {
  const InkModule = await import("inkjs")
  const StoryCtor = (InkModule as any).Story ?? (InkModule as any).default ?? InkModule
  if (!StoryCtor) throw new Error("inkjs Story constructor not found")

  let tasks: any
  try {
    if (inkSource) {
      tasks = (await import(/* @vite-ignore */ inkSource)) as any
    } else {
      tasks = (await import("./ink/career_mechanic.json")) as any
    }
  } catch (e) {
    // rethrow with helpful message
    throw new Error(`Failed to load ink content from ${inkSource ?? './ink/career_mechanic.json'}: ${(e as any)?.message ?? e}`)
  }

  const story = new StoryCtor(tasks)
  bindInkExternals(story, player)

  if (knot && typeof story.ChoosePathString === "function") {
    story.ChoosePathString(knot)
  }

  return story
}

function PlayerSummary() {
  const { state } = useGame()
  const { player, job } = getPlayerProfileData(state)

  return (
    <div style={{ padding: "0.75rem", borderBottom: "1px solid #333" }}>
      <div>
        <strong>{player.name}</strong> - {Math.floor((player.ageMonths + state.month) / 12)} yrs
      </div>
      <div>Money: ¤{player.vitals.money}</div>
      <div>Stress: {player.vitals.stress}</div>
      <div>Occupation: {job?.title ?? "Unemployed"} @ {getAffiliationById(job?.careerId ?? undefined)?.name ?? "-"}</div>
      <div>
        STR {player.skills.str} • INT {player.skills.int} • REF {player.skills.ref} • CHR {player.skills.chr}
      </div>
    </div>
  )
}

function TaskList({ onOpenInk }: { onOpenInk?: (taskId: string, taskGraphId: string) => void }) {
  const { state, dispatch } = useGame()

  const handleResolve = (taskId: string) => {
    const task = state.tasks.find(t => t.id === taskId)
    if (!task) return

    if (task.taskGraphId) {
      if (onOpenInk) {
        onOpenInk(task.id, task.taskGraphId)
        return
      }

      dispatch({ type: "START_TASK_RUN", taskId: task.id, taskGraphId: task.taskGraphId })
      return
    }

    dispatch({ type: "RESOLVE_TASK", taskId })
    // Log a nicer message with task title
    try {
      const presentation = describeTask(task)
      dispatch({ type: "ADD_LOG", text: `Finished ${presentation.title}.` })
    } catch (e) {
      dispatch({ type: "ADD_LOG", text: `Finished ${taskId}.` })
    }
  }

  return (
    <div style={{ padding: "0.75rem", borderRight: "1px solid #333", width: "40%" }}>
      <h2>Tasks this month</h2>
      {state.tasks.length === 0 && <p>No tasks yet. Advance month.</p>}
      {state.tasks.map(task => {
        const presentation = describeTask(task)
        return (
          <div
            key={task.id}
            style={{
              marginBottom: "0.5rem",
              padding: "0.5rem",
              border: "1px solid #444",
              opacity: task.resolved ? 0.6 : 1,
            }}
          >
            <div>
              <strong>{presentation.title}</strong> <small>({task.kind})</small>
            </div>
            <p style={{ fontSize: "0.85rem" }}>{presentation.description}</p>
            {!task.resolved && (
              <button onClick={() => handleResolve(task.id)}>Resolve</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LogPanel() {
  const { state } = useGame()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // compute grouped months once per render
  const groups: Record<number, any[]> = {}
  for (const entry of state.log) {
    const m = Number(entry.month ?? 0)
    if (!groups[m]) groups[m] = []
    groups[m].push(entry)
  }
  const months = Object.keys(groups).map(k => Number(k)).sort((a, b) => a - b)

  // auto-scroll to bottom whenever the log length changes
  useEffect(() => {
    if (!scrollRef.current) return
    // wait for the DOM to update
    requestAnimationFrame(() => {
      try {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight
      } catch (e) {
        // ignore
      }
    })
  }, [state.log.length])

  return (
    <div style={{ padding: "0.75rem", flex: 1, display: "flex", flexDirection: "column", maxHeight: "70vh" }}>
      <h2>Log</h2>
      <div ref={scrollRef} className="hide-scrollbar" style={{ overflowY: "auto", fontSize: "0.85rem", flex: 1, minHeight: 0 }}>
        {
          // format months as calendar names starting at January 2077
          (() => {
            const monthNames = [
              'January','February','March','April','May','June','July','August','September','October','November','December'
            ]
            const formatMonthYear = (m: number) => {
              const year = 2077 + Math.floor(m / 12)
              const mon = monthNames[((m % 12) + 12) % 12]
              return `${mon} ${year}`
            }

            return months.map(month => (
              <div key={`month-${month}`} style={{ marginBottom: "0.75rem" }}>
                <div style={{ opacity: 0.6, marginBottom: "0.25rem" }}>{formatMonthYear(month)}</div>
                {groups[month].map(entry => (
                  <div key={entry.id} style={{ marginBottom: "0.5rem" }}>
                    <div>{entry.text}</div>
                  </div>
                ))}
              </div>
            ))
          })()
        }
      </div>
    </div>
  )
}

function AdvanceMonthButton({ onShowProfile, onChangeJob }: { onShowProfile?: () => void; onChangeJob?: () => void }) {
  const { state, dispatch } = useGame()

  const handleDebugTags = () => {
    const ctx = buildContentContext(state)
    const parts = [
      `jobTags: ${ctx.jobTags.join(", ") || "-"}`,
      `districtTags: ${ctx.districtTags.join(", ") || "-"}`,
      `npcTags: ${ctx.npcTags.join(", ") || "-"}`,
      `statTags: ${ctx.statTags.join(", ") || "-"}`,
      `playerTags: ${ctx.playerTags.join(", ") || "-"}`,
      `worldTags: ${ctx.worldTags.join(", ") || "-"}`,
    ]

    dispatch({ type: "ADD_LOG", text: `TAGS — ${parts.join(" | ")}` })
  }

  const handleShowProfile = () => {
    if (onShowProfile) onShowProfile()
  }

  const handleChangeJob = () => {
    if (onChangeJob) onChangeJob()
  }

  return (
    <div style={{ padding: "0.75rem", borderTop: "1px solid #333" }}>
      <button style={{ marginRight: "0.5rem" }} onClick={() => dispatch({ type: "ADVANCE_MONTH" })}>
        Advance 1 month
      </button>
      <button onClick={handleDebugTags}>DEBUG: Tags</button>
      <button onClick={handleShowProfile}>DEBUG: Profile</button>
      <button onClick={handleChangeJob}>DEBUG: Change Job</button>
    </div>
  )
}

function ChangeJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useGame()

  if (!open) return null

  const careers = listCareers()

  // flattened job list
  const jobs = careers.flatMap(c => c.levels.map(l => ({ ...l, careerId: c.id })))

  const currentAssignment = Object.values(state.jobAssignments ?? {}).find(a => a.memberId === state.player.id)

  const handleChoose = (jobId: string | null) => {
    dispatch({ type: "SET_PLAYER_JOB", jobId })
    onClose()
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div style={{ background: "#111", color: "#fff", padding: "1rem", width: 560, borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Change Job</h3>
          <button onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div>
            <strong>Current:</strong> {currentAssignment ? currentAssignment.jobId : 'Unemployed'}
          </div>

          {jobs.map(job => (
            <div key={job.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", border: "1px solid #333", borderRadius: 6 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{job.title}</div>
                <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>{Array.isArray(job.description) ? job.description[0] : job.description}</div>
              </div>
              <div>
                <button onClick={() => handleChoose(job.id)} style={{ marginRight: 8 }}>Assign</button>
                <small style={{ opacity: 0.8 }}>{job.careerId}</small>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 8 }}>
            <button onClick={() => handleChoose(null)}>Unassign</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InkModal({ open, onClose, frames, onChoose, statsVars }: { open: boolean; onClose: () => void; frames: InkFrame[]; onChoose: (choiceIndex: number) => void; statsVars?: any }) {
  if (!open) return null

  return (
    <>
      {frames.map((frame, idx) => {
        const isTop = idx === frames.length - 1
        return (
          <div
            key={idx}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 60 + idx,
            }}
          >
            {
              // determine modal colors based on outcome variable
            }
            <div style={{
              background: ((): string => {
                const outcome = (statsVars as any)?.outcome ?? null
                if (outcome === "great_failure") return "#8b0000" // dark red
                if (outcome === "failure") return "#ce5408ff" // orange
                if (outcome === "success") return "#0054a9ff" // blue
                if (outcome === "great_success") return "#ffd21eff" // yellow
                return "#111" // default
              })(),
              color: ((): string => {
                const outcome = (statsVars as any)?.outcome ?? null
                // yellow background needs dark text for contrast
                if (outcome === "great_success") return "#000"
                return "#fff"
              })(),
              padding: "1.25rem",
              width: "520px",
              borderRadius: 8
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ marginTop: 0, letterSpacing: 0.5 }}></h3>
                {/* Top-right close removed; modal can only be closed by OK at end of tree */}
              </div>
              <div style={{ whiteSpace: "pre-wrap", marginBottom: "1rem"}}>{frame.text}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {frame.choices.map((c, cidx) => (
                  <button
                    key={cidx}
                    style={{ textAlign: "center", padding: "0.5rem", borderRadius: 6 }}
                    onClick={() => onChoose(c.index ?? cidx)}
                    disabled={!isTop}
                  >
                    {c.text}
                  </button>
                ))}

                {/* If this is the top frame and there are no choices, show stat icons/changes then OK as a choice-style button */}
                {isTop && (frame.choices?.length ?? 0) === 0 && (
                  <>
                    {/* icons row */}
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      {(() => {
                        const vars = statsVars ?? {}
                        const items: { icon: string; value: number; key: string }[] = []
                        const dm = Number(vars.delta_money ?? 0)
                        const ds = Number(vars.delta_stress ?? 0)
                        const dh = Number(vars.delta_health ?? 0)
                        const dhu = Number(vars.delta_humanity ?? 0)
                        if (dm !== 0) items.push({ icon: iconMoney, value: dm, key: "money" })
                        if (ds !== 0) items.push({ icon: iconStress, value: ds, key: "stress" })
                        if (dh !== 0) items.push({ icon: iconHealth, value: dh, key: "health" })
                        if (dhu !== 0) items.push({ icon: iconDefault, value: dhu, key: "humanity" })

                        if (items.length === 0) return null

                        return (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "0.25rem" }}>
                              {items.map(it => (
                                <div key={it.key} style={{ flexDirection: "column", width: 90, height: 110, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", borderRadius: 6, padding: 4, background: "#000" }}>
                                  <img src={it.icon} alt={it.key} style={{ minWidth: 70, minHeight: 70, imageRendering: 'pixelated' as any }} />
                                  <div style={{ color: "#fff", fontWeight: 600, marginTop: "0.5rem" , fontSize: "0.70rem" }}>
                                    {it.key === "money" ? `${it.value > 0 ? '+ ' : '- '}¤${Math.abs(it.value)}` : `${it.value > 0 ? '+ ' : '- '}${Math.abs(it.value)} ${it.key}`}
                                  </div>
                                </div>
                              ))}
                            </div>


                          </div>
                        )
                      })()}
                    </div>

                    <button style={{ textAlign: "center", padding: "0.5rem", borderRadius: 6 }} onClick={onClose}>
                      OK
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useGame()
  const { player, job } = getPlayerProfileData(state)
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
            <div style={{ marginTop: "0.25rem" }}>{job?.title ?? "Unemployed"} — {getAffiliationById(job?.employerId ?? undefined)?.name ?? "-"}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [inkOpen, setInkOpen] = useState(false)
  const [inkStory, setInkStory] = useState<any | null>(null)
  const [inkFrames, setInkFrames] = useState<InkFrame[]>([])
  const [inkTaskPendingResolve, setInkTaskPendingResolve] = useState<string | null>(null)
  const [inkTaskPendingGraphId, setInkTaskPendingGraphId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [jobModalOpen, setJobModalOpen] = useState(false)
  const { state, dispatch } = useGame()

  const openInkDebug = async () => {
    try {
      // try to locate ink source for mechanic apprentice; fallback to default inside createInkStory
      const careers = listCareers()
      let inkSource: string | undefined
      for (const c of careers) {
        const level = c.levels.find(l => l.taskGraphId === "mechanic_apprentice_shift")
        if (level) {
          inkSource = level.inkSource ?? c.inkSource
          break
        }
      }

      const story = await createInkStory("mechanic_apprentice_shift", state.player, inkSource)
      setInkStory(story)
      setInkFrames(resolveInkFrames(story))
      setInkOpen(true)
    } catch (err: any) {
      console.error("Ink debug open failed:", err)
      setInkStory(null)
      setInkFrames([{ text: "Ink debug open failed: " + (err?.message ?? String(err)), choices: [] }])
      setInkOpen(true)
    }
  }

  const openInkForTask = async (taskId: string, taskGraphId: string) => {
    setInkTaskPendingResolve(taskId)
    setInkTaskPendingGraphId(taskGraphId)
    try {
      // find inkSource by scanning careers for a level with matching taskGraphId
      const careers = listCareers()
      let inkSource: string | undefined
      for (const c of careers) {
        const level = c.levels.find(l => l.taskGraphId === taskGraphId)
        if (level) {
          inkSource = level.inkSource ?? c.inkSource
          break
        }
      }

      const story = await createInkStory(taskGraphId, state.player, inkSource)
      setInkStory(story)
      setInkFrames(resolveInkFrames(story))
      setInkOpen(true)
    } catch (err: any) {
      console.error("openInkForTask failed:", err)
      setInkTaskPendingResolve(null)
      setInkTaskPendingGraphId(null)
      setInkStory(null)
      setInkFrames([{ text: "Error opening ink story: " + (err?.message ?? String(err)), choices: [] }])
      setInkOpen(true)
    }
  }

  const handleChoose = (choiceIndex: number) => {
    if (!inkStory) return
    inkStory.ChooseChoiceIndex(choiceIndex)
    setInkFrames(resolveInkFrames(inkStory))
  }

  const applyInkOutcome = (vars: any) => {
    try {
      const outcome = vars.outcome
      if (outcome && inkTaskPendingGraphId) {
        dispatch({ type: "APPLY_OUTCOME", outcome: String(outcome), taskGraphId: inkTaskPendingGraphId })
      }
    } catch (e) {
      // swallow
    }
  }

  const applyInkDeltas = (vars: any) => {
    try {
      const dm = Number(vars.delta_money ?? 0)
      const ds = Number(vars.delta_stress ?? 0)
      const dh = Number(vars.delta_health ?? 0)
      const dhu = Number(vars.delta_humanity ?? 0)
      const delta: any = {}
      if (dm !== 0) delta.money = dm
      if (ds !== 0) delta.stress = ds
      if (dh !== 0) delta.health = dh
      if (dhu !== 0) delta.humanity = dhu
      if (Object.keys(delta).length > 0) {
        dispatch({ type: "APPLY_STATS_DELTA", delta })
      }
    } catch (e) {
      // swallow
    }
  }

  const resolvePendingTaskAfterStory = (vars: any) => {
    if (!inkTaskPendingResolve) return

    const taskObj = state.tasks.find(t => t.id === inkTaskPendingResolve)
    const taskTitle = taskObj ? describeTask(taskObj).title : String(inkTaskPendingResolve)

    dispatch({ type: "RESOLVE_TASK", taskId: inkTaskPendingResolve })

    try {
      const dm = Number(vars.delta_money ?? 0)
      const ds = Number(vars.delta_stress ?? 0)
      const dh = Number(vars.delta_health ?? 0)
      const dhu = Number(vars.delta_humanity ?? 0)
      const parts: string[] = []
      if (dm !== 0) parts.push(`${dm > 0 ? '+' : '-'}¤${Math.abs(dm)}`)
      if (ds !== 0) parts.push(`${ds > 0 ? '+' : '-'}${Math.abs(ds)} stress`)
      if (dh !== 0) parts.push(`${dh > 0 ? '+' : '-'}${Math.abs(dh)} health`)
      if (dhu !== 0) parts.push(`${dhu > 0 ? '+' : '-'}${Math.abs(dhu)} humanity`)

      const received = parts.length > 0 ? ` Received: ${parts.join(', ')}` : ''
      dispatch({ type: "ADD_LOG", text: `Finished ${taskTitle}.${received}` })
    } catch (e) {
      dispatch({ type: "ADD_LOG", text: `Finished ${taskTitle}.` })
    }

    setInkTaskPendingResolve(null)
    setInkTaskPendingGraphId(null)
  }

  const handleCloseInkModal = () => {
    const vars = (inkStory as any)?.variablesState ?? {}
    applyInkOutcome(vars)
    applyInkDeltas(vars)
    resolvePendingTaskAfterStory(vars)

    setInkOpen(false)
    setInkFrames([])
    setInkStory(null)
    setInkTaskPendingResolve(null)
    setInkTaskPendingGraphId(null)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PlayerSummary />
      <div style={{ display: "flex", flex: 1 }}>
        <TaskList onOpenInk={openInkForTask} />
        <LogPanel />
      </div>
      <div style={{ padding: "0.75rem", borderTop: "1px solid #333" }}>
        <AdvanceMonthButton onShowProfile={() => setProfileOpen(true)} onChangeJob={() => setJobModalOpen(true)} />
        <button style={{ marginLeft: "0.5rem" }} onClick={openInkDebug}>DEBUG: ink</button>
      </div>

      <InkModal
        open={inkOpen}
        onClose={handleCloseInkModal}
        frames={inkFrames}
        statsVars={(inkStory as any)?.variablesState ?? {}}
        onChoose={handleChoose}
      />

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ChangeJobModal open={jobModalOpen} onClose={() => setJobModalOpen(false)} />
    </div>
  )
}
