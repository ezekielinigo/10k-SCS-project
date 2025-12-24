import { useGame } from "./game/GameContext.tsx"
import { useState } from "react"
import ProfileViewHandler from "./components/ProfileViewHandler"
import ChangeJobModal from "./components/ChangeJobModal"
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
  const { state, dispatch } = useGame()
  const { inkOpen, inkFrames, inkVars, openInkDebug, openInkForTask, handleChoose, handleCloseInkModal } = useInk({ state, dispatch })

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
      />
      <DebugControlsModal
        open={debugControlsOpen}
        onClose={() => setDebugControlsOpen(false)}
        onShowProfile={() => { setProfileOpen(true); setDebugControlsOpen(false) }}
        onChangeJob={() => { setJobModalOpen(true); setDebugControlsOpen(false) }}
        onShowAffiliationMap={() => { setAffiliationOpen(true); setDebugControlsOpen(false) }}
        onShowRelationships={() => { setRelationshipsOpen(true); setDebugControlsOpen(false) }}
        onShowDebugNpcs={() => { setDebugNpcsOpen(true); setDebugControlsOpen(false) }}
        onOpenInk={() => { openInkDebug(); setDebugControlsOpen(false) }}
      />

      <ProfileViewHandler open={profileOpen} onClose={() => setProfileOpen(false)} target={{ mode: "player" }} />
      <ChangeJobModal open={jobModalOpen} onClose={() => setJobModalOpen(false)} />
      <AffiliationMapModal open={affiliationOpen} onClose={() => setAffiliationOpen(false)} />
      <RelationshipsModal open={relationshipsOpen} onClose={() => setRelationshipsOpen(false)} />
      <DebugNpcModal open={debugNpcsOpen} onClose={() => setDebugNpcsOpen(false)} />
    </div>
  )
}
