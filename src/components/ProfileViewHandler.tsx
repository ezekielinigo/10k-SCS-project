import { useMemo } from "react"
import ProfileModal, { type ProfileData, type ProfileOccupation } from "./ProfileModal"
import { useGame } from "../game/GameContext"
import { getAffiliationById } from "../game/content/affiliations"
import { getCareerForJobId, getJobById } from "../game/content/careers"

export type ProfileTarget = { mode: "player" } | { mode: "npc"; npcId?: string; npc?: any }

const clampSkill = (value: any) => {
  const n = Number(value)
  if (Number.isNaN(n)) return 0
  return n
}

function resolveNpc(state: any, npcId?: string, npc?: any) {
  if (npc) return npc
  if (npcId) return state.npcs?.[npcId]
  return undefined
}

function getMembershipNames(state: any, memberId: string) {
  const memberships = Object.values(state.memberships ?? {}).filter((m: any) => m.memberId === memberId)
  return memberships.map((m: any) => getAffiliationById(m.affiliationId)?.name ?? m.affiliationId)
}

function getPlayerProfile(state: any): ProfileData {
  const player = state.player
  const assignments = (Object.values(state.jobAssignments ?? {}) as any[]).filter((a: any) => a.memberId === player.id)
  const memberships = (Object.values(state.memberships ?? {}) as any[]).filter((m: any) => m.memberId === player.id)
  const subSkillsMap = player.skills.subSkills ?? {}
  const ageYears = Math.floor((player.ageMonths ?? 0) / 12)
  const ageLabel = `${ageYears} yr${ageYears === 1 ? "" : "s"}`
  const tags = player.tags ?? []

  const jobAffiliationName = (job: any) => {
    const career = getCareerForJobId(job?.id)
    const candidateAffIds: string[] = Array.isArray(career?.affiliationId)
      ? career?.affiliationId ?? []
      : career?.affiliationId
        ? [career.affiliationId]
        : []
    let affId: string | undefined = memberships.find((m: any) => candidateAffIds.includes(m.affiliationId))?.affiliationId
    if (!affId && memberships.length > 0) affId = (memberships[0] as any).affiliationId
    return affId ? getAffiliationById(affId)?.name ?? affId : "-"
  }

  const occupations: ProfileOccupation[] = assignments
    .map((a: any) => {
      const job = getJobById(a.jobId)
      if (!job) return null
      const description = Array.isArray(job.description) ? job.description[0] : job.description
      return {
        id: a.id ?? a.jobId,
        jobId: a.jobId,
        title: job.title ?? a.jobId,
        affiliation: jobAffiliationName(job),
        description,
        removable: true,
      }
    })
    .filter(Boolean) as ProfileOccupation[]

  return {
    name: player.name,
    ageLabel,
    gender: player.gender ?? "male",
    districtLabel: player.currentDistrict ?? "-",
    tags,
    affiliations: memberships.map((m: any) => getAffiliationById(m.affiliationId)?.name ?? m.affiliationId),
    vitals: {
      health: player.vitals.health,
      humanity: player.vitals.humanity,
      stress: player.vitals.stress,
      looks: player.vitals.looks,
      money: player.vitals.money,
      bounty: player.vitals.bounty,
      popularity: player.vitals.popularity,
    },
    skills: {
      str: clampSkill(player.skills.str),
      int: clampSkill(player.skills.int),
      ref: clampSkill(player.skills.ref),
      chr: clampSkill(player.skills.chr),
      subSkills: subSkillsMap,
    },
    occupations,
    showAffiliations: false,
    canEditAssignments: true,
  }
}

function getNpcProfile(state: any, npcId?: string, npc?: any): ProfileData | null {
  const resolvedNpc = resolveNpc(state, npcId, npc)
  if (!resolvedNpc) return null

  const subSkillsMap = resolvedNpc.skills?.subSkills ?? {}
  const gender = resolvedNpc.gender ?? "male"
  const jobs = resolvedNpc.jobs ?? []
  const affiliations = getMembershipNames(state, resolvedNpc.id)

  const occupations: ProfileOccupation[] = jobs.map((j: any, idx: number) => {
    const job = getJobById(j.jobId)
    const title = job?.title ?? j.jobId ?? `job_${idx}`
    const affName = getAffiliationById(j.affiliationId ?? undefined)?.name ?? j.affiliationId ?? "no_affiliation"
    const description = Array.isArray(job?.description) ? job?.description[0] : job?.description
    return {
      id: `${j.jobId ?? idx}__${idx}`,
      jobId: j.jobId,
      title,
      affiliation: affName,
      description,
    }
  })

  return {
    name: resolvedNpc.name,
    ageLabel: `Age ${resolvedNpc.age ?? "-"}`,
    gender,
    districtLabel: resolvedNpc.currentDistrict ?? "-",
    tags: resolvedNpc.tags ?? [],
    affiliations,
    vitals: {
      health: resolvedNpc.vitals?.health ?? 0,
      humanity: resolvedNpc.vitals?.humanity ?? 0,
      stress: resolvedNpc.vitals?.stress ?? 0,
      looks: resolvedNpc.vitals?.looks ?? 0,
      money: resolvedNpc.vitals?.money ?? 0,
      bounty: resolvedNpc.vitals?.bounty ?? 0,
      popularity: resolvedNpc.vitals?.popularity ?? 0,
    },
    skills: {
      str: clampSkill(resolvedNpc.skills?.str),
      int: clampSkill(resolvedNpc.skills?.int),
      ref: clampSkill(resolvedNpc.skills?.ref),
      chr: clampSkill(resolvedNpc.skills?.chr),
      subSkills: subSkillsMap,
    },
    occupations,
    showAffiliations: true,
    canEditAssignments: false,
  }
}

export default function ProfileViewHandler({ open, onClose, target }: { open: boolean; onClose: () => void; target: ProfileTarget }) {
  const { state, dispatch } = useGame()

  const profile = useMemo(() => {
    if (target.mode === "player") return getPlayerProfile(state)
    return getNpcProfile(state, target.npcId, target.npc)
  }, [state, target])

  const handleRemove = (jobId: string) => {
    dispatch({ type: "REMOVE_JOB_ASSIGNMENT", jobId })
  }

  return (
    <ProfileModal
      open={open}
      onClose={onClose}
      profile={profile}
      onRemoveAssignment={profile?.canEditAssignments ? handleRemove : undefined}
    />
  )
}
