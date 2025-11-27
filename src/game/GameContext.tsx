import React, { createContext, useContext, useReducer } from "react"
import type { ReactNode } from "react"
import type { GameState } from "./types"
import { createInitialGameState } from "./initialState"
import { gameReducer, type GameAction } from "./gameReducer"

type GameContextValue = {
  state: GameState
  dispatch: React.Dispatch<GameAction>
}

const GameContext = createContext<GameContextValue | undefined>(undefined)

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState)

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => {
  const ctx = useContext(GameContext)
  if (!ctx) {
    throw new Error("useGame must be used inside GameProvider")
  }
  return ctx
}
