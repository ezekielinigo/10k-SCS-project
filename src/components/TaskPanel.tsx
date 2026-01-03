import React, { useState } from "react"
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native"
import { useGame } from "@shared/game/GameContext"
import { describeTask } from "@shared/game/taskLookup"

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
    <View style={styles.container}>
      <Text style={styles.title}>Tasks this month</Text>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {state.tasks.length === 0 && <Text style={styles.empty}>No tasks yet. Advance month.</Text>}
        {state.tasks.map(task => {
          const presentation = describeTask(task)
          const isExpanded = expandedId === task.id
          return (
            <Pressable
              key={task.id}
              onPress={() => setExpandedId(isExpanded ? null : task.id)}
              style={[styles.card, isExpanded && styles.cardExpanded, task.resolved && styles.cardResolved]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text numberOfLines={1} style={styles.cardTitle}>{presentation.title}</Text>
                {isExpanded ? <Text style={styles.cardBody}>{presentation.description}</Text> : null}
              </View>
              {isExpanded && !task.resolved ? (
                <Pressable onPress={() => handleResolve(task.id)} style={[styles.resolveBtn, task.taskGraphId ? styles.playBtn : styles.doneBtn]}>
                  <Text style={styles.resolveText}>{task.taskGraphId ? "Play" : "Done"}</Text>
                </Pressable>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0c0f18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#1d2435" },
  title: { color: "#f5f6fb", fontWeight: "800", fontSize: 16, marginBottom: 8 },
  list: { gap: 10 },
  empty: { color: "#8e93a8" },
  card: {
    borderWidth: 1,
    borderColor: "#252b3c",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#111624",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  cardExpanded: { backgroundColor: "#151c2c", borderColor: "#2f3a52" },
  cardResolved: { opacity: 0.6 },
  cardTitle: { color: "#f2f3f7", fontWeight: "800", marginBottom: 2, fontSize: 15 },
  cardBody: { color: "#c9cdd8", fontSize: 13, lineHeight: 18 },
  resolveBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9 },
  playBtn: { backgroundColor: "#1f7aec", borderWidth: 1, borderColor: "#2c86f0" },
  doneBtn: { backgroundColor: "#2c7a4b", borderWidth: 1, borderColor: "#338a56" },
  resolveText: { color: "#fff", fontWeight: "800" },
  listContent: { paddingBottom: 12 },
})
