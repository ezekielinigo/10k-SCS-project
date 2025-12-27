import { useGame } from "./game/GameContext.tsx"
import { useState } from "react"
import ProfileViewHandler from "./components/ProfileViewHandler"
import ChangeJobModal from "./components/ChangeJobModal"
import ChangeDistrictModal from "./components/ChangeDistrictModal"
import DebugStatCheckModal from "./components/DebugStatCheckModal"
import AffiliationMapModal from "./components/AffiliationMapModal"
import RelationshipsModal from "./components/RelationshipsModal"
import DebugNpcModal from "./components/DebugNpcModal"
import DebugControlsModal from "./components/DebugControlsModal"
import { FiMenu, FiPlus } from "react-icons/fi"
import PlayerSummary from "./components/PlayerSummary"
import TaskPanel from "./components/TaskPanel"
import LogPanel from "./components/LogPanel"
import { useInk } from "./game/useInk"
import InkModalWrapper from "./components/InkModalWrapper"



export default function App() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [jobModalOpen, setJobModalOpen] = useState(false)
  const [affiliationOpen, setAffiliationOpen] = useState(false)
  const [relationshipsOpen, setRelationshipsOpen] = useState(false)
  const [debugNpcsOpen, setDebugNpcsOpen] = useState(false)
  const [debugControlsOpen, setDebugControlsOpen] = useState(false)
  const [districtOpen, setDistrictOpen] = useState(false)
  const [statCheckOpen, setStatCheckOpen] = useState(false)
  const [statCheckConfig, setStatCheckConfig] = useState<{ dc: number; mainStatKey: any; subSkillKey: any } | null>(null)
  const [statCheckResult, setStatCheckResult] = useState<any | null>(null)
  const { state, dispatch } = useGame()
  const { inkOpen, inkFrames, inkVars, openInkDebug, openInkForTask, handleChoose, handleCloseInkModal, inkStatCheck, inkTitle } = useInk({ state, dispatch })
  const openAndClose = (fn: () => void) => () => {
    fn()
    setDebugControlsOpen(false)
  }

  const openDistrict = () => setDistrictOpen(true)
  const openStatCheck = (cfg: { dc: number; mainStatKey: any; subSkillKey: any }, res: any) => {
    setStatCheckConfig(cfg)
    setStatCheckResult(res)
    setStatCheckOpen(true)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <PlayerSummary onOpenProfile={() => setProfileOpen(true)} />
      <div className="two-panel" style={{ flex: 1, minHeight: 0 }}>
        <LogPanel />
        <TaskPanel onOpenInk={openInkForTask} />
      </div>
      

      {/* Fixed-position controls: hamburger (open debug modal) and plus (advance month) */}
      <button
        aria-label="Open debug controls"
        onClick={() => setDebugControlsOpen(true)}
        style={{
          position: "fixed",
          left: "1rem",
          bottom: "1rem",
          width: "56px",
          height: "56px",
          borderRadius: "8px",
          background: "#222",
          color: "#fff",
          border: "1px solid #444",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          boxSizing: "border-box",
          fontSize: "24px",
          lineHeight: 1,
        }}
      >
        <FiMenu size={20} />
      </button>

      <button
        aria-label="Advance 1 month"
        onClick={() => dispatch({ type: "ADVANCE_MONTH" })}
        style={{
          position: "fixed",
          right: "1rem",
          bottom: "1rem",
          width: "56px",
          height: "56px",
          borderRadius: "28px",
          background: "#222",
          color: "#fff",
          border: "1px solid #444",
          fontSize: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          boxSizing: "border-box",
          lineHeight: 1,
        }}
      >
        <FiPlus size={20} />
      </button>

      <InkModalWrapper
        open={inkOpen}
        onClose={handleCloseInkModal}
        frames={inkFrames}
        statsVars={inkVars}
        onChoose={handleChoose}
        inkStatCheck={inkStatCheck}
        title={inkTitle}
      />
      {/* Debug stat-check modal disabled in production flow */}
      <DebugControlsModal
        open={debugControlsOpen}
        onClose={() => setDebugControlsOpen(false)}
        onShowProfile={openAndClose(() => setProfileOpen(true))}
        onChangeJob={openAndClose(() => setJobModalOpen(true))}
        onShowAffiliationMap={openAndClose(() => setAffiliationOpen(true))}
        onShowRelationships={openAndClose(() => setRelationshipsOpen(true))}
        onShowDebugNpcs={openAndClose(() => setDebugNpcsOpen(true))}
        onOpenInk={openAndClose(() => openInkDebug())}
        onOpenDistrict={openDistrict}
        onOpenStatCheck={openStatCheck}
      />

      <ProfileViewHandler open={profileOpen} onClose={() => setProfileOpen(false)} target={{ mode: "player" }} />
      <ChangeJobModal open={jobModalOpen} onClose={() => setJobModalOpen(false)} />
      <ChangeDistrictModal open={districtOpen} onClose={() => setDistrictOpen(false)} />
      {statCheckConfig ? (
        <DebugStatCheckModal
          open={statCheckOpen}
          onClose={() => {
            setStatCheckOpen(false)
            setStatCheckConfig(null)
            setStatCheckResult(null)
          }}
          title="Debug Stat Check"
          dc={statCheckConfig.dc}
          mainStatKey={statCheckConfig.mainStatKey}
          mainStatValue={state.player?.skills?.[statCheckConfig.mainStatKey] ?? 0}
          subSkillKey={statCheckConfig.subSkillKey}
          subSkillValue={state.player?.skills?.subSkills?.[statCheckConfig.subSkillKey] ?? 0}
          initialResult={statCheckResult ?? undefined}
          autoRun={false}
          onResolve={(res) => {
            const text = [
              "STAT CHECK",
              `${statCheckConfig.mainStatKey.toUpperCase()}/${statCheckConfig.subSkillKey.toUpperCase()}`,
              `d20=${res.d20}`,
              `main=+${res.mainStat}`,
              `sub=+${res.subSkillBonus}`,
              `total=${res.total}`,
              `vs DC ${res.dc}`,
              res.success ? "SUCCESS" : "FAIL",
              res.critical ? `(${res.critical})` : "",
            ].filter(Boolean).join(" ")
            dispatch({ type: "ADD_LOG", text })
          }}
        />
      ) : null}
      <AffiliationMapModal open={affiliationOpen} onClose={() => setAffiliationOpen(false)} />
      <RelationshipsModal open={relationshipsOpen} onClose={() => setRelationshipsOpen(false)} />
      <DebugNpcModal open={debugNpcsOpen} onClose={() => setDebugNpcsOpen(false)} />
    </div>
  )
}
