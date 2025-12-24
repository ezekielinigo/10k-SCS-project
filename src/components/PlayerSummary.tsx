import { useState, type KeyboardEvent } from "react"
import { useGame } from "../game/GameContext"
import { getJobById } from "../game/content/careers"
import type { GameState, PlayerState } from "../game/types"
import { PLAYER_VITAL_KEYS, VITAL_DEFINITIONS, SKILL_COLORS } from "../utils/ui"

type SubSkillKey = keyof PlayerState["skills"]["subSkills"]
type MainSkillKey = "str" | "int" | "ref" | "chr"

type SkillGroupDefinition = {
  key: MainSkillKey
  label: string
  color: string
  subskills: { key: SubSkillKey; label: string }[]
}

const SUBBAR_WIDTH = 10
const SUBBAR_GAP = 5
const SUBBAR_HEIGHT = 48
const SUBBAR_CONTAINER_WIDTH = SUBBAR_WIDTH * 3 + SUBBAR_GAP * 2

const MAIN_SKILL_DEFINITIONS: SkillGroupDefinition[] = [
  {
    key: "str",
    label: "STR",
    color: SKILL_COLORS.STR,
    subskills: [
      { key: "athletics", label: "ATH" },
      { key: "closeCombat", label: "CLS" },
      { key: "heavyHandling", label: "HVY" },
    ],
  },
  {
    key: "int",
    label: "INT",
    color: SKILL_COLORS.INT,
    subskills: [
      { key: "hacking", label: "HCK" },
      { key: "medical", label: "MED" },
      { key: "engineering", label: "ENG" },
    ],
  },
  {
    key: "ref",
    label: "REF",
    color: SKILL_COLORS.REF,
    subskills: [
      { key: "marksmanship", label: "MRK" },
      { key: "stealth", label: "STL" },
      { key: "mobility", label: "MOB" },
    ],
  },
  {
    key: "chr",
    label: "CHR",
    color: SKILL_COLORS.CHR,
    subskills: [
      { key: "persuasion", label: "PRS" },
      { key: "deception", label: "DCP" },
      { key: "streetwise", label: "STW" },
    ],
  },
]

const getPlayerProfileData = (state: GameState) => {
  const player = state.player
  const assignments = Object.values(state.jobAssignments ?? {}).filter(a => a.memberId === player.id)
  const jobs = assignments.map(a => getJobById(a.jobId)).filter(Boolean)
  const membership = Object.values(state.memberships ?? {}).find(m => m.memberId === player.id)

  return { player, assignments, jobs, membership }
}

function InlineSmallProgress({ value, max = 100, height = 6, color = "#666" }: { value: number; max?: number; height?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) / (max || 1) * 100)))
  return (
    <div style={{ background: "#222", borderRadius: 6, height, width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6 }} />
    </div>
  )
}

function VerticalBar({ value, max = 100, height = 48, width = 18, color = "#4f82ff" }: { value: number; max?: number; height?: number; width?: number; color?: string }) {
  const clampedValue = Math.max(0, Math.min(max, Number(value) || 0))
  const fillPercent = (clampedValue / max) * 100
  return (
    <div
      style={{
        width,
        height,
        background: "#222",
        borderRadius: "999px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: `${fillPercent}%`,
          background: color,
          transition: "height 0.25s ease",
        }}
      />
    </div>
  )
}

function SmallVerticalBar({ value, max = 10, segments = 10, height = 48, width = 40, color = "#4f82ff" }: { value: number; max?: number; segments?: number; height?: number; width?: number; color?: string }) {
  const segs = Math.max(1, Math.floor(segments))
  const clampedValue = Math.max(0, Math.min(max, Number(value) || 0))
  const filledCount = Math.round((clampedValue / max) * segs)
  const gap = 2
  const totalGap = gap * Math.max(0, segs - 1)
  const segmentHeight = Math.max(4, Math.floor((height - totalGap) / segs))

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column-reverse", gap: `${gap}px`, height, width }}>
        {Array.from({ length: segs }).map((_, i) => {
          const filled = i < filledCount
          return (
            <div
              key={i}
              style={{
                height: `${segmentHeight}px`,
                width: "100%",
                background: filled ? color : "#222",
                borderRadius: 4,
                boxSizing: "border-box",
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

export function PlayerSummary({ onOpenProfile }: { onOpenProfile?: () => void }) {
  const { state } = useGame()
  const { player, jobs } = getPlayerProfileData(state)
  const titles = jobs.map(j => j?.title).filter(Boolean) as string[]
  const titleText = titles.length === 0 ? "Unemployed" : titles.join(titles.length > 2 ? ", " : " & ")
  const [showSubskills, setShowSubskills] = useState(false)
  const toggleSkillView = () => setShowSubskills(prev => !prev)
  const handleSkillKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      toggleSkillView()
    }
  }

  const subSkills = player.skills.subSkills

  const vitalsToShow = PLAYER_VITAL_KEYS
    .map(key => VITAL_DEFINITIONS[key])
    .filter(def => (def as any).enabled !== false)

  return (
    <div
      style={{ display: "flex", flexDirection: "row", padding: "0.75rem", borderBottom: "1px solid #333", alignItems: "center" }}
    >
      <div style={{ flex: 1, minWidth: 0, cursor: onOpenProfile ? "pointer" : "default" }}
      role={onOpenProfile ? "button" : undefined}
      tabIndex={onOpenProfile ? 0 : undefined}
      onClick={() => onOpenProfile?.()}
      onKeyDown={(e) => {
        if (!onOpenProfile) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpenProfile()
        }
      }}>
        <div>
          <div>
            <strong>{player.name}</strong> - {Math.floor((player.ageMonths + state.month) / 12)} yrs
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 6, marginRight: 12}}>
            {vitalsToShow.map(v => {
              const val = (player.vitals as any)[v.key]
              const Icon = v.Icon
              const showBar = typeof v.max !== "undefined"
              return (
                <div key={String(v.key)} style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#ddd" }}>
                      <Icon size={12} />
                      <div style={{ fontSize: "0.78rem", color: "#ddd", width: 20 }}>{val ?? 0}</div>
                    </div>
                    {showBar ? (
                      <div style={{ marginLeft: "auto", width: 160, marginBottom: 3 }}>
                        <InlineSmallProgress value={val ?? 0} max={v.max} height={6} color="#666" />
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 6 }}>{titleText}</div>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-pressed={showSubskills}
        aria-label={showSubskills ? "Show main skill bars" : "Show subskill breakdown"}
        onClick={toggleSkillView}
        onKeyDown={handleSkillKeyDown}
        style={{ display: "flex", gap: 12, alignItems: "flex-end", cursor: "pointer" }}
      >
        {MAIN_SKILL_DEFINITIONS.map(def => {
          const mainValue = player.skills[def.key]
          return (
            <div key={def.key} style={{ textAlign: "center" }}>
              {showSubskills ? (
                <div style={{ width: `${SUBBAR_CONTAINER_WIDTH}px`, margin: "0 auto" }}>
                  <div style={{ display: "flex", gap: `${SUBBAR_GAP}px`, alignItems: "flex-end", justifyContent: "center" }}>
                    {def.subskills.map(sub => {
                      const rawValue = subSkills[sub.key]
                      return (
                        <div key={sub.key}>
                          <VerticalBar value={rawValue ?? 0} max={100} height={SUBBAR_HEIGHT} width={SUBBAR_WIDTH} color={def.color} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <SmallVerticalBar value={mainValue} color={def.color} />
              )}
              <div style={{ fontSize: "0.8rem", marginTop: 6 }}>{def.label} {mainValue}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PlayerSummary