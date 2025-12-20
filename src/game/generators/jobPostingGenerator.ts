import { getCareerForJobId, getJobById } from "../content/careers"
import type { JobPosting } from "../types"

const randId = () => Math.random().toString(36).slice(2)

type PostingOptions = {
  templateId: string
  salaryJitter?: number // e.g. 0.2 for ±20%
  seed?: string
}

type BatchOptions = Partial<{
  salaryJitter: number
  maxListings: number
  // if provided, skip postings from this career+affiliation pair
  playerCareerId: string | null
  playerAffiliationId: string | null
  // if provided, skip postings for the exact same job+affiliation the player already holds
  playerCurrentJobId: string | null
}>

// Builds a single job posting from a job template. Intended for procedural generation.
export function generateJobPosting(opts: PostingOptions): JobPosting | null {
  const tmpl = getJobById(opts.templateId)
  if (!tmpl) return null

  const seed = opts.seed ?? randId()
  // lightweight deterministic-ish jitter
  const jitter = opts.salaryJitter ?? 0.2
  const baseSalary = tmpl.salary ?? 0
  const delta = baseSalary * jitter * (Math.random() * 2 - 1)
  const salary = Math.max(0, Math.round(baseSalary + delta))

  // choose affiliation from career affiliations
  let affiliationId: string | null | undefined = null
  const career = getCareerForJobId(tmpl.id)
  const candidates = career?.affiliationId ?? []
  if (candidates.length > 0) {
    affiliationId = candidates[Math.floor(Math.random() * candidates.length)]
  }

  // pick one description variant if array
  const description = Array.isArray(tmpl.description)
    ? tmpl.description[Math.floor(Math.random() * tmpl.description.length)]
    : tmpl.description

  return {
    id: `posting_${tmpl.id}__${seed}`,
    templateId: tmpl.id,
    affiliationId,
    salary,
    tags: tmpl.tags ?? [],
    description: description ?? undefined,
    filledBy: null,
    metadata: { seed },
  }
}

// Create multiple postings from a list of template IDs.
// Respects options to maximize filling `maxListings`, skip player's own career+affiliation, and dedupe lower-salary duplicates per employer+title.
export function generateJobPostings(templateIds: string[], overrides?: Partial<PostingOptions> & BatchOptions): JobPosting[] {
  const maxListings = overrides?.maxListings ?? 5
  const salaryJitter = overrides?.salaryJitter

  // shuffle templates to get varied selection
  const templates = [...templateIds]
  for (let i = templates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = templates[i]
    templates[i] = templates[j]
    templates[j] = t
  }

  const postings: JobPosting[] = []

  const normalizeAff = (aff: string | null | undefined) => aff ?? null

  // helper to find existing posting with same employer+title
  const findExistingIndex = (affId: string | null | undefined, title: string | undefined) => {
    const targetAff = normalizeAff(affId)
    return postings.findIndex(p => normalizeAff(p.affiliationId) === targetAff && (getJobById(p.templateId)?.title ?? p.templateId) === (title ?? p.templateId))
  }

  // try each template once; if we still have slots, allow another pass to try different random affiliations
  const passes = Math.max(1, Math.ceil(maxListings / Math.max(1, templates.length)))

  for (let pass = 0; pass < passes && postings.length < maxListings; pass++) {
    for (const templateId of templates) {
      if (postings.length >= maxListings) break

      const tmpl = getJobById(templateId)
      if (!tmpl) continue

      // rule: skip postings from the player's current career tree at the same affiliation
      try {
        const career = getCareerForJobId(tmpl.id)
        if (overrides?.playerCareerId && overrides?.playerAffiliationId) {
          if (career?.id === overrides.playerCareerId) {
            // affiliation selection happens inside generateJobPosting; we can pre-check by looking at career.affiliationId
            const candidateAffiliations = career.affiliationId ?? []
            // if player's affiliation is the only possible affiliation for this career, skip entirely
            if (candidateAffiliations.length === 1 && candidateAffiliations[0] === overrides.playerAffiliationId) {
              continue
            }
            // otherwise, if candidateAffiliations includes player's affiliation we still allow generateJobPosting to possibly pick another affiliation; we'll filter after generation
          }
        }
      } catch (e) {
        // ignore
      }

      const p = generateJobPosting({ templateId, salaryJitter })
      if (!p) continue

      const normalizedAff = normalizeAff(p.affiliationId)

      // skip if player already holds this exact job at this affiliation
      if (overrides?.playerCurrentJobId && overrides.playerCurrentJobId === p.templateId) {
        if (!overrides.playerAffiliationId || overrides.playerAffiliationId === normalizedAff) {
          continue
        }
      }

      // if playerCareer+affiliation specified, skip when both career and chosen affiliation match player's
      if (overrides?.playerCareerId && overrides?.playerAffiliationId) {
        const tmplCareer = getCareerForJobId(p.templateId)
        if (tmplCareer?.id === overrides.playerCareerId && normalizedAff === overrides.playerAffiliationId) {
          // skip this posting
          continue
        }
      }

      // dedupe: if same employer and same job title exists, keep higher salary only
      const jobTitle = getJobById(p.templateId)?.title
      const existingIndex = findExistingIndex(normalizedAff, jobTitle)
      if (existingIndex !== -1) {
        const existing = postings[existingIndex]
        if ((existing.salary ?? 0) >= (p.salary ?? 0)) {
          // existing is better or equal, skip new one
          continue
        } else {
          // replace existing with higher salary new one
          postings.splice(existingIndex, 1, p)
          continue
        }
      }

      postings.push(p)
      if (postings.length >= maxListings) break
    }
  }

  // final pass: if still not full, attempt to fill with any templates ignoring career-affiliation rule (only when impossible otherwise)
  if (postings.length < maxListings) {
    for (const templateId of templates) {
      if (postings.length >= maxListings) break
      const p = generateJobPosting({ templateId, salaryJitter })
      if (!p) continue
      const normalizedAff = normalizeAff(p.affiliationId)

      if (overrides?.playerCurrentJobId && overrides.playerCurrentJobId === p.templateId) {
        if (!overrides.playerAffiliationId || overrides.playerAffiliationId === normalizedAff) {
          continue
        }
      }

      const jobTitle = getJobById(p.templateId)?.title
      const existingIndex = findExistingIndex(normalizedAff, jobTitle)
      if (existingIndex !== -1) {
        const existing = postings[existingIndex]
        if ((existing.salary ?? 0) >= (p.salary ?? 0)) {
          continue
        } else {
          postings.splice(existingIndex, 1, p)
          continue
        }
      }
      postings.push(p)
    }
  }

  // ensure no more than maxListings
  return postings.slice(0, maxListings)
}
