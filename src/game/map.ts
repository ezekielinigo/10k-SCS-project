import type { DistrictStateTemplate } from "./content/districts"

// A minimal shape of districts for routing; accepts any record with adjacency/name.
export type DistrictGraph = Record<string, Partial<Pick<DistrictStateTemplate, "id" | "name" | "adjacency">> & Record<string, any>>

/**
 * Breadth-first search for a path between districts using adjacency lists.
 * Falls back to a direct pair when no path is found.
 */
export const findRoute = (fromId: string | null | undefined, toId: string, districts: DistrictGraph): string[] => {
  if (!toId) return []
  if (!fromId) return [toId]
  if (fromId === toId) return [fromId]

  const start = fromId
  const queue: string[][] = [[start]]
  const visited = new Set<string>([start])

  while (queue.length > 0) {
    const path = queue.shift()!
    const current = path[path.length - 1]
    const neighbors = districts[current]?.adjacency ?? []

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      const nextPath = [...path, neighbor]
      if (neighbor === toId) {
        return nextPath
      }
      queue.push(nextPath)
    }
  }

  return [fromId, toId]
}

/**
 * Convert a route of district ids into a human-readable label.
 */
export const formatRoute = (routeIds: string[], districts: DistrictGraph): string =>
  routeIds.map(id => districts[id]?.name ?? id).join(" -> ")

/**
 * Build the travel log string for UI consumption.
 */
export const buildTravelLogText = (routeIds: string[], districts: DistrictGraph): string =>
  `Player moved, ${formatRoute(routeIds, districts)}`
