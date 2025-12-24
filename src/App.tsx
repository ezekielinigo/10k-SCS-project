import { getJobById, listCareers } from "./game/content/careers.ts"
import { useGame } from "./game/GameContext.tsx"
import { describeTask } from "./game/taskLookup.ts"
import { useState, useEffect, useRef, lazy, Suspense, type KeyboardEvent } from "react"
// asset icons removed (unused)
import ProfileViewHandler from "./components/ProfileViewHandler"
import ChangeJobModal from "./components/ChangeJobModal"
import AffiliationMapModal from "./components/AffiliationMapModal"
import RelationshipsModal from "./components/RelationshipsModal"
import DebugNpcModal from "./components/DebugNpcModal"
import DebugControlsModal from "./components/DebugControlsModal"
import { FiMenu, FiPlus, FiCheck } from "react-icons/fi"
import { PLAYER_VITAL_KEYS, VITAL_DEFINITIONS, SKILL_COLORS, type VitalKey } from "./utils/ui"

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

type SubSkillKey = keyof PlayerState["skills"]["subSkills"]
type MainSkillKey = "str" | "int" | "ref" | "chr"

const SUBBAR_WIDTH = 10
const SUBBAR_GAP = 5
const SUBBAR_HEIGHT = 48
const SUBBAR_CONTAINER_WIDTH = SUBBAR_WIDTH * 3 + SUBBAR_GAP * 2

type SkillGroupDefinition = {
  key: MainSkillKey
  label: string
  color: string
  subskills: { key: SubSkillKey; label: string }[]
}

const MAIN_SKILL_DEFINITIONS: SkillGroupDefinition[] = [
  {
    key: "str",
    label: "STR",
    color: SKILL_COLORS.STR,
    subskills: [
      { key: "athletics", label: "ATH" },
      { key: "closeCombat", label: "CLS" },
      { key: "heavyHandling", label: "HVY" },
    ],
  },
  {
    key: "int",
    label: "INT",
    color: SKILL_COLORS.INT,
    subskills: [
      { key: "hacking", label: "HCK" },
      { key: "medical", label: "MED" },
      { key: "engineering", label: "ENG" },
    ],
  },
  {
    key: "ref",
    label: "REF",
    color: SKILL_COLORS.REF,
    subskills: [
      { key: "marksmanship", label: "MRK" },
      { key: "stealth", label: "STL" },
      { key: "mobility", label: "MOB" },
    ],
  },
  {
    key: "chr",
    label: "CHR",
    color: SKILL_COLORS.CHR,
    subskills: [
      { key: "persuasion", label: "PRS" },
      { key: "deception", label: "DCP" },
      { key: "streetwise", label: "STW" },
    ],
  },
]

function PlayerSummary({ onOpenProfile }: { onOpenProfile?: () => void }) {
  const { state } = useGame()
  const { player, jobs } = getPlayerProfileData(state)
  const titles = jobs.map(j => j?.title).filter(Boolean) as string[]
  const titleText = titles.length === 0 ? "Unemployed" : titles.join(titles.length > 2 ? ", " : " & ")
  const [showSubskills, setShowSubskills] = useState(false)
  const toggleSkillView = () => setShowSubskills(prev => !prev)
  const handleSkillKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      toggleSkillView()
    }
  }

  const subSkills = player.skills.subSkills

  const vitalsToShow = PLAYER_VITAL_KEYS.map(key => VITAL_DEFINITIONS[key])

  function VerticalBar({ value, max = 100, height = 48, width = 18, color = "#4f82ff" }: { value: number; max?: number; height?: number; width?: number; color?: string }) {
    const clampedValue = Math.max(0, Math.min(max, Number(value) || 0))
    const fillPercent = (clampedValue / max) * 100
    return (
      <div
        style={{
          width,
          height,
          background: "#222",
          borderRadius: "999px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${fillPercent}%`,
            background: color,
            transition: "height 0.25s ease",
          }}
        />
      </div>
    )
  }

  function InlineSmallProgress({ value, max = 100, height = 6, color = "#666" }: { value: number; max?: number; height?: number; color?: string }) {
    const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) / (max || 1) * 100)))
    return (
      <div style={{ background: "#222", borderRadius: 6, height, width: "100%" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6 }} />
      </div>
    )
  }

  function SmallVerticalBar({ value, max = 10, segments = 10, height = 48, width = 40, color = "#4f82ff" }: { value: number; max?: number; segments?: number; height?: number; width?: number; color?: string }) {
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

  return (
    <div
      style={{ display: "flex", flexDirection: "row", padding: "0.75rem", borderBottom: "1px solid #333", alignItems: "center" }}
    >
      <div style={{ flex: 1, minWidth: 0, cursor: onOpenProfile ? "pointer" : "default" }}
      role={onOpenProfile ? "button" : undefined}
      tabIndex={onOpenProfile ? 0 : undefined}
      onClick={() => onOpenProfile?.()}
      onKeyDown={(e) => {
        if (!onOpenProfile) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpenProfile()
        }
      }}>
        <div>
          <div>
            <strong>{player.name}</strong> - {Math.floor((player.ageMonths + state.month) / 12)} yrs
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 6, marginRight: 12}}>
            {vitalsToShow.map(v => {
              const val = (player.vitals as any)[v.key]
              const Icon = v.Icon
              const showBar = typeof v.max !== "undefined"
              return (
                <div key={String(v.key)} style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#ddd" }}>
                      <Icon size={12} />
                      <div style={{ fontSize: "0.78rem", color: "#ddd" }}>{val ?? 0}</div>
                    </div>
                    {showBar ? (
                      <div style={{ marginLeft: "auto", width: 130 }}>
                        <InlineSmallProgress value={val ?? 0} max={v.max} height={6} color="#666" />
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 6 }}>{titleText}</div>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-pressed={showSubskills}
        aria-label={showSubskills ? "Show main skill bars" : "Show subskill breakdown"}
        onClick={toggleSkillView}
        onKeyDown={handleSkillKeyDown}
        style={{ display: "flex", gap: 12, alignItems: "flex-end", cursor: "pointer" }}
      >
        {MAIN_SKILL_DEFINITIONS.map(def => {
          const mainValue = player.skills[def.key]
          return (
            <div key={def.key} style={{ textAlign: "center" }}>
              {showSubskills ? (
                <div style={{ width: `${SUBBAR_CONTAINER_WIDTH}px`, margin: "0 auto" }}>
                  <div style={{ display: "flex", gap: `${SUBBAR_GAP}px`, alignItems: "flex-end", justifyContent: "center" }}>
                    {def.subskills.map(sub => {
                      const rawValue = subSkills[sub.key]
                      return (
                        <div key={sub.key}>
                          <VerticalBar value={rawValue ?? 0} max={100} height={SUBBAR_HEIGHT} width={SUBBAR_WIDTH} color={def.color} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <SmallVerticalBar value={mainValue} color={def.color} />
              )}
              <div style={{ fontSize: "0.8rem", marginTop: 6 }}>{def.label} {mainValue}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskList({ onOpenInk }: { onOpenInk?: (taskId: string, taskGraphId: string) => void }) {
  const { state, dispatch } = useGame()
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    <div className="task-panel" style={{ padding: "0.5rem", flexShrink: 0, display: "flex", flexDirection: "column" }}>
      <h2 style={{ margin: 0, marginBottom: 8 }}>Tasks this month</h2>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {state.tasks.length === 0 && <p style={{ margin: 0 }}>No tasks yet. Advance month.</p>}
        {state.tasks.map(task => {
          const presentation = describeTask(task)
          const isExpanded = expandedId === task.id
          return (
            <div
              key={task.id}
              role="button"
              tabIndex={0}
              onClick={() => setExpandedId(isExpanded ? null : task.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setExpandedId(isExpanded ? null : task.id)
                }
              }}
              style={{
                marginBottom: "0.4rem",
                padding: "0.25rem 0.5rem",
                border: "1px solid #444",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: task.resolved ? 0.6 : 1,
                background: isExpanded ? "#0d0f14" : "transparent",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{presentation.title}</div>
                {isExpanded && <p style={{ fontSize: "0.85rem", margin: "6px 0 0" }}>{presentation.description}</p>}
              </div>

              <div style={{ display: "flex", alignItems: "center" }}>
                {isExpanded && !task.resolved && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResolve(task.id) }}
                    aria-label="Resolve task"
                    style={{
                      width: 36,
                      height: 36,
                      minWidth: 36,
                      minHeight: 36,
                      padding: 0,
                      boxSizing: "border-box",
                      lineHeight: 0,
                      fontSize: 16,
                      borderRadius: 6,
                      border: "1px solid #333",
                      background: "#1c1f2a",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    < FiCheck size={20} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LogPanel() {
  const { state } = useGame()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const renderDeltaPills = (deltas?: Record<string, number>) => {
    if (!deltas) return null
    const entries = Object.entries(deltas).filter(([, v]) => Number(v) !== 0)
    if (entries.length === 0) return null

    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        {entries.map(([key, rawValue]) => {
          const def = VITAL_DEFINITIONS[key as VitalKey]
          if (!def) return null

          const value = Number(rawValue) || 0
          const Icon = def.Icon
          const signed = value > 0 ? `+${value}` : `${value}`
          const positive = value > 0
          const fg = positive ? "#34d399" : "#f87171"
          const bg = positive ? "#34d3991a" : "#f871711a"
          const border = positive ? "#34d39940" : "#f8717140"
          return (
            <span
              key={`${key}-${signed}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 8px",
                borderRadius: 999,
                background: bg,
                color: fg,
                border: `1px solid ${border}`,
                fontSize: "0.8rem",
                lineHeight: 1.2,
              }}
            >
              <Icon size={12} />
              <span>{signed}</span>
            </span>
          )
        })}
      </div>
    )
  }

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
    <div className="log-panel" style={{ padding: "0.75rem", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
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
                    {renderDeltaPills(entry.deltas)}
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
  const [debugControlsOpen, setDebugControlsOpen] = useState(false)
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
      const deltas: Record<string, number> = {}
      if (dm !== 0) deltas.money = dm
      if (ds !== 0) deltas.stress = ds
      if (dh !== 0) deltas.health = dh
      if (dhu !== 0) deltas.humanity = dhu

      dispatch({ type: "ADD_LOG", text: `Finished ${taskTitle}.`, deltas: Object.keys(deltas).length ? deltas : undefined })
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <PlayerSummary onOpenProfile={() => setProfileOpen(true)} />
      <div className="two-panel" style={{ flex: 1, minHeight: 0 }}>
        <LogPanel />
        <TaskList onOpenInk={openInkForTask} />
      </div>
      

      {/* Fixed-position controls: hamburger (open debug modal) and plus (advance month) */}
      <button
        aria-label="Open debug controls"
        onClick={() => setDebugControlsOpen(true)}
        style={{
          position: "fixed",
          left: "1rem",
          bottom: "1rem",
          width: "56px",
          height: "56px",
          borderRadius: "8px",
          background: "#222",
          color: "#fff",
          border: "1px solid #444",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          boxSizing: "border-box",
          fontSize: "24px",
          lineHeight: 1,
        }}
      >
        < FiMenu size={20} />
      </button>

      <button
        aria-label="Advance 1 month"
        onClick={() => dispatch({ type: "ADVANCE_MONTH" })}
        style={{
          position: "fixed",
          right: "1rem",
          bottom: "1rem",
          width: "56px",
          height: "56px",
          borderRadius: "28px",
          background: "#222",
          color: "#fff",
          border: "1px solid #444",
          fontSize: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          boxSizing: "border-box",
          lineHeight: 1,
        }}
      >
        < FiPlus size={20} />
      </button>

      <Suspense fallback={<div style={{position:'fixed', inset:0, display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</div>}>
        <InkModal
          open={inkOpen}
          onClose={handleCloseInkModal}
          frames={inkFrames}
          statsVars={(inkStory as any)?.variablesState ?? {}}
          onChoose={handleChoose}
        />
      </Suspense>
      <DebugControlsModal
        open={debugControlsOpen}
        onClose={() => setDebugControlsOpen(false)}
        onShowProfile={() => { setProfileOpen(true); setDebugControlsOpen(false) }}
        onChangeJob={() => { setJobModalOpen(true); setDebugControlsOpen(false) }}
        onShowAffiliationMap={() => { setAffiliationOpen(true); setDebugControlsOpen(false) }}
        onShowRelationships={() => { setRelationshipsOpen(true); setDebugControlsOpen(false) }}
        onShowDebugNpcs={() => { setDebugNpcsOpen(true); setDebugControlsOpen(false) }}
        onOpenInk={() => { openInkDebug(); setDebugControlsOpen(false) }}
      />

      <ProfileViewHandler open={profileOpen} onClose={() => setProfileOpen(false)} target={{ mode: "player" }} />
      <ChangeJobModal open={jobModalOpen} onClose={() => setJobModalOpen(false)} />
      <AffiliationMapModal open={affiliationOpen} onClose={() => setAffiliationOpen(false)} />
      <RelationshipsModal open={relationshipsOpen} onClose={() => setRelationshipsOpen(false)} />
      <DebugNpcModal open={debugNpcsOpen} onClose={() => setDebugNpcsOpen(false)} />
    </div>
  )
}
