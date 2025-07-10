"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { TickData } from "./use-tick-data"
import { getInstrumentName } from "@/components/market-data-grid"
import { shouldAlertsBeActive, getDetailedMarketStatus } from "@/utils/market-timings"
import { AlertService, type UserAlertConfig, type UserAlertLog } from "@/lib/alert-service"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

interface SymbolState {
  baselinePrice: number
  timerId: NodeJS.Timeout | null
  priceHistory: { price: number; timestamp: number }[]
  lastMarketStatusCheck: number
  wasMarketOpen: boolean
  oscillator: OscillatorNode | null
  gainNode: GainNode | null
}

export function useUserInactivityAlerts(ticks: TickData[]) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [configurations, setConfigurations] = useState<Map<number, UserAlertConfig>>(new Map())
  const [alerts, setAlerts] = useState<UserAlertLog[]>([])
  const [inactiveSymbols, setInactiveSymbols] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const symbolStates = useRef<Map<number, SymbolState>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize AudioContext
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        } catch (e) {
          console.error("Web Audio API is not supported in this browser")
        }
      }
      window.removeEventListener("click", initAudio)
    }
    window.addEventListener("click", initAudio)
    return () => window.removeEventListener("click", initAudio)
  }, [])

  // Load user configurations on login
  useEffect(() => {
    if (user) {
      loadUserConfigurations()
      loadRecentAlerts()
    } else {
      setConfigurations(new Map())
      setAlerts([])
      setInactiveSymbols(new Set())
      setLoading(false)
    }
  }, [user])

  const loadUserConfigurations = async () => {
    if (!user) return

    try {
      const configs = await AlertService.getUserAlertConfigs(user.id)
      const configMap = new Map<number, UserAlertConfig>()
      configs.forEach((config) => {
        configMap.set(config.instrument_token, config)
      })
      setConfigurations(configMap)
    } catch (error) {
      console.error("Error loading user configurations:", error)
      toast({
        title: "Error",
        description: "Failed to load alert configurations",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadRecentAlerts = async () => {
    if (!user) return

    try {
      const { logs } = await AlertService.getUserAlertLogs(user.id, {
        limit: 50,
        acknowledged: false,
      })
      setAlerts(logs)

      // Set inactive symbols based on recent unacknowledged alerts
      const inactiveTokens = new Set<number>()
      logs.forEach((log) => {
        if (!log.acknowledged) {
          inactiveTokens.add(log.instrument_token)
        }
      })
      setInactiveSymbols(inactiveTokens)
    } catch (error) {
      console.error("Error loading recent alerts:", error)
    }
  }

  const stopAlertSound = useCallback((instrumentToken: number) => {
    const state = symbolStates.current.get(instrumentToken)
    if (state?.oscillator) {
      try {
        state.oscillator.stop()
        state.oscillator.disconnect()
        state.gainNode?.disconnect()
      } catch (e) {
        console.warn("Error stopping oscillator:", e)
      } finally {
        state.oscillator = null
        state.gainNode = null
      }
    }
  }, [])

  const playAlertSound = useCallback(
    (instrumentToken: number, config: UserAlertConfig) => {
      if (!config.notification_sound || !audioContextRef.current) return

      const ctx = audioContextRef.current
      if (ctx.state === "suspended") {
        ctx.resume()
      }

      stopAlertSound(instrumentToken)

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(440, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime)

      oscillator.start(ctx.currentTime)

      const state = symbolStates.current.get(instrumentToken)
      if (state) {
        state.oscillator = oscillator
        state.gainNode = gainNode
      }
    },
    [stopAlertSound],
  )

  const showBrowserNotification = useCallback((alert: UserAlertLog, config: UserAlertConfig) => {
    if (!config.notification_browser || !("Notification" in window)) return

    if (Notification.permission === "granted") {
      new Notification(`Inactivity Alert: ${alert.instrument_name}`, {
        body: `Price remained around ₹${alert.baseline_price?.toFixed(2)} (±${alert.deviation?.toFixed(2)}) for ${alert.duration} seconds during ${alert.market_session} session.`,
        icon: "/favicon.ico",
        tag: `inactivity-${alert.instrument_token}`,
      })
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          showBrowserNotification(alert, config)
        }
      })
    }
  }, [])

  const triggerAlert = useCallback(
    async (tick: TickData, config: UserAlertConfig, state: SymbolState) => {
      if (!user) return

      const instrumentName = getInstrumentName(tick)
      const marketStatus = getDetailedMarketStatus(instrumentName)

      const prices = state.priceHistory.map((h) => h.price)
      const priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices),
      }

      const newAlert: Omit<UserAlertLog, "id" | "created_at"> = {
        user_id: user.id,
        instrument_token: tick.instrument_token,
        instrument_name: instrumentName,
        exchange: config.exchange,
        alert_type: "inactivity",
        alert_data: {
          tick_data: tick,
          config: config,
          price_history: state.priceHistory,
        },
        baseline_price: state.baselinePrice,
        current_price: tick.last_price,
        price_range: priceRange,
        deviation: config.deviation,
        duration: config.duration,
        market_session: marketStatus.session,
        market_type: marketStatus.marketType,
        acknowledged: false,
      }

      // Log to database
      const success = await AlertService.logAlert(newAlert)
      if (success) {
        setAlerts((prev) =>
          [{ ...newAlert, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...prev].slice(0, 100),
        )
        setInactiveSymbols((prev) => new Set(prev).add(tick.instrument_token))
        playAlertSound(tick.instrument_token, config)
        showBrowserNotification({ ...newAlert, id: crypto.randomUUID(), created_at: new Date().toISOString() }, config)

        toast({
          title: `Inactivity Alert: ${instrumentName}`,
          description: `Price remained around ₹${state.baselinePrice.toFixed(2)} for ${config.duration} seconds`,
          variant: "destructive",
        })
      }
    },
    [user, playAlertSound, showBrowserNotification, toast],
  )

  const resetInactivityTimer = useCallback(
    (tick: TickData, config: UserAlertConfig, state: SymbolState) => {
      if (state.timerId) clearTimeout(state.timerId)

      state.priceHistory = [{ price: tick.last_price, timestamp: Date.now() }]

      state.timerId = setTimeout(() => {
        const instrumentName = getInstrumentName(tick)
        const shouldAlert = config.respect_market_hours ? shouldAlertsBeActive(instrumentName) : true

        if (shouldAlert) {
          triggerAlert(tick, config, state)
        } else {
          stopAlertSound(tick.instrument_token)
          clearSymbolState(tick.instrument_token)
        }
      }, config.duration * 1000)
    },
    [triggerAlert, stopAlertSound],
  )

  const clearSymbolState = useCallback(
    (token: number) => {
      const state = symbolStates.current.get(token)
      if (state?.timerId) clearTimeout(state.timerId)
      stopAlertSound(token)
      symbolStates.current.delete(token)
      setInactiveSymbols((prev) => {
        if (prev.has(token)) {
          const newSet = new Set(prev)
          newSet.delete(token)
          return newSet
        }
        return prev
      })
    },
    [stopAlertSound],
  )

  // Main tick processing effect
  useEffect(() => {
    if (!user || loading) return

    const latestTicks = new Map<number, TickData>()
    for (const tick of ticks) {
      if (
        !latestTicks.has(tick.instrument_token) ||
        tick.receivedAt > latestTicks.get(tick.instrument_token)!.receivedAt
      ) {
        latestTicks.set(tick.instrument_token, tick)
      }
    }

    latestTicks.forEach((tick) => {
      const config = configurations.get(tick.instrument_token)
      if (!config || !config.enabled) {
        clearSymbolState(tick.instrument_token)
        return
      }

      const instrumentName = getInstrumentName(tick)
      const shouldAlert = config.respect_market_hours ? shouldAlertsBeActive(instrumentName) : true

      let state = symbolStates.current.get(tick.instrument_token)
      if (!state) {
        state = {
          baselinePrice: tick.last_price,
          timerId: null,
          priceHistory: [{ price: tick.last_price, timestamp: Date.now() }],
          lastMarketStatusCheck: Date.now(),
          wasMarketOpen: shouldAlert,
          oscillator: null,
          gainNode: null,
        }
        symbolStates.current.set(tick.instrument_token, state)
        if (shouldAlert) {
          resetInactivityTimer(tick, config, state)
        }
        return
      }

      // Check market status changes
      const now = Date.now()
      if (now - state.lastMarketStatusCheck > 60000) {
        state.lastMarketStatusCheck = now
        if (state.wasMarketOpen !== shouldAlert) {
          state.wasMarketOpen = shouldAlert
          if (shouldAlert) {
            state.baselinePrice = tick.last_price
            resetInactivityTimer(tick, config, state)
            if (inactiveSymbols.has(tick.instrument_token)) {
              setInactiveSymbols((prev) => {
                const newSet = new Set(prev)
                newSet.delete(tick.instrument_token)
                return newSet
              })
            }
            stopAlertSound(tick.instrument_token)
            return
          } else {
            stopAlertSound(tick.instrument_token)
            if (state.timerId) {
              clearTimeout(state.timerId)
              state.timerId = null
            }
            return
          }
        }
      }

      if (!shouldAlert && config.respect_market_hours) {
        stopAlertSound(tick.instrument_token)
        if (state.timerId) {
          clearTimeout(state.timerId)
          state.timerId = null
        }
        return
      }

      state.priceHistory.push({ price: tick.last_price, timestamp: Date.now() })

      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      state.priceHistory = state.priceHistory.filter((h) => h.timestamp > fiveMinutesAgo).slice(-100)

      const priceMoved = Math.abs(tick.last_price - state.baselinePrice) > config.deviation
      if (priceMoved) {
        state.baselinePrice = tick.last_price
        resetInactivityTimer(tick, config, state)
        if (inactiveSymbols.has(tick.instrument_token)) {
          setInactiveSymbols((prev) => {
            const newSet = new Set(prev)
            newSet.delete(tick.instrument_token)
            return newSet
          })
        }
        stopAlertSound(tick.instrument_token)
      }
    })
  }, [ticks, configurations, resetInactivityTimer, clearSymbolState, inactiveSymbols, stopAlertSound, user, loading])

  const updateConfiguration = useCallback(
    async (token: number, config: Omit<UserAlertConfig, "id" | "created_at" | "updated_at">) => {
      if (!user) return false

      const success = await AlertService.saveAlertConfig(config)
      if (success) {
        setConfigurations((prev) => new Map(prev).set(token, { ...config, id: crypto.randomUUID() }))
        clearSymbolState(token)
        return true
      }
      return false
    },
    [user, clearSymbolState],
  )

  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      if (!user) return false

      const success = await AlertService.acknowledgeAlert(user.id, alertId)
      if (success) {
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === alertId ? { ...alert, acknowledged: true, acknowledged_at: new Date().toISOString() } : alert,
          ),
        )
        return true
      }
      return false
    },
    [user],
  )

  const clearAllAlerts = useCallback(async () => {
    if (!user) return

    const success = await AlertService.acknowledgeAllAlerts(user.id)
    if (success) {
      setAlerts([])
      symbolStates.current.forEach((_, token) => {
        stopAlertSound(token)
      })
      setInactiveSymbols(new Set())
    }
  }, [user, stopAlertSound])

  return {
    alerts,
    inactiveSymbols,
    configurations,
    loading,
    updateConfiguration,
    acknowledgeAlert,
    clearAllAlerts,
    loadRecentAlerts,
  }
}
