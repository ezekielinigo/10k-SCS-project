import { getAffiliationById } from "./game/content/affiliations.ts"
import { getJobTemplateById } from "./game/content/jobs.ts"
import { useGame } from "./game/GameContext.tsx"
import { describeTask } from "./game/taskLookup.ts"
import { buildContentContext } from "./game/content/tagEngine"
import { useState, useEffect, useRef } from "react"
import iconMoney from "./assets/icon_money.png"
import iconStress from "./assets/icon_stress.png"
import iconHealth from "./assets/icon_health.png"
import iconDefault from "./assets/icon_default.png"

function PlayerSummary() {
  const { state } = useGame()
  const p = state.player
  const assignment = Object.values(state.jobAssignments ?? {}).find(a => a.memberId === p.id)
  const job = assignment ? getJobTemplateById(assignment.jobId) : undefined

  return (
    <div style={{ padding: "0.75rem", borderBottom: "1px solid #333" }}>
      <div>
        <strong>{p.name}</strong> - {Math.floor((p.ageMonths + state.month) / 12)} yrs
      </div>
      <div>Money: ¤{p.vitals.money}</div>
      <div>Stress: {p.vitals.stress}</div>
      <div>Occupation: {job?.title ?? "Unemployed"} @ {getAffiliationById(job?.employerId ?? undefined)?.name ?? "-"}</div>
      <div>
        STR {p.skills.str} • INT {p.skills.int} • REF {p.skills.ref} • CHR {p.skills.chr}
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

function AdvanceMonthButton() {
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

  return (
    <div style={{ padding: "0.75rem", borderTop: "1px solid #333" }}>
      <button style={{ marginRight: "0.5rem" }} onClick={() => dispatch({ type: "ADVANCE_MONTH" })}>
        Advance 1 month
      </button>
      <button onClick={handleDebugTags}>Debug Tags</button>
    </div>
  )
}

function InkModal({ open, onClose, frames, onChoose, statsVars }: { open: boolean; onClose: () => void; frames: { text: string; choices: any[] }[]; onChoose: (choiceIndex: number) => void; statsVars?: any }) {
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

export default function App() {
  const [inkOpen, setInkOpen] = useState(false)
  const [inkStory, setInkStory] = useState<any | null>(null)
  const [inkFrames, setInkFrames] = useState<{ text: string; choices: any[] }[]>([])
  const [inkTaskPendingResolve, setInkTaskPendingResolve] = useState<string | null>(null)
  const [inkTaskPendingGraphId, setInkTaskPendingGraphId] = useState<string | null>(null)
  const { state, dispatch } = useGame()

  const openInkDebug = async () => {
    try {
      // Dynamically import inkjs and the compiled json to avoid module-level runtime errors
      const InkModule = await import("inkjs")
      const tasks = (await import("./ink/career_mechanic.json")) as any
      const StoryCtor = (InkModule as any).Story ?? (InkModule as any).default ?? InkModule
      if (!StoryCtor) throw new Error("inkjs Story constructor not found")

      const s = new StoryCtor(tasks)
      // bind external functions expected by the ink stories
      try {
        if (typeof (s as any).BindExternalFunction === "function") {
          ;(s as any).BindExternalFunction("hasStat", (statName: any, threshold: any) => {
            try {
              const key = String(statName).replace(/[^a-zA-Z]/g, "").toLowerCase()
              const skills = state.player.skills as any
              const value = skills[key] ?? skills[key.slice(0, 3)] ?? skills.subSkills?.[key] ?? 0
              return Number(value) >= Number(threshold)
            } catch (e) {
              return false
            }
          })

          ;(s as any).BindExternalFunction("hasMoney", (amount: any) => {
            try {
              return Number(state.player.vitals.money) >= Number(amount)
            } catch (e) {
              return false
            }
          })
        } else if (typeof (s as any).bindExternalFunction === "function") {
          ;(s as any).bindExternalFunction("hasStat", (statName: any, threshold: any) => {
            try {
              const key = String(statName).replace(/[^a-zA-Z]/g, "").toLowerCase()
              const skills = state.player.skills as any
              const value = skills[key] ?? skills[key.slice(0, 3)] ?? skills.subSkills?.[key] ?? 0
              return Number(value) >= Number(threshold)
            } catch (e) {
              return false
            }
          })

          ;(s as any).bindExternalFunction("hasMoney", (amount: any) => {
            try {
              return Number(state.player.vitals.money) >= Number(amount)
            } catch (e) {
              return false
            }
          })
        }
      } catch (e) {
        console.warn("Failed to bind ink externals:", e)
      }
      // jump to the named knot
      try {
        if (typeof s.ChoosePathString === "function") s.ChoosePathString("mechanic_apprentice_shift")
      } catch (e) {
        // ignore - path may already be at entry
      }

      let out = ""
      while (s.canContinue) {
        out += (s.Continue() as string)
        if (s.canContinue) out += "\n"
      }

      setInkStory(s)
      setInkFrames([{ text: out, choices: s.currentChoices ?? [] }])
      setInkOpen(true)
    } catch (err: any) {
      console.error("Ink debug open failed:", err)
      setInkStory(null)
      setInkFrames([])
      setInkOpen(true)
    }
  }

  const openInkForTask = async (taskId: string, taskGraphId: string) => {
    try {
      // mark this modal as associated with a task so we can resolve it when the player finishes
      setInkTaskPendingResolve(taskId)
      setInkTaskPendingGraphId(taskGraphId)
      const InkModule = await import("inkjs")
      // load the career json - user renamed compiled file to career_mechanic.json
      const tasks = (await import("./ink/career_mechanic.json")) as any
      const StoryCtor = (InkModule as any).Story ?? (InkModule as any).default ?? InkModule
      if (!StoryCtor) throw new Error("inkjs Story constructor not found")

      const s = new StoryCtor(tasks)

      // bind externals similar to debug flow
      try {
        if (typeof (s as any).BindExternalFunction === "function") {
          ;(s as any).BindExternalFunction("hasStat", (statName: any, threshold: any) => {
            try {
              const key = String(statName).replace(/[^a-zA-Z]/g, "").toLowerCase()
              const skills = state.player.skills as any
              const value = skills[key] ?? skills[key.slice(0, 3)] ?? skills.subSkills?.[key] ?? 0
              return Number(value) >= Number(threshold)
            } catch (e) {
              return false
            }
          })

          ;(s as any).BindExternalFunction("hasMoney", (amount: any) => {
            try {
              return Number(state.player.vitals.money) >= Number(amount)
            } catch (e) {
              return false
            }
          })
        } else if (typeof (s as any).bindExternalFunction === "function") {
          ;(s as any).bindExternalFunction("hasStat", (statName: any, threshold: any) => {
            try {
              const key = String(statName).replace(/[^a-zA-Z]/g, "").toLowerCase()
              const skills = state.player.skills as any
              const value = skills[key] ?? skills[key.slice(0, 3)] ?? skills.subSkills?.[key] ?? 0
              return Number(value) >= Number(threshold)
            } catch (e) {
              return false
            }
          })

          ;(s as any).bindExternalFunction("hasMoney", (amount: any) => {
            try {
              return Number(state.player.vitals.money) >= Number(amount)
            } catch (e) {
              return false
            }
          })
        }
      } catch (e) {
        console.warn("Failed to bind ink externals:", e)
      }

      // try to jump to the taskGraphId knot
      try {
        if (typeof s.ChoosePathString === "function") s.ChoosePathString(taskGraphId)
      } catch (e) {}

      let out = ""
      while (s.canContinue) {
        out += (s.Continue() as string)
        if (s.canContinue) out += "\n"
      }

      setInkStory(s)
      setInkFrames([{ text: out, choices: s.currentChoices ?? [] }])
      setInkOpen(true)
    } catch (err: any) {
      console.error("openInkForTask failed:", err)
      // if we fail to open, clear pending task resolve so we don't accidentally resolve later
      setInkTaskPendingResolve(null)
      setInkTaskPendingGraphId(null)
      setInkStory(null)
      setInkFrames([{ text: "Error opening ink story: " + (err?.message ?? String(err)), choices: [] }])
      setInkOpen(true)
    }
  }

  const handleChoose = (choiceIndex: number) => {
    if (!inkStory) return
    // advance story and capture the new output as a fresh single frame (replace previous)
    inkStory.ChooseChoiceIndex(choiceIndex)
    let out = ""
    while (inkStory.canContinue) {
      out += (inkStory.Continue() as string)
      if (inkStory.canContinue) out += "\n"
    }

    const nextChoices = inkStory.currentChoices ?? []
    // replace previous frame with the new one so only one modal is visible at a time
    setInkFrames([{ text: out, choices: nextChoices }])
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PlayerSummary />
      <div style={{ display: "flex", flex: 1 }}>
        <TaskList onOpenInk={openInkForTask} />
        <LogPanel />
      </div>
      <div style={{ padding: "0.75rem", borderTop: "1px solid #333" }}>
        <AdvanceMonthButton />
        <button style={{ marginLeft: "0.5rem" }} onClick={openInkDebug}>DEBUG: ink</button>
      </div>

      {/* TaskModal removed — no active task-run modal. InkModal handles story choices. */}

      <InkModal
        open={inkOpen}
        onClose={() => {
          // If the ink story set an 'outcome' variable, apply outcome effects first
          try {
            const outcome = (inkStory as any)?.variablesState?.outcome
            if (outcome && inkTaskPendingGraphId) {
              dispatch({ type: "APPLY_OUTCOME", outcome: String(outcome), taskGraphId: inkTaskPendingGraphId })
            }
          } catch (e) {
            // ignore
          }

            // Read accumulated delta_* variables from the ink story and apply them in one action
            try {
              const vars = (inkStory as any)?.variablesState ?? {}
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
              // ignore
            }

          // if this modal was opened for a task, resolve it now
          if (inkTaskPendingResolve) {
            // capture task title before resolving
            const taskObj = state.tasks.find(t => t.id === inkTaskPendingResolve)
            const taskTitle = taskObj ? describeTask(taskObj).title : String(inkTaskPendingResolve)

            dispatch({ type: "RESOLVE_TASK", taskId: inkTaskPendingResolve })

            // Build a received summary from the delta we applied (if any)
            try {
              const vars = (inkStory as any)?.variablesState ?? {}
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

          setInkOpen(false)
          setInkFrames([])
          setInkStory(null)
        }}
        frames={inkFrames}
        statsVars={(inkStory as any)?.variablesState ?? {}}
        onChoose={(i) => handleChoose(i)}
      />
    </div>
  )
}
