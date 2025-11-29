import type { Tag } from "../types"

export type AffiliationTemplate = {
  id: string
  name: string
  description: string
  tags: Tag[]
}

const AFFILIATIONS: Record<string, AffiliationTemplate> = {
  valkarna_auto: {
    id: "valkarna_auto",
    name: "Valkarna Auto Collective",
    description: "Independent mechanics holding the industrial district together.",
    tags: ["mechanic", "industrial", "blue_collar", "union"],
  },
  instafood_collective: {
    id: "instafood_collective",
    name: "InstaFood Collective",
    description: "Franchise kitchen crew with quiet mutual aid roots.",
    tags: ["food_service", "midlands", "customer_facing"],
  },
  no_affiliation: {
    id: "no_affiliation",
    name: "Unaffiliated",
    description: "Freelancers and solos without a formal backer.",
    tags: ["independent", "street"],
  },
}

export const listAffiliations = (): AffiliationTemplate[] => Object.values(AFFILIATIONS)

export const getAffiliationById = (id?: string | null): AffiliationTemplate | undefined =>
  id ? AFFILIATIONS[id] : undefined

export default AFFILIATIONS
