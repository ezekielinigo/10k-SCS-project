import { getAffiliationById } from "./game/content/affiliations.ts"
import { getJobTemplateById } from "./game/content/jobs.ts"
import { useGame } from "./game/GameContext.tsx"
import { describeTask } from "./game/taskLookup.ts"
import { buildContentContext } from "./game/content/tagEngine"
import { useState } from "react"

function PlayerSummary() {
  const { state } = useGame()
  const p = state.player

  return (
    <div style={{ padding: "0.75rem", borderBottom: "1px solid #333" }}>
      <div>
        <strong>{p.name}</strong> - {Math.floor(p.ageMonths / 12)} yrs
      </div>
      <div>Month: {state.month}</div>
      <div>Money: ¤{p.stats.money}</div>
      <div>Stress: {p.stats.stress}</div>
      <div>Occupation: {(getJobTemplateById(p.jobId))?.title} @ {getAffiliationById(p.affiliationId)?.name}</div>
      <div>
        STR {p.stats.skills.str} • INT {p.stats.skills.int} • REF {p.stats.skills.ref} • CHR {p.stats.skills.chr}
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
    dispatch({ type: "ADD_LOG", text: `You handled: ${taskId}` })
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
  return (
    <div style={{ padding: "0.75rem", flex: 1 }}>
      <h2>Log</h2>
      <div className="hide-scrollbar" style={{ maxHeight: "60vh", overflowY: "auto", fontSize: "0.85rem" }}>
        {state.log
          .slice()
          .reverse()
          .map(entry => (
            <div key={entry.id} style={{ marginBottom: "0.5rem" }}>
              <div style={{ opacity: 0.6 }}>Month {entry.month}</div>
              <div>{entry.text}</div>
            </div>
          ))}
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
      `affiliationTags: ${ctx.affiliationTags.join(", ") || "-"}`,
      `lifestyleTags: ${ctx.lifestyleTags.join(", ") || "-"}`,
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

function InkModal({ open, onClose, frames, onChoose }: { open: boolean; onClose: () => void; frames: { text: string; choices: any[] }[]; onChoose: (choiceIndex: number) => void }) {
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
            <div style={{ background: "#111", color: "#fff", padding: "1.25rem", width: "520px", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ marginTop: 0, letterSpacing: 0.5 }}></h3>
                {/* Top-right close removed; modal can only be closed by OK at end of tree */}
              </div>
              <div style={{ whiteSpace: "pre-wrap", marginBottom: "1rem" }}>{frame.text}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {frame.choices.map((c, cidx) => (
                  <button
                    key={cidx}
                    style={{ textAlign: "left", padding: "0.5rem", borderRadius: 6 }}
                    onClick={() => onChoose(c.index ?? cidx)}
                    disabled={!isTop}
                  >
                    {c.text}
                  </button>
                ))}

                {/* If this is the top frame and there are no choices, show OK as a choice-style button */}
                {isTop && (frame.choices?.length ?? 0) === 0 && (
                  <button style={{ textAlign: "left", padding: "0.5rem", borderRadius: 6 }} onClick={onClose}>
                    OK
                  </button>
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
              const stats = state.player.stats.skills as any
              const value = stats[key] ?? stats[key.slice(0, 3)] ?? 0
              return Number(value) >= Number(threshold)
            } catch (e) {
              return false
            }
          })

          ;(s as any).BindExternalFunction("hasMoney", (amount: any) => {
            try {
              return Number(state.player.stats.money) >= Number(amount)
            } catch (e) {
              return false
            }
          })
        } else if (typeof (s as any).bindExternalFunction === "function") {
          ;(s as any).bindExternalFunction("hasStat", (statName: any, threshold: any) => {
            try {
              const key = String(statName).replace(/[^a-zA-Z]/g, "").toLowerCase()
              const stats = state.player.stats.skills as any
              const value = stats[key] ?? stats[key.slice(0, 3)] ?? 0
              return Number(value) >= Number(threshold)
            } catch (e) {
              return false
            }
          })

          ;(s as any).bindExternalFunction("hasMoney", (amount: any) => {
            try {
              return Number(state.player.stats.money) >= Number(amount)
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
              const stats = state.player.stats.skills as any
              const value = stats[key] ?? stats[key.slice(0, 3)] ?? 0
              return Number(value) >= Number(threshold)
            } catch (e) {
              return false
            }
          })

          ;(s as any).BindExternalFunction("hasMoney", (amount: any) => {
            try {
              return Number(state.player.stats.money) >= Number(amount)
            } catch (e) {
              return false
            }
          })
        } else if (typeof (s as any).bindExternalFunction === "function") {
          ;(s as any).bindExternalFunction("hasStat", (statName: any, threshold: any) => {
            try {
              const key = String(statName).replace(/[^a-zA-Z]/g, "").toLowerCase()
              const stats = state.player.stats.skills as any
              const value = stats[key] ?? stats[key.slice(0, 3)] ?? 0
              return Number(value) >= Number(threshold)
            } catch (e) {
              return false
            }
          })

          ;(s as any).bindExternalFunction("hasMoney", (amount: any) => {
            try {
              return Number(state.player.stats.money) >= Number(amount)
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
            dispatch({ type: "RESOLVE_TASK", taskId: inkTaskPendingResolve })
            dispatch({ type: "ADD_LOG", text: `You handled: ${inkTaskPendingResolve}` })
            setInkTaskPendingResolve(null)
            setInkTaskPendingGraphId(null)
          }

          setInkOpen(false)
          setInkFrames([])
          setInkStory(null)
        }}
        frames={inkFrames}
        onChoose={(i) => handleChoose(i)}
      />
    </div>
  )
}
