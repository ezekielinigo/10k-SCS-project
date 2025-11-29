import { getAffiliationById } from "./game/content/affiliations.ts"
import { getJobTemplateById } from "./game/content/jobs.ts"
import { useGame } from "./game/GameContext.tsx"
import { describeTask } from "./game/taskLookup.ts"
import { buildContentContext } from "./game/content/tagEngine"
import { getTaskGraphById } from "./game/content/tasks"

function TaskModal() {
  const { state, dispatch } = useGame()
  const run = state.activeTaskRun
  if (!run) return null

  const graph = getTaskGraphById(run.taskGraphId)
  if (!graph) return null

  const node = graph.nodes[run.currentNodeId ?? graph.entryNodeId]
  if (!node) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div style={{ background: "#111", color: "#fff", padding: "1.25rem", width: "520px", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0, letterSpacing: 0.5 }}>{graph.id.replace(/_/g, " ")}</h3>
        <p style={{ marginBottom: "1rem" }}>{node.description}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {node.choices.map(choice => (
            <button
              key={choice.id}
              style={{ textAlign: "left", padding: "0.5rem", borderRadius: 6 }}
              onClick={() => dispatch({ type: "MAKE_TASK_CHOICE", choiceId: choice.id })}
            >
              {choice.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

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

function TaskList() {
  const { state, dispatch } = useGame()

  const handleResolve = (taskId: string) => {
    const task = state.tasks.find(t => t.id === taskId)
    if (!task) return

    if (task.taskGraphId) {
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

export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PlayerSummary />
      <div style={{ display: "flex", flex: 1 }}>
        <TaskList />
        <LogPanel />
      </div>
      <AdvanceMonthButton />
      <TaskModal />
    </div>
  )
}
