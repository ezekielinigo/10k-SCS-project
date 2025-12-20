import { getCareerForJobId, getJobById } from "../content/careers"
import type { JobPosting } from "../types"

const randId = () => Math.random().toString(36).slice(2)

type PostingOptions = {
  templateId: string
  salaryJitter?: number // e.g. 0.2 for ±20%
  seed?: string
}

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

// Convenience: create multiple postings from a list of template IDs.
export function generateJobPostings(templateIds: string[], overrides?: Partial<PostingOptions>): JobPosting[] {
  const postings: JobPosting[] = []
  for (const templateId of templateIds) {
    const p = generateJobPosting({ templateId, ...overrides })
    if (p) postings.push(p)
  }
  return postings
}
