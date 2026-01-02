import React from "react"
import { StatusBar, StyleSheet, View, TouchableOpacity, Text } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { GameProvider, useGame } from "@shared/game/GameContext"
import { useInk } from "@shared/game/useInk"
import SummaryPanel from "./src/components/SummaryPanel.native"
import LogPanel from "./src/components/LogPanel.native"
import TaskPanel from "./src/components/TaskPanel.native"
import InkModal from "./src/components/InkModal.native"
import ProfileViewHandler from "./src/components/ProfileViewHandler.native"
import ChangeJobModal from "./src/components/ChangeJobModal.native"
import ChangeDistrictModal from "./src/components/ChangeDistrictModal.native"
import RelationshipsModal from "./src/components/RelationshipsModal.native"
import AffiliationMapModal from "./src/components/AffiliationMapModal.native"
import DebugControlsModal from "./src/components/DebugControlsModal.native"
import DebugNpcModal from "./src/components/DebugNpcModal.native"
import StatCheckModal from "./src/components/StatCheckModal.native"
import AvatarMixerModal from "./src/components/AvatarMixerModal.native"

const extractDeltas = (vars?: Record<string, any>) => {
  const deltas: Record<string, number> = {}
  if (!vars) return deltas
  for (const key of Object.keys(vars)) {
    if (!key.startsWith("delta_")) continue
    const name = key.slice(6)
    const val = Number(vars[key] ?? 0)
    if (!val) continue
    deltas[name] = val
  }
  return deltas
}

function GameScreen() {
  const { state, dispatch } = useGame()
  const ink = useInk({ state, dispatch })
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [jobOpen, setJobOpen] = React.useState(false)
  const [districtOpen, setDistrictOpen] = React.useState(false)
  const [affiliationOpen, setAffiliationOpen] = React.useState(false)
  const [relationshipsOpen, setRelationshipsOpen] = React.useState(false)
  const [debugNpcsOpen, setDebugNpcsOpen] = React.useState(false)
  const [debugControlsOpen, setDebugControlsOpen] = React.useState(false)
  const [avatarMixerOpen, setAvatarMixerOpen] = React.useState(false)
  const [statCheckCfg, setStatCheckCfg] = React.useState<{ dc: number; mainStatKey: any; subSkillKey: any } | null>(null)
  const [statCheckResult, setStatCheckResult] = React.useState<any | null>(null)

  const currentInkText = ink.inkFrames.length ? ink.inkFrames[ink.inkFrames.length - 1]?.text : undefined
  const inkDeltas = extractDeltas(ink.inkVars)

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SummaryPanel />

      <View style={styles.row}>
        <LogPanel />
        <TaskPanel onOpenInk={ink.openInkForTask} />
      </View>

      <View style={styles.fabs}>
        <TouchableOpacity style={[styles.fab, styles.secondaryFab]} onPress={() => setDebugControlsOpen(true)}>
          <Text style={styles.fabText}>≡</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={() => dispatch({ type: "ADVANCE_MONTH" })}>
          <Text style={styles.fabText}>+1M</Text>
        </TouchableOpacity>
      </View>

      <InkModal
        open={ink.inkOpen && !ink.inkStatCheck}
        onClose={ink.handleCloseInkModal}
        frames={ink.inkFrames}
        statsVars={ink.inkVars}
        onChoose={ink.handleChoose}
        inkStatCheck={ink.inkStatCheck ?? undefined}
        title={ink.inkTitle ?? undefined}
      />

      {ink.inkStatCheck ? (
        <StatCheckModal
          open={ink.inkStatCheckOpen}
          onClose={ink.closeInkStatCheck}
          title={ink.inkTitle ?? "Stat Check"}
          dc={ink.inkStatCheck.dc}
          mainStatKey={ink.inkStatCheck.mainStatKey}
          mainStatValue={ink.inkStatCheck.result.mainStat}
          subSkillKey={ink.inkStatCheck.subSkillKey ?? undefined}
          subSkillValue={ink.inkStatCheck.result.subSkillBonus}
          initialResult={ink.inkStatCheck.result}
          autoRun={false}
          bodyText={currentInkText}
          deltas={inkDeltas}
        />
      ) : null}

      <DebugControlsModal
        open={debugControlsOpen}
        onClose={() => setDebugControlsOpen(false)}
        onShowProfile={() => setProfileOpen(true)}
        onChangeJob={() => setJobOpen(true)}
        onShowAffiliationMap={() => setAffiliationOpen(true)}
        onShowRelationships={() => setRelationshipsOpen(true)}
        onShowDebugNpcs={() => setDebugNpcsOpen(true)}
        onOpenInk={() => ink.openInkDebug()}
        onOpenDistrict={() => setDistrictOpen(true)}
        onOpenStatCheck={(cfg, res) => { setStatCheckCfg(cfg); setStatCheckResult(res); }}
        onOpenAvatarMixer={() => setAvatarMixerOpen(true)}
      />

      <ProfileViewHandler open={profileOpen} onClose={() => setProfileOpen(false)} target={{ mode: "player" }} />
      <ChangeJobModal open={jobOpen} onClose={() => setJobOpen(false)} />
      <ChangeDistrictModal open={districtOpen} onClose={() => setDistrictOpen(false)} />
      <RelationshipsModal open={relationshipsOpen} onClose={() => setRelationshipsOpen(false)} />
      <AffiliationMapModal open={affiliationOpen} onClose={() => setAffiliationOpen(false)} />
      <DebugNpcModal open={debugNpcsOpen} onClose={() => setDebugNpcsOpen(false)} />
      <AvatarMixerModal open={avatarMixerOpen} onClose={() => setAvatarMixerOpen(false)} />
      <StatCheckModal
        open={!!statCheckCfg}
        onClose={() => { setStatCheckCfg(null); setStatCheckResult(null) }}
        title="Stat Check"
        dc={statCheckCfg?.dc ?? 10}
        mainStatKey={statCheckCfg?.mainStatKey ?? "str"}
        mainStatValue={state.player?.skills?.[statCheckCfg?.mainStatKey ?? "str"] ?? 0}
        subSkillKey={statCheckCfg?.subSkillKey ?? undefined}
        subSkillValue={state.player?.skills?.subSkills?.[statCheckCfg?.subSkillKey ?? "athletics"] ?? 0}
        initialResult={statCheckResult ?? undefined}
        autoRun={false}
        onResolve={(res) => {
          if (!statCheckCfg) return
          const text = [
            "STAT CHECK",
            `${String(statCheckCfg.mainStatKey).toUpperCase()}/${String(statCheckCfg.subSkillKey).toUpperCase()}`,
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
    </View>
  )
}

export default function App() {
  return (
    <GameProvider>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <GameScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    </GameProvider>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#05050b" },
  screen: { flex: 1, padding: 14, gap: 12 },
  row: { flexDirection: "column", gap: 12, flex: 1 },
  fabs: {
    position: "absolute",
    right: 16,
    bottom: 24,
    flexDirection: "row",
    gap: 10,
  },
  fab: {
    backgroundColor: "#1b5cff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#295fff",
  },
  secondaryFab: { backgroundColor: "#161620", borderColor: "#252536" },
  fabText: { color: "#fff", fontWeight: "800", letterSpacing: 0.5 },
})