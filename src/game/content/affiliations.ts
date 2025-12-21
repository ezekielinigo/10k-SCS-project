import type { Affiliation } from "../types"

const AFFILIATIONS: Record<string, Affiliation> = {
  valkarna_auto: {
    id: "valkarna_auto",
    name: "Valkarna Auto Collective",
    description: "Independent mechanics holding the industrial district together.",
    tags: ["mechanic", "industrial", "blue_collar", "union"],
  },
  ironclad_garage: {
    id: "ironclad_garage",
    name: "Ironclad Garage",
    description: "A hard-nosed crew specializing in armored transports and heavy rigs.",
    tags: ["mechanic", "industrial", "heavy", "blue_collar"],
  },
  speedy_repairs: {
    id: "speedy_repairs",
    name: "Speedy Repairs",
    description: "Fast and efficient auto repair shop catering to the city's busy commuters.",
    tags: ["mechanic", "industrial", "fast_service", "customer_focused"],
  },
  instafood_collective: {
    id: "instafood_collective",
    name: "InstaFood Collective",
    description: "Franchise kitchen crew with quiet mutual aid roots.",
    tags: ["food_service", "midlands", "customer_facing"],
  },
  swift_runners: {
    id: "swift_runners",
    name: "Swift Runners",
    description: "Fast-footed couriers known for cutting through traffic and bureaucracy alike.",
    tags: ["courier", "street_smart", "speed"],
  },
  night_owl_couriers: {
    id: "night_owl_couriers",
    name: "Night Owl Couriers",
    description: "Discreet night-shift messengers who take the risky routes when others sleep.",
    tags: ["courier", "night", "discreet"],
  },
  no_affiliation: {
    id: "no_affiliation",
    name: "Unaffiliated",
    description: "Freelancers and solos without a formal backer.",
    tags: ["independent", "street"],
  },
}

export const listAffiliations = (): Affiliation[] => Object.values(AFFILIATIONS)

export const getAffiliationById = (id?: string | null): Affiliation | undefined =>
  id ? AFFILIATIONS[id] : undefined

export default AFFILIATIONS
