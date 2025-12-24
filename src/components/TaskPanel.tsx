import { useState } from "react"
import { FiCheck } from "react-icons/fi"
import { useGame } from "../game/GameContext"
import { describeTask } from "../game/taskLookup"

export default function TaskPanel({ onOpenInk }: { onOpenInk?: (taskId: string, taskGraphId: string) => void }) {
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
                    <FiCheck size={20} />
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
