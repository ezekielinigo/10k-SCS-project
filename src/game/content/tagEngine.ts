import type { EventScope, GameState, PlayerState, Tag } from "../types"
import { getJobById } from "./careers"

export type ContentContext = {
  jobTags: Tag[]
  districtTags: Tag[]
  npcTags: Tag[]
  statTags: Tag[]
  playerTags: Tag[]
  worldTags: Tag[]
}

const uniq = (tags: Tag[]): Tag[] => Array.from(new Set(tags))

const deriveStatTags = (player: PlayerState): Tag[] => {
  const tags: Tag[] = []
  const { vitals } = player

  if (vitals.health <= 40) tags.push("low_health")
  if (vitals.health >= 80) tags.push("high_health")
  if (vitals.stress >= 60) tags.push("high_stress")
  if (vitals.stress <= 20) tags.push("low_stress")
  if (vitals.humanity <= 40) tags.push("low_humanity")
  if (vitals.money >= 1000) tags.push("wealthy")
  if (vitals.money <= 200) tags.push("broke")

  return tags
}

export const buildContentContext = (state: GameState): ContentContext => {
  const player = state.player
  const assignment = Object.values(state.jobAssignments ?? {}).find(a => a.memberId === player.id)
  const jobTags = assignment ? getJobById(assignment.jobId)?.tags ?? [] : []
  const district = state.districts[player.currentDistrict]
  const districtTags = district?.tags ?? []
  const npcTags = Object.values(state.npcs).flatMap(npc => npc.tags)
  const statTags = deriveStatTags(player)
  const playerTags = player.tags
  const worldTags = state.worldTags

  return {
    jobTags: uniq(jobTags),
    districtTags: uniq(districtTags),
    npcTags: uniq(npcTags),
    statTags: uniq(statTags),
    playerTags: uniq(playerTags),
    worldTags: uniq(worldTags),
  }
}

export const hasIntersection = (a: Tag[], b: Tag[]): boolean =>
  a.some(tag => b.includes(tag))

export const countIntersections = (a: Tag[], b: Tag[]): number =>
  a.reduce((count, tag) => (b.includes(tag) ? count + 1 : count), 0)

const scopeTagSelector: Record<EventScope, (ctx: ContentContext) => Tag[]> = {
  job_related: ctx => ctx.jobTags,
  district_related: ctx => ctx.districtTags,
  npc_related: ctx => ctx.npcTags,
  faction_related: ctx => ctx.jobTags,
  world: ctx => ctx.worldTags,
  personal_life: ctx => [...ctx.playerTags],
  health: ctx => ctx.statTags,
  cyberware: ctx => [...ctx.statTags, ...ctx.playerTags],
}

export const scopeTagsFor = (scope: EventScope, ctx: ContentContext): Tag[] =>
  scopeTagSelector[scope]?.(ctx) ?? []

export const templateMatchesScope = (
  scope: EventScope,
  tags: Tag[],
  ctx: ContentContext,
): boolean => {
  if (scope === "world") return true
  const comparisonSet = scopeTagsFor(scope, ctx)
  return hasIntersection(tags, comparisonSet)
}

export const scoreTemplateAgainstContext = (
  templateTags: Tag[],
  ctxTags: Tag[],
  baseWeight = 1,
): number => baseWeight + countIntersections(templateTags, ctxTags)

export type WeightedTemplate<T> = T & { weight: number }

export const pickWeightedTemplate = <T>(items: WeightedTemplate<T>[]): T | undefined => {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  if (total <= 0) {
    return undefined
  }
  const threshold = Math.random() * total
  let running = 0
  for (const item of items) {
    running += item.weight
    if (threshold <= running) {
      return item
    }
  }
  return items[items.length - 1]
}
