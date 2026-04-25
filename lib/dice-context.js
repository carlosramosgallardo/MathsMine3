'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getDiceState } from './dice'
import { useSound } from './sound-context'

const DiceCtx = createContext(null)

export function DiceProvider({ children }) {
  const [state, setState] = useState(() => getDiceState(0))
  const { playDiceActivate, playDiceDeactivate } = useSound()
  const prevActiveRef = useRef(state.active)

  useEffect(() => {
    const sync = () => {
      const next = getDiceState()
      const wasActive = prevActiveRef.current
      const isActive  = next.active
      if (!wasActive && isActive)  playDiceActivate()
      if (wasActive  && !isActive) playDiceDeactivate()
      prevActiveRef.current = isActive
      setState(next)
    }

    sync()
    const id = setInterval(() => {
      sync()
    }, 1000)
    return () => clearInterval(id)
  }, [playDiceActivate, playDiceDeactivate])

  return <DiceCtx.Provider value={state}>{children}</DiceCtx.Provider>
}

export const useDice = () => useContext(DiceCtx)
