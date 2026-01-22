import React from "react"
// Skia is used in other components; avoid importing here just for debug logs
import { StatusBar, StyleSheet, View, TouchableOpacity, Text, TextInput } from "react-native"
import * as SplashScreen from "expo-splash-screen"
import useHideSystemBars from "@shared/utils/useHideSystemBars"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { GameProvider, useGame } from "@shared/game/engine/GameContext"
import { useInk } from "@shared/game/hooks/useInk"
import SummaryPanel from "@shared/components/SummaryPanel"
import LogPanel from "@shared/components/LogPanel"
import TaskPanel from "@shared/components/TaskPanel"
import ProfilePanel from "@shared/components/ProfilePanel"
import WorldPanel from "@shared/components/WorldPanel"
import InkModal from "@shared/components/InkModal"
import ProfileViewHandler from "@shared/components/ProfileViewHandler"
import ChangeJobModal from "@shared/components/ChangeJobModal"
import ChangeDistrictModal from "@shared/components/ChangeDistrictModal"
import RelationshipsModal from "@shared/components/RelationshipsModal"
import AffiliationMapModal from "@shared/components/AffiliationMapModal"
import DebugControlsModal from "@shared/components/DebugControlsModal"
import DebugNpcModal from "@shared/components/DebugNpcModal"
import StatCheckModal from "@shared/components/StatCheckModal"
import AvatarMixerModal from "@shared/components/AvatarMixerModal"
import DebugCombatModal from "@shared/components/DebugCombatModal"
import CombatScreen from "@shared/components/CombatScreen"
import fontConfig from "@shared/utils/fontConfig"
import BottomNav from "@shared/components/BottomNav"
const FACES = fontConfig.fontFaceNames()


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
  const [activeTab, setActiveTab] = React.useState<"settings" | "profile" | "log" | "tasks" | "world" | "none">("log")
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
  const [combatDebugOpen, setCombatDebugOpen] = React.useState(false)
  const [combatScreenOpen, setCombatScreenOpen] = React.useState(false)

  const currentInkText = ink.inkFrames.length ? ink.inkFrames[ink.inkFrames.length - 1]?.text : undefined
  const inkDeltas = extractDeltas(ink.inkVars)

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SummaryPanel />

      <View style={styles.row}>
        {activeTab === "log" ? (
          <LogPanel />
        ) : activeTab === "tasks" ? (
          <TaskPanel onOpenInk={ink.openInkForTask} />
        ) : activeTab === "profile" ? (
          <ProfilePanel />
        ) : activeTab === "world" ? (
          <WorldPanel />
        ) : (
          <>
            <LogPanel />
            <TaskPanel onOpenInk={ink.openInkForTask} />
          </>
        )}
      </View>

      {/* floating FABs removed — navigation and advance are handled by BottomNav */}

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
          subSkillKey={typeof ink.inkStatCheck.subSkillKey === "string" ? ink.inkStatCheck.subSkillKey : undefined}
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
        onOpenCombatDebug={() => setCombatDebugOpen(true)}
        onOpenCombatScreen={() => setCombatScreenOpen(true)}
      />

      <ProfileViewHandler open={profileOpen} onClose={() => setProfileOpen(false)} target={{ mode: "player" }} />
      <ChangeJobModal open={jobOpen} onClose={() => setJobOpen(false)} />
      <ChangeDistrictModal open={districtOpen} onClose={() => setDistrictOpen(false)} />
      <RelationshipsModal open={relationshipsOpen} onClose={() => setRelationshipsOpen(false)} />
      <AffiliationMapModal open={affiliationOpen} onClose={() => setAffiliationOpen(false)} />
      <DebugNpcModal open={debugNpcsOpen} onClose={() => setDebugNpcsOpen(false)} />
      <AvatarMixerModal open={avatarMixerOpen} onClose={() => setAvatarMixerOpen(false)} />
      <DebugCombatModal open={combatDebugOpen} onClose={() => setCombatDebugOpen(false)} />
      <CombatScreen open={combatScreenOpen} onClose={() => setCombatScreenOpen(false)} />
      <StatCheckModal
        open={!!statCheckCfg}
        onClose={() => { setStatCheckCfg(null); setStatCheckResult(null) }}
        title="Stat Check"
        dc={statCheckCfg?.dc ?? 10}
        mainStatKey={statCheckCfg?.mainStatKey ?? "str"}
        mainStatValue={(state.player as any)?.skills?.[statCheckCfg?.mainStatKey ?? "str"] ?? 0}
        subSkillKey={statCheckCfg?.subSkillKey ?? undefined}
        subSkillValue={(state.player as any)?.skills?.subSkills?.[statCheckCfg?.subSkillKey ?? "athletics"] ?? 0}
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
      <BottomNav
        active={activeTab}
        onSelect={(t) => setActiveTab(t)}
        onOpenDebug={() => setDebugControlsOpen(true)}
        onAdvanceMonth={() => dispatch({ type: "ADVANCE_MONTH" })}
      />
    </View>
  )
}

SplashScreen.preventAutoHideAsync().catch(() => undefined)

export default function App() {
  useHideSystemBars(true)

  // Skia debug logging removed — native module presence is validated during builds.

  const [fontsLoaded, fontError] = fontConfig.useLoadFonts()

  React.useEffect(() => {
    if (!fontsLoaded && !fontError) return
    SplashScreen.hideAsync().catch(() => undefined)
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) return null

  return (
    <GameProvider>
      <GestureHandlerRootView style={styles.safe}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.safe}>
            <GameScreen />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </GameProvider>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#05050b" },
  screen: { flex: 1, padding: 14, gap: 12 },
  row: { flexDirection: "column", gap: 12, flex: 1 },
  /* FAB styles removed */
})