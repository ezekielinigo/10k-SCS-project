import { getCareerForJobId, getJobById } from "../content/careers"
import type { JobInstance } from "../types"

const randId = () => Math.random().toString(36).slice(2)

type InstanceOptions = {
  templateId: string
  salaryJitter?: number
  seed?: string
}

type BatchOptions = Partial<{
  salaryJitter: number
  maxListings: number
  playerCareerId: string | null
  playerAffiliationId: string | null
  playerCurrentJobId: string | null
}>

export function generateJobInstance(opts: InstanceOptions): JobInstance | null {
  const tmpl = getJobById(opts.templateId)
  if (!tmpl) return null

  const seed = opts.seed ?? randId()
  const jitter = opts.salaryJitter ?? 0.2
  const baseSalary = tmpl.salary ?? 0
  const delta = baseSalary * jitter * (Math.random() * 2 - 1)
  const salary = Math.max(0, Math.round(baseSalary + delta))

  let affiliationId: string | null | undefined = null
  const career = getCareerForJobId(tmpl.id)
  const candidates = career?.affiliationId ?? []
  if (candidates.length > 0) {
    affiliationId = candidates[Math.floor(Math.random() * candidates.length)]
  }

  const description = Array.isArray(tmpl.description)
    ? tmpl.description[Math.floor(Math.random() * tmpl.description.length)]
    : tmpl.description

  return {
    id: `job_${tmpl.id}__${seed}`,
    templateId: tmpl.id,
    affiliationId,
    salary,
    tags: tmpl.tags ?? [],
    description: description ?? undefined,
    filledBy: null,
    metadata: { seed },
  }
}

export function generateJobInstances(templateIds: string[], overrides?: Partial<InstanceOptions> & BatchOptions): JobInstance[] {
  const maxListings = overrides?.maxListings ?? 5
  const salaryJitter = overrides?.salaryJitter
  const templates = [...templateIds]
  for (let i = templates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = templates[i]
    templates[i] = templates[j]
    templates[j] = t
  }

  const instances: JobInstance[] = []
  const normalizeAff = (aff: string | null | undefined) => aff ?? null

  const findExistingIndex = (affId: string | null | undefined, title: string | undefined) => {
    const targetAff = normalizeAff(affId)
    return instances.findIndex(inst => normalizeAff(inst.affiliationId) === targetAff && (getJobById(inst.templateId)?.title ?? inst.templateId) === (title ?? inst.templateId))
  }

  const passes = Math.max(1, Math.ceil(maxListings / Math.max(1, templates.length)))

  for (let pass = 0; pass < passes && instances.length < maxListings; pass++) {
    for (const templateId of templates) {
      if (instances.length >= maxListings) break

      const tmpl = getJobById(templateId)
      if (!tmpl) continue

      try {
        const career = getCareerForJobId(tmpl.id)
        if (overrides?.playerCareerId && overrides?.playerAffiliationId) {
          if (career?.id === overrides.playerCareerId) {
            const candidateAffiliations = career.affiliationId ?? []
            if (candidateAffiliations.length === 1 && candidateAffiliations[0] === overrides.playerAffiliationId) {
              continue
            }
          }
        }
      } catch (e) {
        // ignore
      }

      const inst = generateJobInstance({ templateId, salaryJitter })
      if (!inst) continue

      const normalizedAff = normalizeAff(inst.affiliationId)

      if (overrides?.playerCurrentJobId && overrides.playerCurrentJobId === inst.templateId) {
        if (!overrides.playerAffiliationId || overrides.playerAffiliationId === normalizedAff) continue
      }

      if (overrides?.playerCareerId && overrides?.playerAffiliationId) {
        const instCareer = getCareerForJobId(inst.templateId)
        if (instCareer?.id === overrides.playerCareerId && normalizedAff === overrides.playerAffiliationId) {
          continue
        }
      }

      const jobTitle = getJobById(inst.templateId)?.title
      const existingIndex = findExistingIndex(normalizedAff, jobTitle)
      if (existingIndex !== -1) {
        const existing = instances[existingIndex]
        if ((existing.salary ?? 0) >= (inst.salary ?? 0)) continue
        instances.splice(existingIndex, 1, inst)
        continue
      }

      instances.push(inst)
      if (instances.length >= maxListings) break
    }
  }

  if (instances.length < maxListings) {
    for (const templateId of templates) {
      if (instances.length >= maxListings) break
      const inst = generateJobInstance({ templateId, salaryJitter })
      if (!inst) continue
      const normalizedAff = normalizeAff(inst.affiliationId)

      if (overrides?.playerCurrentJobId && overrides.playerCurrentJobId === inst.templateId) {
        if (!overrides.playerAffiliationId || overrides.playerAffiliationId === normalizedAff) continue
      }

      const jobTitle = getJobById(inst.templateId)?.title
      const existingIndex = findExistingIndex(normalizedAff, jobTitle)
      if (existingIndex !== -1) {
        const existing = instances[existingIndex]
        if ((existing.salary ?? 0) >= (inst.salary ?? 0)) continue
        instances.splice(existingIndex, 1, inst)
        continue
      }
      instances.push(inst)
    }
  }

  return instances.slice(0, maxListings)
}
