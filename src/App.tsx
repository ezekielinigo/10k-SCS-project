import { getJobById, listCareers } from "./game/content/careers.ts"
import { useGame } from "./game/GameContext.tsx"
import { describeTask } from "./game/taskLookup.ts"
import { buildContentContext } from "./game/content/tagEngine"
import { useState, useEffect, useRef, lazy, Suspense } from "react"
// asset icons removed (unused)
import ProfileModal from "./components/ProfileModal"
import ChangeJobModal from "./components/ChangeJobModal"
import AffiliationMapModal from "./components/AffiliationMapModal"
import RelationshipsModal from "./components/RelationshipsModal"
import DebugNpcModal from "./components/DebugNpcModal"
const InkModal = lazy(() => import("./components/InkModal"))

import type { GameState, PlayerState } from "./game/types"

type InkFrame = { text: string; choices: any[] }

const getPlayerProfileData = (state: GameState) => {
  const player = state.player
  const assignments = Object.values(state.jobAssignments ?? {}).filter(a => a.memberId === player.id)
  const jobs = assignments.map(a => getJobById(a.jobId)).filter(Boolean)
  const membership = Object.values(state.memberships ?? {}).find(m => m.memberId === player.id)

  return { player, assignments, jobs, membership }
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
  const { player, jobs } = getPlayerProfileData(state)
  const titles = jobs.map(j => j?.title).filter(Boolean) as string[]
  const titleText = titles.length === 0 ? "Unemployed" : titles.join(titles.length > 2 ? ", " : " & ")
  // affiliation id resolution not used here

  return (
    <div style={{ padding: "0.75rem", borderBottom: "1px solid #333" }}>
      <div>
        <strong>{player.name}</strong> - {Math.floor((player.ageMonths + state.month) / 12)} yrs
      </div>
      <div>Money: ♦︎ {player.vitals.money}</div>
      <div>Stress: {player.vitals.stress}</div>
      <div>Occupation: {titleText}</div>
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

function AdvanceMonthButton({ onShowProfile, onChangeJob, onShowAffiliationMap, onShowRelationships, onShowDebugNpcs }: { onShowProfile?: () => void; onChangeJob?: () => void; onShowAffiliationMap?: () => void; onShowRelationships?: () => void; onShowDebugNpcs?: () => void }) {
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

  const handleAffiliationMap = () => {
    if (onShowAffiliationMap) onShowAffiliationMap()
  }

  const handleRelationships = () => {
    if (onShowRelationships) onShowRelationships()
  }

  const handleDebugNpcs = () => {
    if (onShowDebugNpcs) onShowDebugNpcs()
  }

  return (
    <div style={{ padding: "0.75rem", borderTop: "1px solid #333" }}>
      <button style={{ marginRight: "0.5rem" }} onClick={() => dispatch({ type: "ADVANCE_MONTH" })}>
        Advance 1 month
      </button>
      <button onClick={handleDebugTags}>DEBUG: Tags</button>
      <button onClick={handleShowProfile}>DEBUG: Profile</button>
      <button onClick={handleChangeJob}>DEBUG: Change Job</button>
      <button onClick={handleAffiliationMap}>DEBUG: Affiliation Map</button>
      <button onClick={handleRelationships}>DEBUG: Relationships</button>
      <button onClick={handleDebugNpcs}>DEBUG: Generate NPCs</button>
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
  const [affiliationOpen, setAffiliationOpen] = useState(false)
  const [relationshipsOpen, setRelationshipsOpen] = useState(false)
  const [debugNpcsOpen, setDebugNpcsOpen] = useState(false)
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
      if (dm !== 0) parts.push(`${dm > 0 ? '+' : '-'}♦︎ ${Math.abs(dm)}`)
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
        <AdvanceMonthButton
          onShowProfile={() => setProfileOpen(true)}
          onChangeJob={() => setJobModalOpen(true)}
          onShowAffiliationMap={() => setAffiliationOpen(true)}
          onShowRelationships={() => setRelationshipsOpen(true)}
          onShowDebugNpcs={() => setDebugNpcsOpen(true)}
        />
        <button style={{ marginLeft: "0.5rem" }} onClick={openInkDebug}>DEBUG: ink</button>
      </div>

      <Suspense fallback={<div style={{position:'fixed', inset:0, display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</div>}>
        <InkModal
          open={inkOpen}
          onClose={handleCloseInkModal}
          frames={inkFrames}
          statsVars={(inkStory as any)?.variablesState ?? {}}
          onChoose={handleChoose}
        />
      </Suspense>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ChangeJobModal open={jobModalOpen} onClose={() => setJobModalOpen(false)} />
      <AffiliationMapModal open={affiliationOpen} onClose={() => setAffiliationOpen(false)} />
      <RelationshipsModal open={relationshipsOpen} onClose={() => setRelationshipsOpen(false)} />
      <DebugNpcModal open={debugNpcsOpen} onClose={() => setDebugNpcsOpen(false)} />
    </div>
  )
}
