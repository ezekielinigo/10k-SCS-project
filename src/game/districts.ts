import type { DistrictState } from "./types"

export const DISTRICTS: Record<string, DistrictState> = {
  downtown: {
    id: "downtown",
    name: "Downtown Ark",
    security: 50,
    unrest: 30,
    economy: 60,
    tags: ["downtown", "district1", "commercial", "high_security"],
  },
  midlands: {
    id: "midlands",
    name: "Midlands Sprawl",
    security: 35,
    unrest: 45,
    economy: 40,
    tags: ["midlands", "district3", "residential", "low_security"],
  },
  industrial: {
    id: "industrial",
    name: "Industrial Sector",
    security: 60,
    unrest: 20,
    economy: 70,
    tags: ["industrial", "district5", "manufacturing", "blue_collar"],
  },
}

export const getDistrictById = (id: string): DistrictState | undefined =>
  DISTRICTS[id]

export default DISTRICTS
